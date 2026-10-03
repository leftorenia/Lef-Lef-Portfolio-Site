import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPublicHtmlFiles, validatePublicReferences } from './helpers/public-html.mjs';
import { createWorkTemplateFixture } from './helpers/work-template-fixture.mjs';
import { resolveWorkVideo } from '../assets/js/work-media.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'https://leftorenia.github.io/Lef-Lef-Portfolio-Site/';

test('copy sources are not hidden from Git by the ignored docs directory', () => {
  const result = spawnSync('git', ['check-ignore', '--no-index', 'docs/templates/work-detail.html', 'docs/templates/work-card.html'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1, `templates must be trackable: ${result.stdout}${result.stderr}`);
});

for (const [slug, title] of [['aurora-study', 'AURORA STUDY'], ['river-echo', 'RIVER ECHO']]) {
  test(`copying a new ${slug} work resolves its own images and navigation under GitHub Pages`, () => {
    const f = createWorkTemplateFixture({ slug, title });
    try {
      assert.deepEqual(validatePublicReferences(f.directory), []);
      assert.ok(discoverPublicHtmlFiles(f.directory).includes(`works/${slug}/index.html`));
      assert.ok(f.works.indexOf(`href="works/${slug}/index.html"`) < f.works.indexOf('href="works/immersnap/index.html"'), 'new card is first');
      assert.ok(f.detail.includes(`<h1>${title}</h1>`));
      assert.ok(f.card.includes(`<h2>${title}</h2>`));
      assert.ok(f.detail.includes(`images/works/${slug}/detail-01.jpg`));
      assert.doesNotMatch(f.detail + f.card, /\{\{[A-Z0-9_]+\}\}|IMMERSNAP|immersnap/);
    } finally { rmSync(f.directory, { recursive: true, force: true }); }
  });
}

for (const [url, expectedKind, expectedSrc] of [
  ['', null, null],
  ['https://youtu.be/aqz-KE-bpKQ', 'embed', 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ'],
  ['https://vimeo.com/76979871', 'embed', 'https://player.vimeo.com/video/76979871'],
  ['../../assets/videos/works/aurora-study/demo.mp4', 'file', `${base}assets/videos/works/aurora-study/demo.mp4`],
]) {
  test(`copied video slot accepts ${expectedKind ?? 'no video'} without changing the template structure`, () => {
    const f = createWorkTemplateFixture({ videoUrl: url });
    try {
      const tag = f.detail.match(/<section\b[^>]*data-work-video-url="[^"]*"[^>]*>/)?.[0] ?? '';
      const source = tag.match(/data-work-video-url="([^"]*)"/)?.[1];
      assert.equal(source, url);
      const result = resolveWorkVideo(source, { projectUrl: base, pageUrl: `${base}works/aurora-study/index.html` });
      assert.equal(result?.kind ?? null, expectedKind);
      assert.equal(result?.src ?? null, expectedSrc);
      assert.deepEqual(validatePublicReferences(f.directory), []);
      const details = f.detail.indexOf('id="gallery-title"');
      const video = f.detail.indexOf('data-work-video-url=');
      const images = f.detail.indexOf('class="work-gallery"');
      assert.ok(details >= 0 && details < video && video < images, 'DETAILS → video → images');
      assert.match(tag, /\bhidden\b/, 'unconfigured slot must be hidden before JavaScript loads');
    } finally { rmSync(f.directory, { recursive: true, force: true }); }
  });
}
