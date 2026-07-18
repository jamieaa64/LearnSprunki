import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const execFileAsync = promisify(execFile);

test('the production build contains core and registered extension entrypoints', async () => {
  await execFileAsync(process.execPath, ['scripts/build.mjs'], { cwd: projectDirectory });
  for (const path of [
    'dist/index.html',
    'dist/app.js',
    'dist/core/extension-host.js',
    'dist/core/keyboard-range.js',
    'dist/extensions/registry.json',
  ]) await access(resolve(projectDirectory, path));

  const registry = JSON.parse(await readFile(resolve(projectDirectory, 'extensions/registry.json'), 'utf8'));
  for (const reference of registry.extensions) {
    const manifest = JSON.parse(await readFile(resolve(projectDirectory, reference.manifest), 'utf8'));
    for (const asset of [reference.manifest, manifest.entry, manifest.catalog].filter(Boolean)) {
      await access(resolve(projectDirectory, 'dist', asset));
    }
    for (const item of manifest.bundle || []) {
      await access(resolve(projectDirectory, 'dist', dirname(reference.manifest), item));
    }
  }

  const html = await readFile(resolve(projectDirectory, 'dist/index.html'), 'utf8');
  assert.doesNotMatch(html, /node_modules/);
  assert.match(html, /type="module" src="\.\/app\.js"/);
});
