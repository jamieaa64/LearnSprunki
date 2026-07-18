# NeoKeys assessment

Assessed repository: [ArtinSHF/NeoKeys](https://github.com/ArtinSHF/NeoKeys)

Assessment date: 18 July 2026

Assessed commit: `50235a332ddcffb0a3567f48a77d8c6b6d70f07e`

## Verdict

NeoKeys is a much better **visual and interaction reference** than MIDIano, and it proves that most of the lesson-player experience can be built directly with Canvas, Web MIDI, Tone.js and `@tonejs/midi`. Because Sprunki Piano is explicitly non-commercial, NeoKeys is also a viable MVP foundation under its current licence.

The two main constraints are:

1. its CC BY-NC 4.0 licence requires this fork to remain non-commercial unless separate permission is obtained;
2. almost the whole application—HTML, CSS, three embedded MIDI files and JavaScript—is contained in one 180 KB, 3,307-line `index.html`.

The stated non-commercial goal removes the first blocker. Preserve attribution and licence notices in the fork. If donations, advertising, paid content, sponsorship or another commercial path is later considered, pause and obtain separate permission rather than assuming it remains within the licence.

## What it gets right

- visually polished cyber/neon Canvas piano roll;
- responsive 88-key on-screen piano;
- falling-note and upward free-play visualisations;
- local MIDI file loading;
- hardware MIDI input and output pass-through;
- wait-for-correct-note practice mode;
- timing score, wrong-note penalties and performance review;
- left/right-hand inference;
- timeline scrubbing;
- four Tone.js instruments;
- live MIDI recording and `.mid` export;
- pointer/touch interaction;
- inline built-in songs that need no separate MIDI download.

These are useful implementation examples for the renderer, MIDI event handling, practice-state logic and visual polish. The Sprunki product should borrow the **ideas**, replacing the generic cyber-neon identity with per-character themes and synchronised character animation.

## Why computer-keyboard play did not work

NeoKeys supports two learner inputs in its current source:

- a hardware MIDI device through `navigator.requestMIDIAccess()`;
- pointer/touch interaction with the on-screen piano.

The source contains no `keydown`, `keyup` or `KeyboardEvent` handling, so ordinary QWERTY/AZERTY computer-keyboard play is not implemented. This is not a browser configuration problem.

If by “keyboard” you meant a USB/Bluetooth MIDI piano, NeoKeys requires a Web MIDI-compatible browser, a secure/allowed page, explicit permission and a visible MIDI input device. LearnSprunki is now tablet-first, so touch is the required input and the inherited Web MIDI path is optional. Computer-keyboard input is no longer an MVP requirement.

## Sample tracks

The current interface contains three bundled pieces:

- Moonlight Sonata;
- Für Elise;
- Clair de Lune.

It also accepts a local MIDI file, so the small built-in catalogue is not an engine limitation. For Sprunki Piano the catalogue must come from versioned content manifests rather than MIDI blobs hard-coded into the application source.

## Engineering assessment

| Area | NeoKeys now | Sprunki Piano need |
|---|---|---|
| Application structure | One `index.html`; no `package.json` | Modules/packages with typed boundaries |
| Rendering | Canvas, attractive and responsive | Reusable Canvas renderer plus character layer |
| MIDI parsing | `@tonejs/midi` 2.0.28 | Suitable; bundle and pin it |
| Audio | Tone.js 14.8.49 | Suitable candidate; bundle and pin it |
| MIDI export | MidiWriterJS 2.1.4 | Optional curator/free-play feature |
| Hardware input | Native Web MIDI in/out | Keep, with permission UX and fallback |
| Computer keyboard | Not implemented | Required for MVP |
| Touch/pointer | Implemented | Required fallback |
| Lesson modes | Wait mode and scoring | Add listen, practise, wait and section loop |
| Catalogue | Three inline base64 MIDI files | External validated content packs |
| Character/phase model | None | Collection → character → variant → performance → lesson |
| Animation | Generic particles/notes | SVG Sprunki frames locked to audio transport |
| PWA/offline | No manifest/service worker | Required; downloadable packs and offline reload |
| Progress storage | No localStorage/IndexedDB use found | Store local learner progress |
| Automated tests | No test setup found | Transport, scoring, input and manifest tests |
| Third-party delivery | Runtime CDN scripts | Bundled, locked dependencies with notices |
| Licence | CC BY-NC 4.0 | Prefer MIT/Apache code base; content licensed separately |

The source directly loads Tone.js, `@tonejs/midi` and MidiWriterJS from CDNs. Despite the MIDI pieces being embedded, that means the app is not fully offline on a first load. A production PWA should install pinned dependencies into its build and cache its own hashed bundles.

## Maintenance signal

NeoKeys was created on 2 June 2026 and the latest assessed commit was 16 June 2026. The README calls it an actively maintained experimental portfolio project and explicitly describes it as a personal frontend-learning experiment. That is not a criticism—the result is impressive—but there is not yet enough history, contributor depth, packaging, tests or release discipline to treat it as a stable upstream platform.

The single-file design also means a future upstream update would be difficult to merge into a heavily customised Sprunki fork. Starting with separately testable components avoids becoming dependent on one maintainer or a manual fork-reconciliation process.

## Recommended use

Use NeoKeys in three ways:

1. **Design reference:** study its proportions, glow, note readability, hit-line feedback and settings layout.
2. **Prototype reference:** compare its Canvas coordinate maths, wait-mode state transitions and MIDI hot-plug handling while implementing clean equivalents.
3. **Requirements checklist:** use its recording, scrubbing, MIDI out and performance-review features as candidates for later releases.

Forking is reasonable under the stated non-commercial scope. Send generic improvements upstream as small, reviewable pull requests: begin with tablet fullscreen and touch hardening, then behaviour-preserving file extraction, tests, a data-driven catalogue and PWA support. Keep Sprunki-specific characters and content in the fork. Open an issue before a large architectural rewrite so the maintainer can guide what they are willing to merge.

## Updated recommendation

The recommendation is now:

- fork NeoKeys for the non-commercial MVP;
- progressively turn it into a modular player rather than rewriting everything first;
- take the prettier, high-feedback feel as the quality bar;
- prioritize tablet fullscreen and reliable multi-touch rather than adding computer-keyboard input;
- keep Sprunki content, animation and themes outside the player engine;
- contribute generic improvements upstream and retain the required attribution.
