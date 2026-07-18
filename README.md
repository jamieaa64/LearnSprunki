# NeoKeys

This repository packages NeoKeys as a reusable, tablet-friendly music-learning
player with independently loaded extensions.

- `apps/player`: the NeoKeys web application and generic extension host;
- `apps/player/extensions`: independently packaged optional features and
  lesson libraries;
- `docs`: generic architecture, extension-authoring and testing documentation.

Extensions are enabled by `apps/player/extensions/registry.json` and loaded
from validated manifests. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/EXTENSIONS.md`](docs/EXTENSIONS.md), and
[`docs/TESTING.md`](docs/TESTING.md).

## Run the player

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

Import the repository and configure:

- Root Directory: `apps/player`
- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`

The app-level `vercel.json` also records the build and output settings.
