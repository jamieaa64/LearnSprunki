# Licensing, risks and sources

This is product research, not legal advice.

## Main licensing finding

The project owner has stated that the Sprunki music intended for this project is Creative Commons licensed. That is encouraging and removes the assumption that the audio is proprietary, but the source ledger still needs the exact licence variant, creator, attribution text and source URL for each collection. Art, animation, backgrounds and code must be recorded separately because an audio licence does not automatically cover them.

“Downloadable”, “public source” and “open source” are not interchangeable. The local asset pack has no accompanying licence or attribution file, and the supplied itch.io page lists a downloadable `.sb3` but does not state a licence on that page. Establish permission and provenance per collection before shipping its art, audio or derived MIDI.

Scratch says projects shared on its website are covered by a Creative Commons ShareAlike licence and require credit for remixes. That may help for a project actually shared on Scratch, but it does not establish that every itch.io archive was uploaded by the rights holder, that every included asset was theirs to license, or that the same terms automatically apply to a file only found elsewhere. Record the original Scratch project/creator where possible, preserve attribution chains, and flag uncertain packs rather than publishing them.

Derived MIDI can itself be an adaptation of the source composition. Treat it as part of the licensed content pack, distinct from the app’s code. Keeping content packs separate makes attribution, removal and share-alike obligations easier to manage.

Also check names/logos/trademarks and whether an Incredibox-derived mod has separate restrictions. A safe product should clearly be unofficial and avoid implying endorsement.

## Dependency decisions

| Project | Licence/status | Decision |
|---|---|---|
| MIDIano | Repository explicitly says “not open source”; no licence file found | Do not copy/fork; UX reference only |
| NeoKeys | CC BY-NC 4.0 | Viable MVP fork because this project is non-commercial; preserve attribution and refactor incrementally |
| NeuralNote | Apache-2.0 | Recommended interactive Basic Pitch transcription/cleanup tool; optional native authoring-engine source |
| Spotify Basic Pitch (Python/TS) | Apache-2.0 | Recommended transcription dependency |
| Tone.js | MIT | Recommended candidate for scheduling/audio |
| `@tonejs/midi` | MIT | Recommended for MIDI parsing/writing |
| Openthesia | GPL-3.0, Windows/.NET desktop | Useful reference; not a PWA base |
| Scratch parser/VM | AGPL-3.0 | Avoid unless AGPL compatibility is intentional; a small importer is sufficient |
| Songscription | Hosted commercial service, not an open-source dependency | Optional manual fallback only |

Retain third-party notices and pin exact dependency/model versions. Review licences again when implementation begins because repository status can change.

## Product and technical risks

| Risk | Impact | Mitigation |
|---|---|---|
| Asset ownership/provenance unclear | Takedown or inability to distribute | Source ledger, attribution, rights-holder confirmation, removable packs |
| Auto-transcription errors | Learners practise wrong notes | Human review and sonified comparison; never auto-publish |
| Percussion/FX do not map to piano | Confusing lessons | Separate rhythm-lane and listen-only modes |
| MIDIano cannot be reused | Architectural rework if discovered late | Build a small player on licensed libraries |
| Web MIDI unavailable/denied | Optional hardware keyboard cannot connect | Feature detection; touch remains the complete primary input |
| Audio/animation drift | Character looks disconnected | One audio transport clock; derive frames from time |
| `.sb3` is hostile or huge | Path traversal, decompression bomb, browser crash | Local-only staging, strict archive limits, validation and no script execution |
| Phase naming varies by mod | Incorrect collection structure | Generic ordered variants plus curator mapping |
| Horror/gore presented to children | Safety and audience concern | Content labels, default filters and parental/content controls |
| PWA cache becomes large | Slow installs/storage eviction | Catalogue-first downloads, per-pack caching, hashes and cleanup UI |

## Primary and direct sources

Accessed 18 July 2026.

- [MIDIano repository](https://github.com/Bewelge/MIDIano) — features, browser claims, and the author’s explicit “not open source” notice.
- [NeoKeys repository](https://github.com/ArtinSHF/NeoKeys) — web player implementation, features, CC BY-NC 4.0 licence and single-file architecture.
- [NeuralNote repository](https://github.com/DamRsn/NeuralNote) — native Basic Pitch implementation, interactive transcription workflow, reuse guidance and Apache-2.0 licence.
- [Spotify Basic Pitch](https://github.com/spotify/basic-pitch) — Python usage, model limitations, supported audio and Apache-2.0 licence.
- [Spotify Basic Pitch TypeScript](https://github.com/spotify/basic-pitch-ts) — browser/TypeScript implementation and Apache-2.0 licence.
- [Tone.js](https://github.com/Tonejs/Tone.js) — Web Audio scheduling/synthesis and MIT licence.
- [`@tonejs/midi`](https://github.com/Tonejs/Midi) — MIDI parsing/writing format and MIT licence.
- [Openthesia](https://github.com/ImAxel0/Openthesia) — alternative player features, desktop architecture and GPL-3.0 licence.
- [Scratch parser](https://github.com/scratchfoundation/scratch-parser) — official validation/parsing project and AGPL-3.0 licence.
- [Scratch remixing help](https://mitscratch.freshdesk.com/en/support/solutions/articles/4000156850-remixing-what-is-it-and-why-can-every-project-on-scratch-be-remixed-) — Scratch’s explanation of remixing, credit and ShareAlike licensing.
- [Web MIDI specification](https://www.w3.org/TR/webmidi/) — secure-context, permission and API scope.
- [MDN MIDI permissions policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/midi) — limited availability and permissions-policy behaviour.
- [Supplied Definitive Phase 3 itch.io page](https://vibegtag.itch.io/incredibox-sprunki-definitive-phase-3) — browser build and 21 MB downloadable `.sb3`; no licence statement visible on the page.
- [Songscription](https://www.songscription.ai/) — current advertised instruments, short free transcriptions, editor and export formats.

## Questions to resolve before public release

- Where exactly did the current `SprunkiAssets` pack come from, and under what terms?
- Who created each original/modded character, sound and animation?
- Was each imported `.sb3` shared on Scratch by the creator, and what is its project URL/remix ancestry?
- Is commercial use intended? This affects acceptable dependencies, model data and content permissions.
- Should horror phases be a separate opt-in pack or available behind an in-app filter?
- What attribution text and links must be visible in the catalogue and pack details?
