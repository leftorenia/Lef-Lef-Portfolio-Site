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
      for (const tag of source.matchAll(/<([a-z][\w-]*)\b[^>]*>/gi)) {
        for (const attr of tag[0].matchAll(/\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
          check(file, attr[2] ?? attr[3] ?? attr[4], { navigation: tag[1].toLowerCase() === 'a' && attr[1].toLowerCase() === 'href' });
        }
      }
    }
    if (/\.(?:m?js|html)$/i.test(file)) {
      const modules = /\b(?:import|export)\s+(?:[^;'"]*?\s+from\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g;
      for (const match of source.matchAll(modules)) check(file, match[1] ?? match[2], { module: true });
    }
    if (/\.(?:css|html)$/i.test(file)) {
      for (const match of source.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]/gi)) check(file, match[1] ?? match[2]);
    }
  }
  return issues;
}
