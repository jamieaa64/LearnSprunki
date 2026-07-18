# Upstreaming to NeoKeys

The extension boundary keeps reusable player work separate from installed
product packages.

## Core candidates

Changes under these paths are designed to stand alone:

- `apps/player/app.js`, `index.html`, and `styles.css`;
- `apps/player/core`;
- fullscreen and tablet canvas-performance work;
- adaptive standard-size keyboard controls;
- the external core MIDI catalogue and local production dependency packaging;
- generic unit, integration and architecture tests;
- generic extension documentation and lifecycle support.

Propose independent features as small pull requests when practical. For
example, the extension host can be reviewed separately from adaptive keyboard
and fullscreen changes.

## Excluded extension layer

Do not include installed extension directories, their source material,
extension-specific authoring tools or extension-specific validation assertions
in a core NeoKeys pull request.

Before preparing an upstream branch, use an empty extension registry, retain
the generic tests, run `npm run check`, and browser-test the core demo tracks.
Core should render the default `NeoKeys` branding without any extension
packages present.
