# Writing a NeoKeys extension

An extension is a self-contained directory under `apps/player/extensions`. It
may add tracks, controls, overlays and custom behaviour without editing NeoKeys
core.

## Minimum package

```text
extensions/my-lessons/
├── extension.json
├── extension.js
├── styles.css              optional
└── content/                optional manifests, MIDI and media
```

`extension.json`:

```json
{
  "schemaVersion": "1.0.0",
  "id": "my-lessons",
  "name": "My Lessons",
  "version": "1.0.0",
  "entry": "./extensions/my-lessons/extension.js",
  "stylesheet": "./extensions/my-lessons/styles.css",
  "catalog": "./extensions/my-lessons/content/catalog.json"
}
```

All entry, stylesheet and manifest paths must remain under `./extensions/`.
Content paths should remain inside the extension package as well.

Enable it in `extensions/registry.json`:

```json
{
  "schemaVersion": "1.0.0",
  "extensions": [
    { "manifest": "./extensions/my-lessons/extension.json" }
  ]
}
```

## Entry module

The entry module exports `activate(api, manifest)`. It returns one extension
instance.

```js
export async function activate(api, manifest) {
  const catalogue = await api.fetchJson(manifest.catalog);
  api.registerTracks(catalogue.tracks);

  api.slots.controls.innerHTML = '<button id="myLessons">My lessons</button>';

  return {
    canHandleTrack(track) {
      return track.kind === 'my-lesson';
    },
    activateTrack(track) {
      return {
        loadLabel: ' · my lesson',
        collapsePanelOnTablet: true,
        shouldLoop: () => false,
        deactivate() {}
      };
    },
    onTrackChanged(trackId) {}
  };
}
```

## Core API

The API object is frozen and currently exposes:

- `slots.app`, `slots.controls`, `slots.overlays`: generic DOM mount points;
- `fetchJson(path)`: fetch and parse a JSON asset;
- `registerTracks(tracks)`: add uniquely identified tracks;
- `loadTrack(id)`, `getTrack(id)`, `getCurrentTrackId()`;
- `getPlaybackState()`: current `songTime` and `playing` state;
- `setBrand(...)`, `setTheme(...)`, `setInstrument(...)`;
- `showToast(...)`, `setPlaying(...)`;
- `noteOn(...)`, `noteOff(...)`: custom input surfaces;
- `preferredCanvasDpr()`: the core tablet performance policy.

Extensions should use this API instead of reaching into variables in
`app.js`. Add a generic API method when a genuinely reusable capability is
missing; do not add product-specific concepts to core.

## Track controller hooks

All hooks are optional:

- `songDurationMs`: override the MIDI-derived duration;
- `loadLabel`: suffix used by the loaded-track toast;
- `collapsePanelOnTablet`: request the tablet panel behaviour;
- `hidesKeyboardGuides`: hide normal black-key waterfall bands;
- `getKey(midi, context)`: provide custom falling-note geometry;
- `hitTest(x, y, context)`: map pointer input to a MIDI note;
- `drawInputSurface(litNotes, context)`: replace the normal piano surface;
- `noteTriggered(note, context)`: react when playback reaches a note;
- `frame(deltaMs, context)`: update extension animation state;
- `drawOverlay(context)`: draw after the core piano and waterfall;
- `resize(context)`: react to viewport changes;
- `shouldLoop()`: opt into extension-owned end-of-track looping;
- `deactivate()`: release media and hide extension presentation.

The render context contains the canvas context, viewport/piano measurements,
current theme, playback state, `getKey`, `roundRect` and `hexToRgba` helpers.

## Validation checklist

Run `npm run check` from `apps/player`. Add unit tests for pure logic,
integration tests for manifests/assets, and extend the architecture test if
your extension introduces another boundary that must remain enforceable.
