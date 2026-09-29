import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'assets/css/style.css'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}[^\\{]*\\{[^}]+\\}`, 's');
}

test('style contract uses the approved Lunar Reverie palette', () => {
  for (const color of ['#030815', '#08152d', '#284d86', '#6d91c9', '#bed6f6', '#eef4ff']) {
    assert.match(css, new RegExp(color, 'i'));
  }
  assert.match(css, /--font-display:/i);
  assert.match(css, /--font-mono:/i);
  assert.doesNotMatch(css, /url\(["']?https?:\/\//i);
});

test('style contract includes every page layout hook', () => {
  for (const selector of [
    '.site-nav',
    '.hero',
    '.profile-grid',
    '.works-grid',
    '.contact-links',
    '.skip-link',
    '.static-nebula',
    '.lunar-fallback',
    '.hero-status',
    '.sound-toggle',
    '.hero-moon-note',
  ]) {
    assert.match(css, rule(selector), `missing CSS rule for ${selector}`);
  }

  assert.match(css, /\.work-preview[^\{]*\{[^}]*aspect-ratio:/s);
  assert.match(css, /#lunar-field[^\{]*\{[^}]*pointer-events:\s*none/s);
});

test('style contract uses a one-row masthead and generated Profile emblem', () => {
  assert.match(css, /\.site-header[^\{]*\{[^}]*flex-direction:\s*row/s);
  assert.match(css, /\.site-header[^\{]*\{[^}]*justify-content:\s*space-between/s);
  assert.match(css, /\.hero[^\{]*\{[^}]*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(0,\s*3fr\)/s);
  assert.match(css, /\.profile-emblem[^\{]*\{[^}]*aspect-ratio:\s*1/s);
  assert.match(css, /\.profile-emblem-mark[^\{]*\{[^}]*place-items:\s*center/s);
});

test('style contract supports linked work cards and the detail layout', () => {
  for (const selector of [
    '.work-card-link',
    '.work-detail-page',
    '.work-detail-visual',
    '.work-detail-grid',
    '.work-detail-actions',
  ]) {
    assert.match(css, rule(selector), `missing CSS rule for ${selector}`);
  }

  assert.match(css, /\.work-card-link:focus-visible[^\{]*\{[^}]*(?:outline|border):/s);
  assert.match(css, /\.work-detail-visual[^\{]*\{[^}]*aspect-ratio:/s);
});

test('style contract keeps the Works grid responsive and future-proof', () => {
  assert.match(
    css,
    /\.works-grid[^\{]*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    css,
    /@media\s*\([^)]*max-width:\s*1099px[^)]*\)[\s\S]*?\.works-grid[^\{]*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    css,
    /@media\s*\([^)]*max-width:\s*719px[^)]*\)[\s\S]*?\.works-grid[^\{]*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(css, /\.work-card[^\{]*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.work-heading h2[^\{]*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /\.work-tags li[^\{]*\{[^}]*overflow-wrap:\s*anywhere/s);
});

test('style contract preserves keyboard and active-page affordances', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.site-nav\s+a\[aria-current="page"\][^\{]*\{[^}]*border/s);
  assert.match(css, /\.skip-link:focus[^\{]*\{[^}]*transform:/s);
});

test('style contract has mobile and reduced-motion fallbacks', () => {
  assert.match(css, /@media\s*\([^)]*max-width:\s*719px[^)]*\)/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/s);
  assert.match(css, /prefers-reduced-motion:[\s\S]*animation:\s*none/s);
  assert.match(css, /overflow-x:\s*hidden[\s\S]*overflow-x:\s*clip/s);
  assert.match(
    css,
    /html\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-x:\s*clip/s,
    'the root viewport must clip decorative overflow on narrow screens',
  );
});

const tabletCss = css.split('@media (max-width: 1099px)')[1].split('@media (max-width: 719px)')[0];
const mobileCss = css.split('@media (max-width: 719px)')[1].split('@media (max-width: 420px)')[0];
const reducedCss = css.split('@media (prefers-reduced-motion: reduce)')[1];

test('Profile retains its 40/60 celestial composition until the compact breakpoint', () => {
  assert.match(css, /\.hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(0,\s*3fr\)/s);
  assert.doesNotMatch(tabletCss, /\.hero\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(mobileCss, /\.hero\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.hero-copy\s*\{[^}]*min-width:\s*0/s);
});

test('hero status has three shrinkable regions and stacks on compact screens', () => {
  assert.match(css, /\.hero-status\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.hero-status\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
  assert.match(mobileCss, /\.hero-status\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('compact navigation and text actions have at least 44px touch height', () => {
  for (const selector of ['.brand', '.site-nav a', '.text-link', '.hero-featured']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const body = mobileCss.match(new RegExp(`${escaped}(?=[\\s,{])[^\\{]*\\{[^}]+\\}`, 's'))?.[0] ?? '';
    assert.match(body, /min-height:\s*(?:44px|2\.75rem)/, `${selector} needs a compact touch target`);
  }
});

test('linked work reveals moonlight without relying on motion or capturing canvas input', () => {
  assert.match(css, /\.work-card-link:hover\s*,\s*\.work-card-link:focus-visible\s*\{[^}]*box-shadow:/s);
  assert.match(css, /\.work-preview\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(reducedCss, /\.work-card-link:hover\s+\.work-arrow\s*,\s*\.work-card-link:focus-visible\s+\.work-arrow\s*\{[^}]*transform:\s*none/s);
});

test('linked preview localizes its cloud reveal to pointer coordinates without intercepting links', () => {
  const highlight = css.match(/\.work-card-link\s+\.work-visual::after\s*\{[^}]*\}/s)?.[0] ?? '';
  assert.match(highlight, /background:[^;]*radial-gradient/s);
  assert.match(highlight, /mask-image:[^;]*at var\(--work-pointer-x,\s*50%\) var\(--work-pointer-y,\s*50%\)/s);
  assert.match(highlight, /opacity:\s*var\(--work-pointer-active,\s*0\)/);
  assert.match(css, /\.work-visual::after\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(reducedCss, /\.work-card-link\s+\.work-visual::after\s*\{[^}]*opacity:\s*0/s);
});

test('Contact values remain fully readable and detail fallback has no moon', () => {
  assert.match(css, /\.contact-value\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.doesNotMatch(css, /\.contact-value\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /body\[data-page="work-detail"\]\s+\.lunar-fallback::before\s*\{[^}]*display:\s*none/s);
});

test('Contact heading fits its narrower desktop column', () => {
  const heading = css.match(/\.contact-heading h1\s*\{[^}]*\}/s)?.[0] ?? '';
  assert.match(heading, /font-size:\s*clamp\(3\.25rem,\s*6vw,\s*6rem\)/);
});

test('generated work fallbacks use lunar colors when JavaScript is unavailable', () => {
  const visuals = css.slice(css.indexOf('.work-visual {'), css.indexOf('.work-detail-grid {'));
  assert.ok(!/rgba\((?:146, 92, 255|67, 141, 255|188, 232, 255|236, 168, 255),/.test(visuals),
    'preview fallback and Coming Soon decorations must share the lunar palette');
});
