import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalogue } from '../../scripts/validate-content.mjs';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('core and extension catalogues form a valid content graph', async () => {
  const result = await validateCatalogue(projectDirectory);
  assert.equal(result.tracks, 3);
  assert.ok(result.extensions.length > 0);
  for (const extension of result.extensions) {
    assert.equal(typeof extension.id, 'string');
    assert.ok(extension.id.length > 0);
  }
});
