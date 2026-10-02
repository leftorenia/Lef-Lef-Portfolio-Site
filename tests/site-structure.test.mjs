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
const immersnapDetailFile = 'works/immersnap/index.html';
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

function renderedText(fragment) {
  return fragment.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
    const brandMark = header.match(/<img\b[^>]*class="brand-mark"[^>]*>/i)?.[0] ?? '';
    assert.ok(brandMark, `missing avatar brand mark in ${file}`);
    assert.equal(getAttribute(brandMark, 'src'), 'assets/images/lef-lef-avatar.png');
    assert.equal(getAttribute(brandMark, 'alt'), '');
    assert.match(header, /class="brand-name"[^>]*>れふれふ<\/span>/i);
  }
});

test('all primary pages expose Lunar Reverie and omit the removed ambient controls and module', () => {
  assert.match(pages['index.html'], /<title>PROFILE — れふれふ<\/title>/i);
  assert.match(pages['index.html'], /class="brand-name"[^>]*>れふれふ<\/span>/i);
  for (const html of [...Object.values(pages), read(detailFile), read(immersnapDetailFile)]) {
    assert.match(html, /<canvas\b[^>]*id="lunar-field"[^>]*aria-hidden="true"/i);
    assert.match(html, /class="[^"]*lunar-fallback[^"]*"/i);
    assert.doesNotMatch(html, /data-sound-toggle|sound-control|page-sound|ambient-sound\.js/i);
    assert.doesNotMatch(html, /<(?:audio|video)\b/i);
    assert.match(html, /lunar-field\.js/i);
    assert.doesNotMatch(html, /cosmic-field\.js/i);
  }
});

test('profile omits the removed featured-work and scroll status strip', () => {
  const profile = pages['index.html'];
  assert.doesNotMatch(profile, /hero-status|hero-featured|hero-scroll/i);
  assert.doesNotMatch(profile, /FEATURED WORK|SCROLL TO EXPLORE/i);
});

test('profile uses the approved avatar for its compact and central identity marks', () => {
  const profile = pages['index.html'];

  assert.equal((profile.match(/class="profile-emblem"/gi) ?? []).length, 1);
  const centralMark = profile.match(/<img\b[^>]*class="profile-emblem-mark"[^>]*>/i)?.[0] ?? '';
  assert.ok(centralMark, 'missing central avatar');
  assert.equal(getAttribute(centralMark, 'src'), 'assets/images/lef-lef-avatar.png');
  assert.equal(getAttribute(centralMark, 'alt'), '');

  const detailBrand = read(detailFile).match(/<img\b[^>]*class="brand-mark"[^>]*>/i)?.[0] ?? '';
  assert.equal(getAttribute(detailBrand, 'src'), '../../assets/images/lef-lef-avatar.png');
  assert.equal(getAttribute(detailBrand, 'alt'), '');
});

test('site structure contains truthful profile, work, and contact content', () => {
  assert.match(pages['index.html'], /Shader \/ VFX Artist/);
  assert.match(pages['index.html'], /Shader・リアルタイムVFX・XR表現/);
  assert.doesNotMatch(pages['index.html'], /一瞬の光に|ABOUT THE EXPLORATION|interest-list/i);

  assert.match(pages['works.html'], /COSMO EFFECTS/);
  assert.match(pages['works.html'], /Unity VFX Study/);
  assert.match(pages['works.html'], /<canvas\b[^>]*data-work-preview[^>]*aria-hidden="true"/i);
  assert.match(pages['contact.html'], /XのDM/);
  assert.doesNotMatch(pages['contact.html'], /mailto:|leftorenia@gmail\.com/i);
  assert.doesNotMatch(allHtml, /YOUR NAME|作品を準備中|依頼受付中/i);
});

test('profile exposes an extensible platform grid with the approved destinations', () => {
  const profile = pages['index.html'];
  assert.match(profile, /class="profile-socials"/i);
  for (const [label, href] of [
    ['GitHub', 'https://github.com/leftorenia'],
    ['note', 'https://note.com/lef_torenia_lef'],
    ['X', 'https://x.com/lef_torenia_lef'],
    ['VRChat', 'https://vrchat.com/home/user/usr_58a4e42c-bc5c-4197-9aec-a25c45fd87c5'],
    ['Speaker Deck', 'https://speakerdeck.com/lef_lef'],
  ]) {
    assert.match(profile, new RegExp(`<a\\b[^>]*href="${href.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]*?${label}`, 'i'));
  }
  assert.equal((profile.match(/class="profile-social-link"/gi) ?? []).length, 5);
});

test('CONNECT places Speaker Deck after VRChat and serves both official logos locally', () => {
  const socials = pages['index.html'].match(/<ul\b[^>]*class="profile-socials"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  const links = [...socials.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  assert.deepEqual(links.slice(-2).map(link => getAttribute(link[1], 'href')), [
    'https://vrchat.com/home/user/usr_58a4e42c-bc5c-4197-9aec-a25c45fd87c5',
    'https://speakerdeck.com/lef_lef',
  ]);
  for (const [link, src] of [
    [links.at(-2), 'assets/images/platforms/vrchat.png'],
    [links.at(-1), 'assets/images/platforms/speaker-deck.svg'],
  ]) {
    const image = link?.[2].match(/<img\b[^>]*>/i)?.[0] ?? '';
    assert.equal(getAttribute(image, 'src'), src);
    assert.equal(getAttribute(image, 'alt'), '', 'adjacent platform label already names the link');
    assert.ok(existsSync(join(root, src)), `missing logo asset: ${src}`);
    assert.ok(Number(getAttribute(image, 'width')) > 0);
    assert.ok(Number(getAttribute(image, 'height')) > 0);
  }
});

test('Contact directs inquiries only to the approved X profile', () => {
  const contact = pages['contact.html'];
  const outbound = [...contact.matchAll(/<a\b[^>]*href="(https?:[^\"]+)"[^>]*>/gi)].map(match => match[1]);
  assert.deepEqual(outbound, ['https://x.com/lef_torenia_lef']);
  assert.match(contact, /XのDMからご連絡ください/);
});

test('site structure restricts outbound links to verified destinations', () => {
  const allowed = new Set([
    'https://github.com/leftorenia',
    'https://note.com/lef_torenia_lef',
    'https://x.com/lef_torenia_lef',
    'https://vrchat.com/home/user/usr_58a4e42c-bc5c-4197-9aec-a25c45fd87c5',
    'https://speakerdeck.com/lef_lef',
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

test('site structure uses only the approved avatar, platform logos, and local work imagery', () => {
  const imageTags = [...allHtml.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  for (const tag of imageTags) {
    const src = getAttribute(tag, 'src');
    assert.match(src, /(?:^|\.\.\/\.\.\/)assets\/images\/(?:lef-lef-avatar\.png|platforms\/(?:vrchat\.png|speaker-deck\.svg)|works\/[a-z0-9-]+\/[a-z0-9-]+\.(?:png|jpe?g|webp|avif))$/i);
    if (/\/works\//i.test(src)) assert.ok(getAttribute(tag, 'alt'), `work image needs alt text: ${src}`);
  }
  assert.doesNotMatch(allHtml, /assets\/img\//i);
});

test('site structure loads the shared lunar shell without the legacy ocean script', () => {
  for (const html of [...Object.values(pages), read(detailFile), read(immersnapDetailFile)]) {
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
  assert.match(detail, /<canvas\b[^>]*data-work-preview[^>]*aria-hidden="true"/i);
  assert.match(detail, /class="[^"]*work-preview-fallback[^"]*"/i);
  assert.doesNotMatch(detail, /client|employer|award|release/i);
});

test('work detail headers contain only the work name', () => {
  for (const file of [detailFile, immersnapDetailFile]) {
    const titleGroup = read(file).match(/<header class="work-detail-header">([\s\S]*?)<\/header>/)?.[1] ?? '';
    assert.equal([...titleGroup.matchAll(/<h1\b/gi)].length, 1, `${file}: one work title required`);
    assert.equal([...titleGroup.matchAll(/<p\b/gi)].length, 0, `${file}: descriptions belong below the cover, not beside the work title`);
    const bodyCopy = read(file).match(/<section\b[^>]*aria-label="作品について"[^>]*>([\s\S]*?)<\/section>/)?.[1] ?? '';
    assert.ok([...bodyCopy.matchAll(/<p\b/gi)].length > 0, `${file}: keep the explanation below the cover`);
  }
});

test('each work detail has an optional video slot after its cover', () => {
  for (const file of [detailFile, immersnapDetailFile]) {
    const detail = read(file);
    const cover = detail.indexOf('class="work-detail-visual');
    const video = detail.indexOf('class="work-video-section"');
    assert.ok(cover >= 0 && video > cover, file);
    assert.match(detail, /data-work-video-url=""[^>]*hidden/i, 'no supplied video means no empty visible slot');
    assert.match(detail, /src="\.\.\/\.\.\/assets\/js\/work-media\.js"/);
  }
});

test('IMMERSNAP template places video after DETAILS and before the image gallery', () => {
  const detail = read(immersnapDetailFile);
  const description = detail.indexOf('class="work-detail-description"');
  const details = detail.indexOf('class="work-gallery-section"');
  const heading = detail.indexOf('<h2 id="gallery-title">DETAILS</h2>');
  const video = detail.indexOf('class="work-video-section"');
  const gallery = detail.indexOf('class="work-gallery"');
  assert.ok(description >= 0 && details > description && heading > details, 'description precedes DETAILS');
  assert.ok(video > heading && gallery > video, 'DETAILS → optional video → images');
  assert.equal([...detail.matchAll(/data-work-video-url=/g)].length, 1, 'one video slot only');
});

test('IMMERSNAP has a truthful static detail page with its supplied gallery', () => {
  assert.ok(existsSync(join(root, immersnapDetailFile)), 'missing IMMERSNAP detail page');
  const detail = read(immersnapDetailFile);

  assert.match(detail, /<body\b[^>]*data-page="work-detail"/i);
  assert.match(detail, /<title>IMMERSNAP — れふれふ<\/title>/i);
  const images = [...detail.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const workImages = images.filter((tag) => /assets\/images\/works\/immersnap\//i.test(getAttribute(tag, 'src')));
  assert.deepEqual(workImages.map((tag) => getAttribute(tag, 'src')), [
    '../../assets/images/works/immersnap/cover.jpg',
    '../../assets/images/works/immersnap/blue-effects.jpg',
    '../../assets/images/works/immersnap/cosmo-effects.jpg',
    '../../assets/images/works/immersnap/pink-effects.jpg',
  ]);
  for (const tag of workImages) {
    assert.ok(getAttribute(tag, 'alt'), 'IMMERSNAP work images need descriptive alt text');
    assert.ok(Number(getAttribute(tag, 'width')) > 0, 'IMMERSNAP work images need intrinsic width');
    assert.ok(Number(getAttribute(tag, 'height')) > 0, 'IMMERSNAP work images need intrinsic height');
  }
  assert.doesNotMatch(detail, /client|employer|award|release/i);
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

test('Works lists only published projects with the newest project first', () => {
  const works = pages['works.html'];
  const cards = [...works.matchAll(
    /<a\b[^>]*class="[^"]*\bwork-card\b[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
  )].map((match) => match[0]);

  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((card) => getAttribute(card.match(/<a\b[^>]*>/i)?.[0] ?? '', 'href')), [
    'works/immersnap/index.html',
    'works/cosmo-effects/index.html',
  ]);
  assert.match(cards[0], /W\.002[\s\S]*IMMERSNAP/i);
  assert.match(cards[0], /assets\/images\/works\/immersnap\/cover\.jpg/i);
  const newestDescription = cards[0].match(/<p\b[^>]*class="[^"]*\bwork-description\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
  assert.equal(
    renderedText(newestDescription),
    'XR技術を駆使した、新たな撮影体験。写真を撮るだけじゃない、新しい思い出の残し方を体験しよう！',
  );
  assert.match(cards[1], /W\.001[\s\S]*COSMO EFFECTS/i);
  assert.doesNotMatch(works, /COMING SOON|data-work-status="coming-soon"|coming-soon-card/i);
});

test('repository policy keeps approved avatar, platform logos, and work imagery local', () => {
  const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter((file) => file && existsSync(join(root, file)));
  const imageFiles = trackedFiles.filter((file) => /\.(?:png|jpe?g|webp|gif)$/i.test(file));
  for (const file of imageFiles) {
    assert.match(file, /^assets\/images\/(?:lef-lef-avatar\.png|platforms\/vrchat\.png|works\/[a-z0-9-]+\/[a-z0-9-]+\.(?:png|jpe?g|webp|avif))$/i);
  }
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

test('public reference policy permits the avatar, approved platform logos, and local work imagery only', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'lef-avatar-policy-'));
  try {
    mkdirSync(join(fixture, 'assets', 'images', 'works', 'immersnap'), { recursive: true });
    writeFileSync(join(fixture, 'assets', 'images', 'lef-lef-avatar.png'), 'approved avatar fixture');
    writeFileSync(join(fixture, 'assets', 'images', 'works', 'immersnap', 'cover.jpg'), 'work image fixture');
    mkdirSync(join(fixture, 'assets', 'images', 'platforms'), { recursive: true });
    writeFileSync(join(fixture, 'assets', 'images', 'platforms', 'vrchat.png'), 'official VRChat logo fixture');
    writeFileSync(join(fixture, 'assets', 'images', 'platforms', 'speaker-deck.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    writeFileSync(join(fixture, 'index.html'), [
      '<img src="assets/images/lef-lef-avatar.png" alt="">',
      '<img src="assets/images/works/immersnap/cover.jpg" alt="IMMERSNAP">',
      '<img src="assets/images/platforms/vrchat.png" alt="">',
      '<img src="assets/images/platforms/speaker-deck.svg" alt="">',
    ].join(''));
    assert.deepEqual(publicPolicy.validatePublicReferences(fixture), []);

    writeFileSync(join(fixture, 'assets', 'images', 'extra.png'), 'unapproved image fixture');
    writeFileSync(join(fixture, 'index.html'), '<img src="assets/images/extra.png" alt="">');
    assert.match(publicPolicy.validatePublicReferences(fixture).join('\n'), /forbidden media/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

test('repository policy documents preview, verification, motion, and image rules', () => {
  const readme = read('README.md');
  for (const topic of [/Lunar Reverie/, /WebGL2/, /CSS[^\n]*(?:フォールバック|fallback)/i,
    /参照サイト[^\n]*含め/]) {
    assert.match(readme, topic);
  }
  assert.match(readme, /npm test/);
  assert.match(readme, /python -m http\.server 4173/);
  assert.match(readme, /prefers-reduced-motion/);
  assert.match(readme, /参考画像[^\n]*(?:含め|使用し)/);
  assert.match(readme, /assets\/images\/lef-lef-avatar\.png/);
  assert.doesNotMatch(readme, /ラスター画像と音声ファイルは追加しません/);
  assert.match(readme, /## Adding a work/);
  assert.match(readme, /works\/<slug>\/index\.html/);
  assert.match(readme, /works\/immersnap\/index\.html[^\n]*(?:コピー|複製)/i);
  assert.match(readme, /tests\/site-structure\.test\.mjs/);
});

test('recursive public references stay inside the GitHub Pages project and resolve locally', () => {
  assert.equal(typeof publicPolicy.validatePublicReferences, 'function');
  assert.deepEqual(publicPolicy.validatePublicReferences(root), []);
});

test('work video configuration validates local files and rejects unsafe embed inputs', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'lef-video-policy-'));
  try {
    mkdirSync(join(fixture, 'assets', 'videos', 'works', 'example'), { recursive: true });
    writeFileSync(join(fixture, 'assets', 'videos', 'works', 'example', 'demo.mp4'), 'video fixture');
    for (const source of ['assets/videos/works/example/demo.mp4', 'https://youtu.be/aqz-KE-bpKQ', 'https://vimeo.com/76979871']) {
      writeFileSync(join(fixture, 'index.html'), `<section data-work-video-url="${source}"></section>`);
      assert.deepEqual(publicPolicy.validatePublicReferences(fixture), [], source);
    }
    for (const [source, expected] of [
      ['assets/videos/works/example/missing.webm', /missing/],
      ['javascript:alert(1)', /invalid video/],
      ['https://youtube.com/watch?v=bad', /invalid video/],
      ['../outside.mp4', /invalid video/],
    ]) {
      writeFileSync(join(fixture, 'index.html'), `<section data-work-video-url="${source}"></section>`);
      assert.match(publicPolicy.validatePublicReferences(fixture).join('\n'), expected);
    }
    writeFileSync(join(fixture, 'assets', 'videos', 'unapproved.mp4'), 'unapproved video fixture');
    assert.match(publicPolicy.validatePublicReferences(fixture).join('\n'), /forbidden media file/);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
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

for (const [file, source, expected] of [
  ['index.html', `<p>It's my site</p><script type="module">import './missing.js';</script>`, ['index.html: missing ./missing.js']],
  ['module.js', "export {x as export} from './missing.js';", ['module.js: missing ./missing.js']],
  ['module.js', 'import { "}" as x } from "./missing.js";', ['module.js: missing ./missing.js']],
  ['module.js', 'export { x as "{" } from "./missing.js";', ['module.js: missing ./missing.js']],
  ['module.js', 'import { "ordinary-name" as x } from "./missing.js";', ['module.js: missing ./missing.js']],
  ['module.js', 'export { x as "ordinary-name" } from "./missing.js";', ['module.js: missing ./missing.js']],
  ['module.js', "const text = `${await import('./missing.js')}`;", ['module.js: missing ./missing.js']],
  ['module.js', "const text = `outer ${`inner ${await import('./missing.js')}`} end`;", ['module.js: missing ./missing.js']],
  ['module.js', "const text = `${({value: import('./missing.js')}).value}`;", ['module.js: missing ./missing.js']],
  ['module.js', "export {x as import, y as export} from 'https://example.com/code.js';", ['module.js: remote or unsupported resource https://example.com/code.js']],
  ['index.html', `<p>import './prose.js'; It's not code.</p><script type="application/json">"import './json.js'"</script><!-- <script type="module">import './comment.js';</script> --><script type="module">const s = "import './string.js'"; /* import './comment.js'; */ const t = \`import './template.js'\`;</script>`, []],
  ['module.js', "const text = `import './text.js'; ${\"import './string.js'\"} ${/* import './comment.js'; */ 1}`;", []],
  ['module.js', "const text = `escaped \\${import('./text.js')}`;", []],
  ['module.js', 'const pattern = /\'/; import "https://example.com/code.js";', ['module.js: remote or unsupported resource https://example.com/code.js']],
  ['module.js', '/import("missing.js")/', []],
  ['module.js', String.raw`const pattern = /[/'"\\]import("missing.js")\//giu; import './missing.js';`, ['module.js: missing ./missing.js']],
  ['module.js', 'function match(value) { return /import("missing.js")/.test(value); } if (ready) /import("missing.js")/.test(value);', []],
  ['module.js', 'const match = value => /import("missing.js")/.test(value);', []],
  ['module.js', 'const ratio = total / count; import "https://example.com/code.js";', ['module.js: remote or unsupported resource https://example.com/code.js']],
  ['module.js', 'const ratio = 10 / 2 / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = (total + 1) / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = getTotal() / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = values[0] / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = total++ / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = {} / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = `10` / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'const ratio = /x/ / import("./missing.js");', ['module.js: missing ./missing.js']],
  ['module.js', 'import(`./missing.js`);', ['module.js: missing ./missing.js']],
  ['module.js', 'import(`https://example.com/code.js`);', ['module.js: remote or unsupported resource https://example.com/code.js']],
  ['module.js', 'import(`./missing-${name}.js`); import(`./missing.js` + suffix);', []],
]) {
  test(`policy scans executable code boundaries: ${source}`, () => {
    const fixture = mkdtempSync(join(tmpdir(), 'lef-code-boundaries-'));
    try {
      writeFileSync(join(fixture, file), source);
      assert.deepEqual(publicPolicy.validatePublicReferences(fixture), expected);
    } finally { rmSync(fixture, { recursive: true, force: true }); }
  });
}
