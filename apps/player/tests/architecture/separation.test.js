import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function registeredManifests() {
  const registry = JSON.parse(await readFile(resolve(projectDirectory, 'extensions/registry.json'), 'utf8'));
  return Promise.all(registry.extensions.map(async reference =>
    JSON.parse(await readFile(resolve(projectDirectory, reference.manifest), 'utf8'))
  ));
}

function extensionTerms(manifest) {
  return [...new Set([
    manifest.id.toLowerCase(),
    manifest.name.toLowerCase(),
    ...`${manifest.id} ${manifest.name}`.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 5),
  ])];
}

test('NeoKeys core has no installed-extension names or asset paths', async () => {
  const coreFiles = ['app.js', 'index.html', 'styles.css', 'core/extension-host.js', 'core/keyboard-range.js'];
  const manifests = await registeredManifests();
  for (const path of coreFiles) {
    const source = await readFile(resolve(projectDirectory, path), 'utf8');
    for (const manifest of manifests) {
      for (const term of extensionTerms(manifest)) {
        assert.equal(source.toLowerCase().includes(term), false, `${path} contains extension term ${term}`);
      }
    }
  }
});

test('core HTML exposes generic extension mount points', async () => {
  const html = await readFile(resolve(projectDirectory, 'index.html'), 'utf8');
  assert.match(html, /id="extensionControls"/);
  assert.match(html, /id="extensionOverlays"/);
});

test('generic documentation has no installed-extension names', async () => {
  const repositoryRoot = resolve(projectDirectory, '../..');
  const documentation = [
    resolve(repositoryRoot, 'README.md'),
    resolve(projectDirectory, 'README.md'),
    resolve(repositoryRoot, 'docs/ARCHITECTURE.md'),
    resolve(repositoryRoot, 'docs/EXTENSIONS.md'),
    resolve(repositoryRoot, 'docs/TESTING.md'),
    resolve(repositoryRoot, 'docs/UPSTREAMING.md'),
  ];
  const manifests = await registeredManifests();
  for (const path of documentation) {
    const source = (await readFile(path, 'utf8')).toLowerCase();
    for (const manifest of manifests) {
      for (const term of extensionTerms(manifest)) {
        assert.equal(source.includes(term), false, `${path} contains extension term ${term}`);
      }
    }
  }
});
