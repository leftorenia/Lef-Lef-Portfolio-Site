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

test('style contract uses the approved local cosmic palette', () => {
  assert.match(css, /--color-bg:\s*#050509/i);
  assert.match(css, /--color-violet:/i);
  assert.match(css, /--color-blue:/i);
  assert.match(css, /--color-ice:/i);
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
  ]) {
    assert.match(css, rule(selector), `missing CSS rule for ${selector}`);
  }

  assert.match(css, /\.work-preview[^\{]*\{[^}]*aspect-ratio:/s);
  assert.match(css, /#cosmic-field[^\{]*\{[^}]*pointer-events:\s*none/s);
});

test('style contract preserves keyboard and active-page affordances', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.site-nav\s+a\[aria-current="page"\][^\{]*\{[^}]*border/s);
  assert.match(css, /\.skip-link:focus[^\{]*\{[^}]*transform:/s);
});

test('style contract has mobile and reduced-motion fallbacks', () => {
  assert.match(css, /@media\s*\([^)]*max-width:\s*720px[^)]*\)/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/s);
  assert.match(css, /prefers-reduced-motion:[\s\S]*animation:\s*none/s);
  assert.match(css, /overflow-x:\s*hidden[\s\S]*overflow-x:\s*clip/s);
});
