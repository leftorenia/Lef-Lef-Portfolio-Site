import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPublicHtmlFiles } from './helpers/public-html.mjs';
import * as publicPolicy from './helpers/public-html.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const pageFiles = ['index.html', 'works.html', 'contact.html'];
const detailFile = 'works/cosmo-effects/index.html';
const pages = Object.fromEntries(pageFiles.map((file) => [file, read(file)]));
const existingHtmlFiles = discoverPublicHtmlFiles(root);
const allHtml = existingHtmlFiles.map(read).join('\n');

function navLabels(html) {
  const nav = html.match(/<nav\b[^>]*class="[^"]*site-nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? '';
  return [...nav.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, '').trim());
}

function getAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'))?.[1] ?? '';
}

test('site structure exposes exactly the approved three-page navigation', () => {
  for (const html of Object.values(pages)) {
    assert.deepEqual(navLabels(html), ['PROFILE', 'WORKS', 'CONTACT']);
    const nav = html.match(/<nav\b[^>]*class="[^"]*site-nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? '';
    assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1);
  }
});

test('site structure gives every main page accessible landmarks and identity', () => {
  const expectations = {
    'index.html': ['profile', 'PROFILE — れふれふ', 'FIELD 01'],
    'works.html': ['works', 'WORKS — れふれふ', 'FIELD 02'],
    'contact.html': ['contact', 'CONTACT — れふれふ', 'FIELD 03'],
  };

  for (const [file, [page, title, field]] of Object.entries(expectations)) {
    const html = pages[file];
    assert.match(html, new RegExp(`<body\\b[^>]*data-page="${page}"`, 'i'));
    assert.match(html, new RegExp(`<title>${title}<\\/title>`, 'i'));
    assert.equal((html.match(/class="skip-link"/g) ?? []).length, 1);
    assert.equal((html.match(/<main\b[^>]*id="main-content"/g) ?? []).length, 1);
    assert.match(html, new RegExp(field));
  }
});

test('site structure presents the same identity before navigation', () => {
  for (const [file, html] of Object.entries(pages)) {
    const header = html.match(/<header\b[^>]*class="[^"]*site-header[^"]*"[^>]*>([\s\S]*?)<\/header>/i)?.[1] ?? '';
    const brandPosition = header.indexOf('class="brand"');
    const navPosition = header.indexOf('class="site-nav"');

    assert.ok(brandPosition >= 0, `missing brand in ${file}`);
    assert.ok(navPosition > brandPosition, `navigation must follow brand in ${file}`);
    assert.match(header, /class="brand-mark"[^>]*>LF<\/span>/i);
    assert.match(header, /class="brand-name"[^>]*>LEFLEF<\/span>/i);
  }
});

test('all primary pages expose Lunar Reverie controls and relative modules', () => {
  assert.match(pages['index.html'], /<title>PROFILE — れふれふ<\/title>/i);
  assert.match(pages['index.html'], /class="brand-name"[^>]*>LEFLEF<\/span>/i);
  for (const html of [...Object.values(pages), read(detailFile)]) {
    assert.match(html, /<canvas\b[^>]*id="lunar-field"[^>]*aria-hidden="true"/i);
    assert.match(html, /class="[^"]*lunar-fallback[^"]*"/i);
    const soundButtons = [...html.matchAll(/<button\b[^>]*data-sound-toggle\b[^>]*>/gi)];
    assert.equal(soundButtons.length, 1);
    assert.equal(getAttribute(soundButtons[0][0], 'aria-pressed'), 'false');
    const soundModules = [...html.matchAll(/<script\b[^>]*src="[^"]*ambient-sound\.js"[^>]*>/gi)];
    assert.equal(soundModules.length, 1);
    assert.equal(getAttribute(soundModules[0][0], 'type'), 'module');
    assert.doesNotMatch(html, /<(?:audio|video)\b/i);
    assert.match(html, /lunar-field\.js/i);
    assert.doesNotMatch(html, /cosmic-field\.js/i);
  }
  assert.match(pages['index.html'], /class="hero-status"/i);
  assert.match(pages['index.html'], /COSMO EFFECTS/i);
});

test('profile uses a generated identity emblem instead of an image', () => {
  const profile = pages['index.html'];

  assert.equal((profile.match(/class="profile-emblem"/gi) ?? []).length, 1);
  assert.match(profile, /class="[^"]*\bprofile-emblem-mark\b[^"]*"[^>]*>LF<\/span>/i);
  assert.doesNotMatch(profile, /<img\b/i);
});

test('site structure contains truthful profile, work, and contact content', () => {
  assert.match(pages['index.html'], /Shader \/ VFX Explorer/);
  for (const label of ['SHADER', 'REALTIME VFX', 'UNITY', 'VISUAL STUDY']) {
    assert.match(pages['index.html'], new RegExp(label));
  }

  assert.match(pages['works.html'], /COSMO EFFECTS/);
  assert.match(pages['works.html'], /Unity VFX Study/);
  assert.match(pages['works.html'], /<canvas\b[^>]*data-work-preview[^>]*aria-hidden="true"/i);
  assert.match(pages['contact.html'], /mailto:leftorenia@gmail\.com/);
  assert.doesNotMatch(allHtml, /YOUR NAME|作品を準備中|依頼受付中/i);
});

test('site structure restricts outbound links to verified destinations', () => {
  const allowed = new Set([
    'mailto:leftorenia@gmail.com',
    'https://github.com/leftorenia',
    'https://x.com/lef_clear_lef',
    'https://note.com/lef_torenia_lef',
  ]);

  const tags = [...allHtml.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
  const outbound = tags
    .map((tag) => getAttribute(tag, 'href'))
    .filter((href) => /^(?:https?:|mailto:)/i.test(href));

  assert.ok(outbound.length >= allowed.size);
  for (const href of outbound) assert.ok(allowed.has(href), `unexpected outbound link: ${href}`);

  for (const tag of tags.filter((candidate) => getAttribute(candidate, 'target') === '_blank')) {
    const rel = new Set(getAttribute(tag, 'rel').split(/\s+/));
    assert.ok(rel.has('noopener'));
    assert.ok(rel.has('noreferrer'));
  }
});

test('site structure preserves the old About URL with a Profile fallback', () => {
  const about = read('about.html');
  assert.match(about, /http-equiv="refresh"[^>]*url=index\.html/i);
  assert.match(about, /rel="canonical"[^>]*href="index\.html"/i);
  assert.match(about, /<a\b[^>]*href="index\.html"/i);
});

test('site structure never embeds the supplied reference image', () => {
  assert.doesNotMatch(allHtml, /<img\b|Cosmo_effects\.png|assets\/img\//i);
});

test('site structure loads the shared lunar shell without the legacy ocean script', () => {
  for (const html of [...Object.values(pages), read(detailFile)]) {
    assert.equal(
      (html.match(/<script\b[^>]*type="module"[^>]*src="(?:\.\.\/\.\.\/)?assets\/js\/lunar-field\.js"[^>]*><\/script>/gi) ?? []).length,
      1,
    );
    assert.doesNotMatch(html, /ocean-bg\.js/i);
  }
});

test('site structure loads the generated work preview only after the shared field on Works', () => {
  const works = pages['works.html'];
  const fieldPosition = works.indexOf('assets/js/lunar-field.js');
  const previewPosition = works.indexOf('assets/js/work-preview.js');

  assert.ok(fieldPosition >= 0);
  assert.ok(previewPosition > fieldPosition);
  assert.doesNotMatch(pages['index.html'], /work-preview\.js/i);
  assert.doesNotMatch(pages['contact.html'], /work-preview\.js/i);
});

test('Cosmo Effects has a truthful static detail page', () => {
  assert.ok(existsSync(join(root, detailFile)), 'missing Cosmo Effects detail page');
  const detail = read(detailFile);

  assert.match(detail, /<body\b[^>]*data-page="work-detail"/i);
  assert.match(detail, /<title>COSMO EFFECTS — れふれふ<\/title>/i);
  assert.match(detail, /Unity VFX Study/i);
  assert.match(detail, /PERSONAL STUDY/i);
  assert.match(detail, /<canvas\b[^>]*data-work-preview[^>]*aria-hidden="true"/i);
  assert.match(detail, /class="[^"]*work-preview-fallback[^"]*"/i);
  assert.doesNotMatch(detail, /client|employer|award|release|<img\b/i);
});

test('the real work card and nested detail page use resolvable relative navigation', () => {
  const works = pages['works.html'];
  assert.match(
    works,
    /<a\b[^>]*class="[^"]*\bwork-card-link\b[^"]*"[^>]*href="works\/cosmo-effects\/index\.html"[\s\S]*?<\/a>/i,
  );
  assert.match(works, /class="work-arrow"/i);

  assert.ok(existsSync(join(root, detailFile)), 'missing Cosmo Effects detail page');
  const detail = read(detailFile);
  for (const destination of ['../../index.html', '../../works.html', '../../contact.html']) {
    assert.match(detail, new RegExp(`href="${destination.replaceAll('.', '\\.')}"`, 'i'));
  }

  const fieldPosition = detail.indexOf('../../assets/js/lunar-field.js');
  const previewPosition = detail.indexOf('../../assets/js/work-preview.js');
  assert.ok(fieldPosition >= 0);
  assert.ok(previewPosition > fieldPosition);
  assert.doesNotMatch(detail, /\b(?:href|src)="\//i);
});

test('Works exposes one real project and six inert future slots', () => {
  const works = pages['works.html'];
  const cards = [...works.matchAll(/<(?:a|article)\b[^>]*class="[^"]*\bwork-card\b[^"]*"/gi)];
  const futureCards = [...works.matchAll(
    /<article\b[^>]*class="[^"]*\bcoming-soon-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi,
  )].map((match) => match[0]);

  assert.equal(cards.length, 7);
  assert.equal((works.match(/data-work-status="coming-soon"/g) ?? []).length, 6);
  assert.equal((works.match(/\bwork-card-link\b/g) ?? []).length, 1);
  assert.equal(futureCards.length, 6);

  for (let index = 2; index <= 7; index += 1) {
    assert.match(works, new RegExp(`W\\.00${index}[\\s\\S]*COMING SOON`, 'i'));
  }

  for (const card of futureCards) {
    assert.doesNotMatch(card, /<a\b|\bhref=|work-arrow|data-work-preview/i);
  }
});

test('repository policy keeps public assets local, resolvable, and image-free', () => {
  const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const imageFiles = trackedFiles.filter((file) => /\.(?:png|jpe?g|webp|gif)$/i.test(file));
  assert.deepEqual(imageFiles, []);
  assert.deepEqual(trackedFiles.filter((file) => /\.(?:mp3|m4a|wav|ogg)$/i.test(file)), []);
  assert.doesNotMatch(allHtml, /<(?:audio|video)\b/i);

  const publicSourceFiles = trackedFiles.filter((file) => (
    /\.html$/i.test(file)
    || /^assets\/(?:css|js)\//i.test(file)
  ));
  for (const file of publicSourceFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /ocean-bg\.js|Cosmo_effects/i, `stale visual asset in ${file}`);
  }

  const navDestinations = new Set();
  for (const html of Object.values(pages)) {
    const nav = html.match(/<nav\b[^>]*class="[^"]*site-nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? '';
    for (const match of nav.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) navDestinations.add(match[1]);
  }

  for (const file of existingHtmlFiles) {
    const html = read(file);
    assert.doesNotMatch(html, /\b(?:href|src)="\//i, `root-relative asset in ${file}`);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
      const reference = match[1];
      if (/^(?:#|https?:|mailto:)/i.test(reference)) continue;
      const localPath = reference.split(/[?#]/, 1)[0];
      const resolvedPath = join(root, dirname(file), ...localPath.split('/'));
      assert.ok(existsSync(resolvedPath), `missing local asset from ${file}: ${reference}`);
    }
  }

  assert.deepEqual(
    [...navDestinations].sort(),
    ['contact.html', 'index.html', 'works.html'],
  );
});

test('repository policy documents preview, verification, motion, and image rules', () => {
  const readme = read('README.md');
  for (const topic of [/Lunar Reverie/, /WebGL2/, /CSS[^\n]*(?:フォールバック|fallback)/i,
    /Web Audio/, /SOUND OFF/, /START SOUND/, /SOUND ON/, /SOUND UNAVAILABLE/,
    /(?:明示|クリック|操作)[^\n]*(?:生成|開始|再開)/, /参照サイト[^\n]*含め/]) {
    assert.match(readme, topic);
  }
  assert.match(readme, /npm test/);
  assert.match(readme, /python -m http\.server 4173/);
  assert.match(readme, /prefers-reduced-motion/);
  assert.match(readme, /参考画像[^\n]*(?:含め|使用し)/);
  assert.match(readme, /## Adding a work/);
  assert.match(readme, /works\/<slug>\/index\.html/);
  assert.match(readme, /COMING SOON/i);
  assert.match(readme, /Coming Soon[^\n]*(?:置き換|置換)/i);
  assert.match(readme, /works\/cosmo-effects\/index\.html[^\n]*(?:コピー|複製)/i);
  assert.match(readme, /tests\/site-structure\.test\.mjs/);
  assert.match(readme, /(?:カード数|期待値)/);
});

test('recursive public references stay inside the GitHub Pages project and resolve locally', () => {
  assert.equal(typeof publicPolicy.validatePublicReferences, 'function');
  assert.deepEqual(publicPolicy.validatePublicReferences(root), []);
});

test('public pages declare a local vector favicon to prevent implicit root favicon requests', () => {
  for (const file of existingHtmlFiles) {
    const icon = [...read(file).matchAll(/<link\b[^>]*>/gi)].map(match => match[0])
      .find(tag => getAttribute(tag, 'rel') === 'icon');
    assert.ok(icon, `missing favicon declaration in ${file}`);
    assert.equal(getAttribute(icon, 'type'), 'image/svg+xml');
    const href = getAttribute(icon, 'href');
    assert.match(href, /\.svg$/);
    assert.ok(existsSync(join(root, dirname(file), href)), `missing favicon from ${file}`);
  }
});

test('public reference policy catches nested imports, remote resources, media, and subpath escapes', () => {
  assert.equal(typeof publicPolicy.validatePublicReferences, 'function');
  const fixture = mkdtempSync(join(tmpdir(), 'lef-public-policy-'));
  try {
    mkdirSync(join(fixture, 'works', 'nested'), { recursive: true });
    mkdirSync(join(fixture, 'assets'), { recursive: true });
    writeFileSync(join(fixture, 'index.html'), '<a href="works/nested/index.html">Work</a>');
    writeFileSync(join(fixture, 'works/nested/index.html'), '<script type="module" src="../../assets/main.js"></script>');
    writeFileSync(join(fixture, 'assets/main.js'), "import './child.js'; export { x } from './child.js'; import('./child.js');");
    writeFileSync(join(fixture, 'assets/child.js'), 'export const x = 1;');
    assert.deepEqual(publicPolicy.validatePublicReferences(fixture), []);
    const cases = [
      ['works/nested/index.html', '<script src="/assets/main.js"></script>', /root-relative/],
      ['works/nested/index.html', '<link href="https://fonts.example/font.css" rel="stylesheet">', /remote/],
      ['works/nested/index.html', '<img src="https://example.com/a.png">', /remote/],
      ['works/nested/index.html', '<a href="../../../escape.html">Escape</a>', /outside/],
      ['works/nested/index.html', '<a href="../../%2e%2e%2fescape.html">Escape</a>', /outside/],
      ['works/nested/index.html', "<script src='../../assets/missing.js'></script>", /missing/],
      ['assets/child.js', "import './missing.js';", /missing/],
      ['assets/child.js', "import {\n missing\n} from './missing.js';", /missing/],
      ['assets/child.js', "export { x } from 'https://example.com/code.js';", /remote/],
      ['assets/child.js', "import('/assets/code.js');", /root-relative/],
      ['assets/child.js', "import 'unbundled-package';", /bare/],
      ['assets/extra.css', '@font-face { src: url(https://example.com/font.woff2) }', /remote/],
      ['assets/photo.webp', '', /media/],
      ['assets/sound.wav', '', /media/],
    ];
    for (const [file, source, expected] of cases) {
      const path = join(fixture, file);
      const previous = existsSync(path) ? readFileSync(path, 'utf8') : null;
      writeFileSync(path, source);
      assert.match(publicPolicy.validatePublicReferences(fixture).join('\n'), expected, file);
      if (previous === null) rmSync(path); else writeFileSync(path, previous);
    }
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

for (const [source, expected] of [
  ["import'./missing.js'", 'missing ./missing.js'],
  ["import{x}from'./missing.js'", 'missing ./missing.js'],
  ["export{x}from'https://example.com/code.js'", 'remote or unsupported resource https://example.com/code.js'],
  ["import/* comment */ './missing.js'", 'missing ./missing.js'],
  ["import { x } from './missing.js';", 'missing ./missing.js'],
  ["export { x } from './missing.js';", 'missing ./missing.js'],
  ["export/* comment */*/* comment */from/* comment */'./missing.js';", 'missing ./missing.js'],
  ["import('./missing.js');", 'missing ./missing.js'],
  ["import/* comment */(/* comment */'./missing.js'/* comment */);", 'missing ./missing.js'],
  ["import// comment\n'./missing.js';", 'missing ./missing.js'],
]) {
  test(`module policy resolves literal syntax: ${source}`, () => {
    const fixture = mkdtempSync(join(tmpdir(), 'lef-module-policy-'));
    try {
      writeFileSync(join(fixture, 'module.js'), source);
      assert.deepEqual(publicPolicy.validatePublicReferences(fixture), [`module.js: ${expected}`]);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  });
}

test('module policy ignores comments, ordinary strings, and genuinely computed imports', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'lef-module-policy-'));
  try {
    writeFileSync(join(fixture, 'module.js'), `
      // import './missing-comment.js';
      /* export { x } from './missing-comment.js'; */
      const example = "import './missing-example.js'";
      const template = \`import './missing-template.js'\`;
      import('./computed-' + name + '.js');
      import(moduleName);
    `);
    assert.deepEqual(publicPolicy.validatePublicReferences(fixture), []);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

for (const source of [
  '<script src="https://example.com/code.js"></script>',
  '<script data-label="a > b" src="https://example.com/code.js"></script>',
  "<script data-label='a > b' src='https://example.com/code.js'></script>",
  '<link data-label="a > b" href="https://example.com/code.js">',
]) {
  test(`HTML policy reads references after quoted greater-than: ${source}`, () => {
    const fixture = mkdtempSync(join(tmpdir(), 'lef-html-policy-'));
    try {
      writeFileSync(join(fixture, 'index.html'), source);
      assert.deepEqual(publicPolicy.validatePublicReferences(fixture), ['index.html: remote or unsupported resource https://example.com/code.js']);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  });
}
