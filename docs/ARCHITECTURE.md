# Architecture

NeoKeys consists of a reusable player core and independently loaded
extensions.

```text
apps/player/
├── app.js                         Playback and UI runtime
├── index.html                     Core page with generic mount points
├── styles.css                     Core presentation only
├── core/
│   ├── extension-host.js          Extension registry and lifecycle
│   └── keyboard-range.js          Pure adaptive-keyboard logic
├── content/                       Core demo MIDI catalogue
├── extensions/
│   ├── registry.json              Enabled extension manifests
│   └── <extension-id>/            Self-contained extension package
└── tests/                         Unit, integration and boundary tests
```

## Boundary

NeoKeys core owns MIDI parsing, playback, audio, piano rendering, modes,
scoring, recording, fullscreen, keyboard sizing, the standard track menu and
the render loop. It knows only the generic extension lifecycle.

Each extension owns its domain model, branding, controls, overlays, custom
media, catalogues, schemas and assets. Core never imports a particular
extension. It discovers enabled packages through `extensions/registry.json`.

## Runtime sequence

1. NeoKeys loads its demo tracks from `content/catalog.json`.
2. `ExtensionHost` reads `extensions/registry.json`.
3. Each manifest is validated, its stylesheet is attached and its entry module
   is imported.
4. The entry module receives a frozen core API and mounts its own UI.
5. When any track loads, the host asks each extension whether it handles that
   track and activates at most one track controller.
6. Core delegates optional custom rendering, input, looping and per-frame work
   to that controller without knowing the extension's domain.

This boundary keeps reusable player improvements suitable for upstream review
while allowing complete products to be delivered as extension packages.
