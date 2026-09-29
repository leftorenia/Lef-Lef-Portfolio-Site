import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
