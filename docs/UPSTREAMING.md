# Upstreaming to NeoKeys

The refactor keeps product-specific code out of the potential upstream patch.

## Core candidates

Changes under these paths are designed to be useful without LearnSprunki:

- `apps/player/app.js`, `index.html`, and `styles.css`;
- `apps/player/core/extension-host.js` and `core/keyboard-range.js`;
- fullscreen and tablet canvas performance work;
- adaptive 25/37/49/61/73/88-key keyboard controls;
- external core MIDI catalogue and local production dependency packaging;
- `tests/unit`, the generic integration build test, and the architecture
  boundary test.

The extension host can be proposed separately from the keyboard/fullscreen
changes if the NeoKeys maintainer prefers smaller pull requests.

## Excluded product layer

Do not include these in a NeoKeys pull request:

- `apps/player/extensions/learn-sprunki`;
- `SprunkiAssets`;
- `tools/authoring` Sprunki generation plans;
- LearnSprunki research and product documentation;
- extension-specific content validation assertions.

Before preparing an upstream branch, disable Learn Sprunki in
`apps/player/extensions/registry.json`, run `npm run check`, and browser-test
the three core demo tracks. The architecture suite should remain green and
core should render the default `NeoKeys` branding.
