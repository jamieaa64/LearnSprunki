# Learn Sprunki extension

This directory is the complete LearnSprunki product layer for NeoKeys. Removing
its entry from `../registry.json` produces a normal NeoKeys player containing
only the core demo songs.

It owns:

- Original Sprunki game, character and phase manifests;
- 30 draft piano/rhythm lessons and their MIDI, WAV and SVG assets;
- the character chooser and active-character presentation;
- reference-loop playback, Sprunki-only infinite looping and rhythm-pad input;
- lesson themes, instruments and note-particle effects;
- the Sprunki content schemas.

Run `node tools/authoring/build-original-game.mjs` from the repository
root after changing the Original Sprunki authoring plan or source assets. Then
run `npm run check` in `apps/player`.

See [`../../../../docs/EXTENSIONS.md`](../../../../docs/EXTENSIONS.md) for the generic
extension contract.
