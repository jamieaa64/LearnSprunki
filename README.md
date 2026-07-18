# LearnSprunki

LearnSprunki is a tablet-first music-learning project built as a reusable
NeoKeys core plus a separately packaged Learn Sprunki extension:

- `apps/player`: the NeoKeys-derived learner PWA and generic extension host;
- `apps/player/extensions/learn-sprunki`: all Sprunki UI, behaviour, schemas and
  lesson assets;
- a future authoring workshop for producing reviewed Sprunki and non-Sprunki
  MIDI lesson packs;
- `Research`: product, architecture, transcription and delivery research.

The core has no direct dependency on Learn Sprunki. Extensions are enabled by
`apps/player/extensions/registry.json` and loaded from validated manifests. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/EXTENSIONS.md`](docs/EXTENSIONS.md), and
[`docs/TESTING.md`](docs/TESTING.md). The intended upstream patch boundary is
listed in [`docs/UPSTREAMING.md`](docs/UPSTREAMING.md).

## Player

```bash
cd apps/player
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

Run the complete automated check before committing player changes:

```bash
npm run check
```

The player is derived from
[ArtinSHF/NeoKeys](https://github.com/ArtinSHF/NeoKeys) commit
`50235a332ddcffb0a3567f48a77d8c6b6d70f07e` under CC BY-NC 4.0. See
`apps/player/LICENSE` and `apps/player/README.md` for attribution and details.

## Vercel

Import `jamieaa64/LearnSprunki` and configure:

- Root Directory: `apps/player`
- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`

The app-level `vercel.json` also records the build/output settings.

## Project status

The current player is an attributed, locally packaged NeoKeys baseline with
tablet fullscreen controls, adaptive keyboards and a generic extension
lifecycle. LearnSprunki branding and product behaviour are applied by the
separate extension at runtime.

Original Sprunki currently contains 30 generated draft lessons: 20 pitched
Basic Pitch transcriptions and 10 rhythm-pad lessons. Drafts must be reviewed
before promotion to approved lessons.
