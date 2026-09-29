import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const NON_PUBLIC_DIRECTORIES = new Set([
  '.git',
  '.superpowers',
  'docs',
  'node_modules',
  'tests',
]);

function discoverPublicFiles(root) {
  const files = [];

  function walk(directory) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || NON_PUBLIC_DIRECTORIES.has(entry.name)) continue;
        walk(join(directory, entry.name));
        continue;
      }

      if (!entry.isFile()) continue;
      files.push(relative(root, join(directory, entry.name)).split(sep).join('/'));
    }
  }

  walk(root);
  return files.sort();
}

export function discoverPublicHtmlFiles(root) {
  return discoverPublicFiles(root).filter(file => /\.html$/i.test(file));
}

// Keep quoted values intact: a > inside an attribute does not close its tag.
function* htmlTags(source) {
  const starts = /<([a-z][\w-]*)\b/gi;
  let match;
  while ((match = starts.exec(source))) {
    const start = starts.lastIndex;
    let quote = null;
    let end = start;
    for (; end < source.length; end++) {
      const char = source[end];
      if (quote) { if (char === quote) quote = null; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    yield { name: match[1].toLowerCase(), attributes: source.slice(start, end) };
    starts.lastIndex = end + 1;
  }
}

// Token boundaries, rather than whitespace, delimit ECMAScript module syntax.
// Strings and comments are consumed as units so their example text is not code.
function moduleTokens(source) {
  const tokens = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) { index++; continue; }
    if (source.startsWith('//', index)) {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('/*', index)) {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let value = '';
      index++;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') {
          index++;
          // Escaped quote/slash characters stay inside this literal token.
          const escaped = source[index++];
          value += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0', '\n': '' })[escaped] ?? escaped;
        } else value += source[index++];
      }
      index++;
      tokens.push({ kind: quote === '`' ? 'template' : 'string', value });
      continue;
    }
    if (/[a-z_$]/i.test(char)) {
      const start = index++;
      while (index < source.length && /[\w$]/.test(source[index])) index++;
      tokens.push({ kind: 'word', value: source.slice(start, index) });
      continue;
    }
    tokens.push({ kind: 'punctuation', value: char });
    index++;
  }
  return tokens;
}

function* moduleReferences(source) {
  const tokens = moduleTokens(source);
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind !== 'word' || !['import', 'export'].includes(token.value)) continue;
    if (tokens[index - 1]?.value === '.') continue;
    const next = tokens[index + 1];
    if (token.value === 'import' && next?.kind === 'string') { yield next.value; continue; }
    if (next?.value === '(') {
      // A literal first argument must end here (or precede import options).
      // Concatenations, variables and template expressions remain computed.
      if (token.value === 'import' && tokens[index + 2]?.kind === 'string'
        && [')', ','].includes(tokens[index + 3]?.value)) yield tokens[index + 2].value;
      continue;
    }
    if (next?.value === '.' || (token.value === 'export' && !['{', '*'].includes(next?.value))) continue;
    for (let cursor = index + 1; cursor < tokens.length; cursor++) {
      const candidate = tokens[cursor];
      if (candidate.value === ';' || (candidate.kind === 'word' && ['import', 'export'].includes(candidate.value))) break;
      if (candidate.kind === 'word' && candidate.value === 'from' && tokens[cursor + 1]?.kind === 'string') {
        yield tokens[cursor + 1].value;
        break;
      }
    }
  }
}

// Resolve exactly as a browser served from the GitHub Pages project subpath.
export function validatePublicReferences(root, base = 'https://leftorenia.github.io/Lef-Lef-Portfolio-Site/') {
  const issues = [];
  const media = /\.(?:png|jpe?g|webp|gif|avif|bmp|ico|mp3|m4a|wav|ogg|aac|flac)(?:[?#]|$)/i;
  function check(file, reference, { navigation = false, module = false } = {}) {
    const ref = reference.trim();
    if (ref.startsWith('#')) return;
    if (/^[\/\\]/.test(ref)) { issues.push(`${file}: root-relative ${ref}`); return; }
    if (/^[a-z][\w+.-]*:/i.test(ref)) {
      if (!navigation || !/^(?:https?:|mailto:)/i.test(ref)) issues.push(`${file}: remote or unsupported resource ${ref}`);
      return;
    }
    if (module && !/^\.\.?\//.test(ref)) { issues.push(`${file}: bare module ${ref}`); return; }
    const url = new URL(ref, new URL(file, base));
    if (!url.href.startsWith(base)) { issues.push(`${file}: outside project ${ref}`); return; }
    if (media.test(ref)) issues.push(`${file}: forbidden media ${ref}`);
    const path = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));
    const resolved = resolve(root, path);
    const local = relative(root, resolved);
    if (local.startsWith('..') || isAbsolute(local)) { issues.push(`${file}: outside repository ${ref}`); return; }
    if (!existsSync(resolved)) issues.push(`${file}: missing ${ref}`);
  }
  for (const file of discoverPublicFiles(root)) {
    if (media.test(file)) issues.push(`${file}: forbidden media file`);
    if (!/\.(?:html|css|m?js)$/i.test(file)) continue;
    const source = readFileSync(join(root, file), 'utf8');
    if (/\.html$/i.test(file)) {
      for (const tag of htmlTags(source)) {
        for (const attr of tag.attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
          const name = attr[1].toLowerCase();
          if (name !== 'href' && name !== 'src') continue;
          check(file, attr[2] ?? attr[3] ?? attr[4] ?? '', { navigation: tag.name === 'a' && name === 'href' });
        }
      }
    }
    if (/\.(?:m?js|html)$/i.test(file)) {
      for (const reference of moduleReferences(source)) check(file, reference, { module: true });
    }
    if (/\.(?:css|html)$/i.test(file)) {
      for (const match of source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/gi)) check(file, match[1] ?? match[2]);
    }
  }
  return issues;
}
