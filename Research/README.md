# Sprunki Piano research

Research date: 18 July 2026

## Conclusion

The idea is technically feasible, and the supplied assets are already organised well enough for a strong first content pack. The best shape is two separate applications joined by a shared content-pack format:

1. **LearnSprunki Player:** a NeoKeys-derived progressive web app (PWA) for choosing a game, character and phase, then learning a curated MIDI arrangement with falling notes;
2. **Song Authoring Workshop:** an initially command-line local tool that inventories sources, coordinates NeuralNote/Basic Pitch or imported MIDI/MusicXML, and later extracts Scratch `.sb3` files into reviewable content packs;
3. human approval of every generated MIDI before it reaches learners.

Keep both applications in one repository initially so they share the same schemas and fixtures, while keeping their runtime dependencies and entry points separate. The Workshop can gain a small local UI later for tasks that genuinely benefit from listening or visual editing.

Do **not** fork MIDIano. Its repository says that the public code is outdated and “not open source”; there is no licence file. Now that this project is explicitly non-commercial, NeoKeys is a viable starting point under CC BY-NC 4.0. Fork it for the MVP, contribute generic improvements upstream in small pull requests, and progressively extract its monolithic player into modules while adding the Sprunki-specific content and animation layer in the fork.

Use NeuralNote for the first interactive transcription and cleanup experiments, and Spotify Basic Pitch Python for later repeatable batch processing. NeuralNote uses the Basic Pitch model rather than a different, more accurate model; its advantage is the native piano-roll, threshold, range and quantisation workflow. Do not treat WAV-to-MIDI as a universal one-click conversion: drums need onset/rhythm detection, and vocals/noise/effects will often need manual arrangement or a “listen only” classification.

## Recommended first slice

Build one polished vertical slice before importing more mods:

- game: original Sprunki;
- character: Gold/Garnold, phase 1;
- source: `arpeg.wav`;
- lesson: a manually checked, quantised MIDI loop;
- inputs: responsive pointer/multi-touch piano; external keyboards are optional future adapters;
- tablet mode: an explicit fullscreen control, followed later by installed-PWA display mode;
- modes: listen, practise at fixed speed, and wait-for-correct-note;
- visuals: Garnold’s phase-1 SVG frames, gold note lanes, and a high-contrast fallback palette.

Garnold is a good test because an arpeggio is well suited to Basic Pitch and exposes timing, looping and animation synchronisation without the ambiguity of drums or voice.

## Documents

- [Product and UX](./01-product-and-ux.md)
- [Technical architecture](./02-technical-architecture.md)
- [Import and audio-to-MIDI pipeline](./03-import-and-transcription.md)
- [Local asset audit](./04-local-asset-audit.md)
- [Licensing, risks and sources](./05-licensing-risks-and-sources.md)
- [NeoKeys assessment](./06-neokeys-assessment.md)
- [NeuralNote versus Basic Pitch](./07-neuralnote-vs-basic-pitch.md)
- [Sheet music to MIDI](./08-sheet-music-to-midi.md)
- [NeoKeys fork and content delivery](./09-neokeys-fork-and-content.md)
- [Phased project plan](./10-project-plan.md)

## Go/no-go gates

Proceed to a full MVP if the vertical slice proves all four:

- Basic Pitch plus cleanup can produce a recognisable and comfortable arrangement in less than about 20 minutes of curator time per pitched loop.
- Audio, MIDI notes and SVG animation stay aligned over repeated loops.
- touch input, orientation changes and fullscreen mode feel reliable on the target tablet.
- the original and mod asset provenance can be recorded with adequate attribution and permission.
