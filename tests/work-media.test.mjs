import test from 'node:test';
import assert from 'node:assert/strict';

import * as media from '../assets/js/work-media.js';
const options = {
  pageUrl: 'https://leftorenia.github.io/Lef-Lef-Portfolio-Site/works/immersnap/index.html',
  projectUrl: 'https://leftorenia.github.io/Lef-Lef-Portfolio-Site/',
};

test('work media accepts a normal YouTube URL without forwarding autoplay or tracking', () => {
  assert.equal(typeof media.resolveWorkVideo, 'function');
  assert.deepEqual(media.resolveWorkVideo('https://www.youtube.com/watch?v=aqz-KE-bpKQ&autoplay=1&si=tracking', options), {
    kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
    href: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  });
});

test('YouTube sharing, Shorts, live and embed URLs produce the same player', () => {
  for (const url of [
    'https://youtu.be/aqz-KE-bpKQ?si=tracking',
    'https://m.youtube.com/shorts/aqz-KE-bpKQ',
    'https://youtube.com/live/aqz-KE-bpKQ',
    'https://www.youtube.com/embed/aqz-KE-bpKQ?autoplay=1',
    'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ',
  ]) assert.equal(media.resolveWorkVideo(url, options).src, 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
});

test('Vimeo embeds retain only the unlisted-video hash', () => {
  for (const url of [
    'https://vimeo.com/76979871/5e2d1c1e6d',
    'https://player.vimeo.com/video/76979871?h=5e2d1c1e6d&autoplay=1',
  ]) assert.deepEqual(media.resolveWorkVideo(url, options), {
    kind: 'embed', src: 'https://player.vimeo.com/video/76979871?h=5e2d1c1e6d',
    href: 'https://vimeo.com/76979871/5e2d1c1e6d',
  });
  assert.equal(media.resolveWorkVideo('https://vimeo.com/76979871', options).src, 'https://player.vimeo.com/video/76979871');
});

test('local MP4/WebM files resolve inside the GitHub Pages project', () => {
  for (const extension of ['mp4', 'webm']) assert.deepEqual(
    media.resolveWorkVideo(`../../assets/videos/works/immersnap/demo.${extension}`, options),
    { kind: 'file', src: `https://leftorenia.github.io/Lef-Lef-Portfolio-Site/assets/videos/works/immersnap/demo.${extension}`, href: `https://leftorenia.github.io/Lef-Lef-Portfolio-Site/assets/videos/works/immersnap/demo.${extension}` },
  );
  assert.equal(media.resolveWorkVideo('https://cdn.example.com/demo.mp4', options).kind, 'file');
});

test('unsafe URLs, project escapes, and malformed supported-provider URLs never create players', () => {
  for (const source of ['', '  ', 'javascript:alert(1)', 'data:video/mp4;base64,test', 'http://youtu.be/aqz-KE-bpKQ', '//evil.test/video.mp4',
    'https://user:secret@youtube.com/watch?v=aqz-KE-bpKQ', 'https://youtube.com/watch?v=bad',
    'https://vimeo.com/not-a-video', '../../../outside.mp4', '../../assets/videos/works/immersnap/%2e%2e%2fescape.mp4',
  ]) assert.equal(media.resolveWorkVideo(source, options), null, source);
  assert.equal(media.resolveWorkVideo('https://youtube.com.evil.test/watch?v=aqz-KE-bpKQ', options).kind, 'link');
});

test('unsupported HTTPS video sites remain usable as external links, never arbitrary iframes', () => {
  assert.deepEqual(media.resolveWorkVideo('https://www.nicovideo.jp/watch/sm12345678', options), {
    kind: 'link', href: 'https://www.nicovideo.jp/watch/sm12345678',
  });
});

// Small DOM boundary double: assert the nodes produced by the real renderer.
function element(tagName = 'section') {
  return {
    tagName, attributes: {}, children: [], hidden: false, textContent: '',
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    replaceChildren(...nodes) { this.children = nodes; },
    append(...nodes) { this.children.push(...nodes); },
  };
}
function section(source) {
  const root = element();
  root.hidden = true;
  root.attributes['data-work-video-url'] = source;
  root.attributes['data-work-video-title'] = 'IMMERSNAP 作品動画';
  root.frame = element('div');
  root.link = element('a');
  root.querySelector = selector => selector === '.work-video-frame' ? root.frame : root.link;
  root.ownerDocument = { createElement: tag => element(tag), baseURI: options.pageUrl };
  return root;
}

test('video renderer hides unconfigured sections, creates titled lazy embeds, and does not duplicate them', () => {
  const empty = section('');
  assert.equal(media.renderWorkVideo(empty, options), false);
  assert.equal(empty.hidden, true);
  assert.equal(empty.frame.children.length, 0);
  const configured = section('https://youtu.be/aqz-KE-bpKQ');
  assert.equal(media.renderWorkVideo(configured, options), true);
  assert.equal(configured.hidden, false);
  const iframe = configured.frame.children[0];
  assert.equal(iframe.tagName, 'iframe');
  assert.equal(iframe.attributes.src, 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ');
  assert.equal(iframe.attributes.title, 'IMMERSNAP 作品動画');
  assert.equal(iframe.attributes.loading, 'lazy');
  assert.ok(!iframe.attributes.allow.includes('autoplay'));
  assert.equal(configured.link.attributes.href, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  media.renderWorkVideo(configured, options);
  assert.equal(configured.frame.children.length, 1);
});

test('native video has explicit playback controls and preserves a fallback for external failures', () => {
  const local = section('../../assets/videos/works/immersnap/demo.mp4');
  media.renderWorkVideo(local, options);
  const video = local.frame.children[0];
  assert.equal(video.tagName, 'video');
  assert.ok(Object.hasOwn(video.attributes, 'controls'));
  assert.ok(Object.hasOwn(video.attributes, 'playsinline'));
  assert.equal(video.attributes.preload, 'metadata');
  assert.ok(!Object.hasOwn(video.attributes, 'autoplay'));
  assert.ok(!Object.hasOwn(video.attributes, 'loop'));
  const unknown = section('https://www.nicovideo.jp/watch/sm12345678');
  media.renderWorkVideo(unknown, options);
  assert.equal(unknown.frame.hidden, true);
  assert.equal(unknown.frame.children.length, 0);
  assert.equal(unknown.link.hidden, false);
  assert.equal(unknown.link.attributes.href, 'https://www.nicovideo.jp/watch/sm12345678');
});

test('changing or clearing video configuration replaces the player without retaining stale media', () => {
  const configured = section('https://youtu.be/aqz-KE-bpKQ');
  media.renderWorkVideo(configured, options);
  configured.attributes['data-work-video-url'] = 'https://vimeo.com/76979871';
  media.renderWorkVideo(configured, options);
  assert.equal(configured.frame.children.length, 1);
  assert.equal(configured.frame.children[0].attributes.src, 'https://player.vimeo.com/video/76979871');
  configured.attributes['data-work-video-url'] = '';
  media.renderWorkVideo(configured, options);
  assert.equal(configured.hidden, true);
  assert.equal(configured.frame.children.length, 0);
});

test('boot initializes configured work sections only and is safe on pages with no media', () => {
  assert.equal(media.bootWorkMedia(undefined, options), 0);
  assert.equal(media.bootWorkMedia({ querySelectorAll: () => [] }, options), 0);
  const sections = [section(''), section('https://youtu.be/aqz-KE-bpKQ')];
  assert.equal(media.bootWorkMedia({ querySelectorAll: () => sections }, options), 1);
  assert.equal(sections[0].hidden, true);
  assert.equal(sections[1].frame.children[0].tagName, 'iframe');
});
