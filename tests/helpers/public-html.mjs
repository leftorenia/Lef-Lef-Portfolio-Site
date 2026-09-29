import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const NON_PUBLIC_DIRECTORIES = new Set([
  '.git',
  '.superpowers',
  'docs',
  'node_modules',
  'tests',
]);

export function discoverPublicHtmlFiles(root) {
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

      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.html')) continue;
      files.push(relative(root, join(directory, entry.name)).split(sep).join('/'));
    }
  }

  walk(root);
  return files.sort();
}
