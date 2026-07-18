# Architecture

LearnSprunki is a NeoKeys distribution composed from a reusable player core and
independently loaded extensions.

```text
apps/player/
├── app.js                         NeoKeys playback and UI runtime
├── index.html                     Core page with generic mount points
├── styles.css                     Core presentation only
├── core/
│   ├── extension-host.js          Extension registry and lifecycle
│   └── keyboard-range.js          Pure adaptive-keyboard logic
├── content/                       Core demo MIDI catalogue
├── extensions/
│   ├── registry.json              Enabled extensions
│   └── learn-sprunki/             Product-specific extension package
└── tests/                         Unit, integration and boundary tests
```

## Boundary

NeoKeys core owns MIDI parsing, playback, audio, the piano, modes, scoring,
recording, fullscreen, keyboard sizing, the ordinary track menu and the render
loop. It knows only the generic extension lifecycle.

The Learn Sprunki extension owns its branding, character/game browser, phase
model, character animation, reference WAV playback, loop policy, rhythm pad,
particles, lesson themes, catalogues, schemas and assets.

Core never imports `extensions/learn-sprunki`. It discovers enabled extensions
through `extensions/registry.json`. The architecture test fails if a Sprunki
name or direct product-extension path appears in core source.

## Runtime sequence

1. NeoKeys loads its three demo tracks from `content/catalog.json`.
2. `ExtensionHost` reads `extensions/registry.json`.
3. Each manifest is validated, its stylesheet is attached and its entry module
   is imported.
4. The entry module receives a frozen core API and mounts its own UI.
5. When any track loads, the host asks each extension whether it handles that
   track and activates at most one track controller.
6. Core delegates optional custom rendering, input, looping and per-frame work
   to that controller without knowing the extension's domain.

This makes the fullscreen, adaptive keyboard, tablet performance work and
extension host plausible upstream contributions to NeoKeys, while the Sprunki
product remains a separate package.
