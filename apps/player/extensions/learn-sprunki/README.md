# Learn Sprunki extension

This directory is the complete LearnSprunki product layer for NeoKeys. Removing
its entry from `../registry.json` produces a normal NeoKeys player containing
only the core demo songs.

It owns:

- Original Sprunki game, character and phase manifests;
- 30 draft piano/rhythm lessons and their MIDI, WAV and SVG assets;
- the character chooser and active-character presentation;
- reference-loop playback, Sprunki-only infinite looping and rhythm-pad input;
- an eleven-piece top-down touch drum kit with General MIDI lanes and keyboard shortcuts;
- lesson themes, instruments and note-particle effects;
- the Sprunki content schemas and validator;
- product research, source assets and authoring tools.

## Package layout

```text
learn-sprunki/
├── extension.json, extension.js, styles.css
├── validate.mjs             Product-specific content validation
├── content/                 Runtime manifests and published lesson assets
├── schema/                  Product content schemas
├── source-assets/           Original input assets
├── authoring/               Transcription and generation tools
└── docs/research/           Product and technical research
```

Run
`node apps/player/extensions/learn-sprunki/authoring/build-original-game.mjs`
from the repository root after changing the authoring plan or source assets.
Then run `npm run check` in `apps/player`.

## Drum controls

Rhythm lessons replace the piano with a top-down kit. Falling notes align with
the matching kick, snare, tom, hi-hat, crash or ride. Closed, open and pedal
hi-hats have distinct targets. The focused sound for a simple
single-part lesson is outlined in the character colour, while the complete kit
remains playable.

Keyboard shortcuts are `F` kick, `J` snare, `D` closed hi-hat, `E` open
hi-hat, `C` pedal hi-hat, `G`/`H`/`T` high, mid and low toms, `S` floor tom,
`K` ride and `L` crash. Space plays the lesson's primary piece.

See [`../../../../docs/EXTENSIONS.md`](../../../../docs/EXTENSIONS.md) for the generic
extension contract.
