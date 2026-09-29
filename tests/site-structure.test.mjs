import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const pageFiles = ['index.html', 'works.html', 'contact.html'];
const pages = Object.fromEntries(pageFiles.map((file) => [file, read(file)]));
const allHtml = [...Object.values(pages), read('about.html')].join('\n');

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

test('site structure loads the shared generated background without the legacy ocean script', () => {
  for (const html of Object.values(pages)) {
    assert.equal(
      (html.match(/<script\b[^>]*type="module"[^>]*src="assets\/js\/cosmic-field\.js"[^>]*><\/script>/gi) ?? []).length,
      1,
    );
    assert.doesNotMatch(html, /ocean-bg\.js/i);
  }
});

test('site structure loads the generated work preview only after the shared field on Works', () => {
  const works = pages['works.html'];
  const fieldPosition = works.indexOf('assets/js/cosmic-field.js');
  const previewPosition = works.indexOf('assets/js/work-preview.js');

  assert.ok(fieldPosition >= 0);
  assert.ok(previewPosition > fieldPosition);
  assert.doesNotMatch(pages['index.html'], /work-preview\.js/i);
  assert.doesNotMatch(pages['contact.html'], /work-preview\.js/i);
});

test('the static work card does not imply an unavailable outbound action', () => {
  assert.doesNotMatch(pages['works.html'], /class="work-arrow"/i);
});

test('repository policy keeps public assets local, resolvable, and image-free', () => {
  const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const imageFiles = trackedFiles.filter((file) => /\.(?:png|jpe?g|webp|gif)$/i.test(file));
  assert.deepEqual(imageFiles, []);

  const publicSourceFiles = trackedFiles.filter((file) => (
    /^(?:index|works|contact|about)\.html$/i.test(file)
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

    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
      const reference = match[1];
      if (/^(?:#|https?:|mailto:)/i.test(reference)) continue;
      const localPath = reference.split(/[?#]/, 1)[0];
      assert.ok(existsSync(join(root, ...localPath.split('/'))), `missing local asset: ${reference}`);
    }
  }

  assert.deepEqual(
    [...navDestinations].sort(),
    ['contact.html', 'index.html', 'works.html'],
  );
});

test('repository policy documents preview, verification, motion, and image rules', () => {
  const readme = read('README.md');
  assert.match(readme, /npm test/);
  assert.match(readme, /python -m http\.server 4173/);
  assert.match(readme, /prefers-reduced-motion/);
  assert.match(readme, /参考画像[^\n]*(?:含め|使用し)/);
});
