# LearnSprunki

LearnSprunki is a tablet-first music-learning project built around two separate
applications and one shared content format:

- `apps/player`: the NeoKeys-derived learner PWA;
- a future authoring workshop for producing reviewed Sprunki and non-Sprunki
  MIDI lesson packs;
- `packages/content-schema`: the shared, versioned song catalogue contract;
- `Research`: product, architecture, transcription and delivery research.

## Player

```bash
cd apps/player
npm install
npm run dev
```

Open `http://127.0.0.1:4173`.

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
LearnSprunki branding and tablet fullscreen controls. Its source is split into
HTML, CSS and JavaScript, and its song menu is generated from an external JSON
catalogue containing paths to ordinary MIDI files.
