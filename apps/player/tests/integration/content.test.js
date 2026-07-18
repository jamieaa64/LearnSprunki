import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalogue } from '../../scripts/validate-content.mjs';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('core and extension catalogues form a valid content graph', async () => {
  const result = await validateCatalogue(projectDirectory);
  assert.equal(result.tracks, 3);
  assert.deepEqual(result.extensions.map(extension => extension.id), ['learn-sprunki']);
  assert.equal(result.extensions[0].tracks, 30);
  assert.equal(result.extensions[0].games, 1);
});
