import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverPublicHtmlFiles } from './helpers/public-html.mjs';

test('public HTML discovery includes future nested work pages without a hardcoded list', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'lef-public-html-'));

  try {
    mkdirSync(join(fixtureRoot, 'works', 'future-study'), { recursive: true });
    mkdirSync(join(fixtureRoot, 'docs'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'index.html'), '<!doctype html>');
    writeFileSync(join(fixtureRoot, 'works.html'), '<!doctype html>');
    writeFileSync(join(fixtureRoot, 'works', 'future-study', 'index.html'), '<!doctype html>');
    writeFileSync(join(fixtureRoot, 'docs', 'internal.html'), '<!doctype html>');

    assert.deepEqual(discoverPublicHtmlFiles(fixtureRoot), [
      'index.html',
      'works.html',
      'works/future-study/index.html',
    ]);
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
