# NeoKeys fork and content delivery

## Decision

Fork NeoKeys for the non-commercial MVP and refactor it incrementally. Do not begin with a rewrite. First preserve its current behaviour in a buildable project, then extract testable modules and add the Sprunki-specific layer.

Use two repositories:

1. **Sprunki Piano app:** the NeoKeys fork, player engine, PWA shell, input handling, animation/theme system and schemas.
2. **Sprunki Piano content:** small, versioned manifests and approved MIDI lessons. The app consumes a published catalogue from this repository.

This separation lets lesson corrections and new collections ship without changing the player. It also lets other catalogue URLs be added later. Do not make the browser write directly to GitHub: that would require account credentials and creates unnecessary publishing/security complexity. Custom files should save locally, then a curator can publish reviewed content through the normal Git workflow.

## Refactoring sequence

Keep each step behaviour-preserving and reviewable:

1. add `package.json`, Vite, pinned npm dependencies and an attribution notice;
2. move inline CSS to stylesheets and inline JavaScript to ES modules without redesigning the UI;
3. extract transport/time, MIDI parsing, renderer, audio engine, input and practice/scoring modules;
4. add unit tests for MIDI timing, wait mode, scoring and keyboard mappings;
5. replace inline base64 sample songs with a catalogue loader;
6. harden touch/multi-touch input and add tablet fullscreen while retaining optional Web MIDI;
7. add the PWA manifest, service worker, offline cache and IndexedDB progress/custom-track storage;
8. add Sprunki collection, phase, animation and colour-theme adapters;
9. add authoring/import tools outside the learner bundle.

Proposed source shape:

```text
src/
  app/
  audio/
  catalogue/
  input/
    pointer.ts
    web-midi.ts
  midi/
  practice/
  renderer/
  sprunki/
  storage/
  transport/
  ui/
```

Generic improvements should be offered upstream as small pull requests: tablet fullscreen, touch hardening, behaviour-preserving file extraction, tests, the generic catalogue interface and PWA plumbing. Keep Sprunki assets, collection/phase rules and content policy in this fork.

## Remote content catalogue

The content repository should publish immutable, versioned packs plus a small root catalogue:

```text
catalog.json
schemas/
  catalog.schema.json
  collection.schema.json
collections/
  original-sprunki/
    manifest.json
    garnold/
      phase-1/
        lesson-full.mid
        lesson-easy.mid
        lesson.json
```

The root catalogue lists collection manifests, versions, compatibility, size and integrity hashes. Each collection manifest records character, phase/variant, theme colours, animation references, reference-audio timing, lessons, source, creator, licence and review state.

Keep MIDI and JSON in ordinary Git because they are small and diffable/versionable. Avoid filling Git history with large WAV files and animation bundles. Initially package the original assets with the app or attach large, immutable content archives to tagged releases. Git LFS adds quotas and operational friction and should not be the default distribution mechanism.

Publish the catalogue through GitHub Pages or release assets, not `raw.githubusercontent.com` as the production endpoint. The player should:

- fetch a configurable catalogue URL;
- validate manifests against bundled schemas;
- verify hashes before activating a downloaded pack;
- cache installed packs for offline play;
- continue showing the last valid cached catalogue if the network fails;
- allow a local `.mid` file or content pack to be opened without publishing it;
- save custom tracks, settings and progress in IndexedDB;
- export custom MIDI/content metadata as a download for later curation.

Remote content must never execute JavaScript. Treat manifests as untrusted data, enforce size/type limits and render text as text rather than HTML.

## Versioning

Give the app and content schema independent semantic versions. A catalogue entry should declare a minimum/maximum supported schema or player version. Published pack URLs should be immutable; a new lesson correction gets a new pack version rather than overwriting cached content.

For the first milestone, a single built-in collection can use the same manifest format as remote packs. That proves the boundary without making the vertical slice depend on hosting infrastructure.

## First implementation milestone

The first fork milestone should stop after these outcomes:

- NeoKeys runs from modules under Vite with visual behaviour unchanged;
- its three samples load through a local catalogue rather than inline base64;
- local MIDI import still works;
- touch works reliably through a normalized input API, with existing Web MIDI retained as optional;
- Garnold phase 1 can be loaded from a manifest with animation and a gold theme;
- the app installs and reloads offline on the target tablet.

Only after that should the separate content repository and remote catalogue be introduced.
