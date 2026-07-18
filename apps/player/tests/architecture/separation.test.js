import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('NeoKeys core has no Sprunki-specific names or asset paths', async () => {
  const coreFiles = ['app.js', 'index.html', 'styles.css', 'core/extension-host.js', 'core/keyboard-range.js'];
  for (const path of coreFiles) {
    const source = await readFile(resolve(projectDirectory, path), 'utf8');
    assert.doesNotMatch(source, /sprunki/i, `${path} contains Sprunki-specific coupling`);
    assert.doesNotMatch(source, /extensions\/learn-sprunki/, `${path} imports the product extension directly`);
  }
});

test('core HTML exposes generic extension mount points', async () => {
  const html = await readFile(resolve(projectDirectory, 'index.html'), 'utf8');
  assert.match(html, /id="extensionControls"/);
  assert.match(html, /id="extensionOverlays"/);
});

test('Learn Sprunki owns its runtime, styles, manifest and content', async () => {
  for (const path of ['extension.json', 'extension.js', 'styles.css', 'content/catalog.json', 'schema/catalog.schema.json']) {
    await readFile(resolve(projectDirectory, 'extensions/learn-sprunki', path), 'utf8');
  }
});
