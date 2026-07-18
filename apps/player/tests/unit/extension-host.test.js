import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionHost, validateExtensionManifest } from '../../core/extension-host.js';

const manifest = {
  schemaVersion: '1.0.0',
  id: 'example-extension',
  name: 'Example Extension',
  version: '1.0.0',
  entry: './extensions/example/extension.js',
};

test('validates the public extension manifest contract', () => {
  assert.equal(validateExtensionManifest(manifest).id, 'example-extension');
  assert.throws(
    () => validateExtensionManifest({ ...manifest, entry: '../outside.js' }),
    /entry must stay inside/
  );
  assert.throws(
    () => validateExtensionManifest({ ...manifest, bundle: ['../outside.js'] }),
    /invalid bundle path/
  );
});

test('freezes the API supplied to extensions', () => {
  const host = new ExtensionHost({ loadTrack() {} });
  assert.equal(Object.isFrozen(host.api), true);
});

test('starts extensions and manages one active track controller', async () => {
  const events = [];
  const controller = { deactivate: () => events.push('deactivate') };
  const extension = {
    async activate(api, receivedManifest) {
      events.push(`start:${receivedManifest.id}`);
      assert.equal(Object.isFrozen(api), true);
      return {
        canHandleTrack: track => track?.kind === 'example',
        activateTrack: track => { events.push(`track:${track.id}`); return controller; },
      };
    },
  };
  const host = new ExtensionHost({});
  host.register(manifest, extension);
  await host.startAll();
  assert.equal(host.activateTrack({ id: 'one', kind: 'example' }), controller);
  assert.equal(host.activeExtensionId, 'example-extension');
  host.activateTrack({ id: 'core', kind: 'demo' });
  assert.equal(host.activeController, null);
  assert.deepEqual(events, ['start:example-extension', 'track:one', 'deactivate']);
});

test('rejects duplicate extension identifiers', () => {
  const host = new ExtensionHost({});
  const extension = { activate: async () => ({}) };
  host.register(manifest, extension);
  assert.throws(() => host.register(manifest, extension), /duplicate id/);
});
