# Technical architecture

## Recommended separation

```text
Authoring Workshop (local CLI first; optional UI later)
  WAV / image / MIDI / MusicXML / SB3
       → inspect → classify → transcribe → review → validate
                                                    ↓
                                          versioned content pack
                                                    ↓
LearnSprunki Player (NeoKeys-derived PWA)
  catalogue → lesson player → Web Audio transport → notes + animation
                                ↑
                   touch (optional Web MIDI retained)
```

These are two separate applications with one shared contract:

1. **LearnSprunki Player** is the polished learner-facing PWA. It plays already-approved lessons and never runs Basic Pitch or imports hostile Scratch archives.
2. **Song Authoring Workshop** is a local curator tool. It manages sources, runs or coordinates transcription, supports manual corrections, and emits validated content packs. Its first useful version can be command-line scripts plus human-operated NeuralNote/MuseScore/Codex steps; it does not need a polished interface.

Keep transcription out of the learner’s critical path. It is compute-heavy, imperfect and unnecessary after a lesson has been approved. The PWA should download compact, already validated content packs and work offline after installation. The workshop may depend on Python/native tools without forcing those dependencies onto tablets or learners.

Keep the applications in one repository initially, but give them separate entry points, dependencies and tests. A shared `content-schema` package prevents the workshop from generating data the player cannot read. Split repositories only if release cadence, contributors or dependency weight later justify it.

## Player recommendation

Fork NeoKeys for the non-commercial MVP rather than forking MIDIano. Evolve it toward:

- TypeScript with a current web UI framework or small component layer;
- Canvas for the scrolling piano roll (DOM nodes become expensive when many notes are visible);
- Web Audio for playback and the master clock;
- Tone.js (MIT) for scheduling/synthesis if it reduces implementation time;
- `@tonejs/midi` (MIT) for reading/writing Standard MIDI Files;
- the existing native Web MIDI adapter retained as an optional feature, not an MVP requirement;
- SVG `<img>` frames or predecoded images for character animation;
- IndexedDB/Cache Storage for downloaded content and progress;
- a service worker and web app manifest for PWA behaviour.

MIDIano demonstrates the right feature set—falling bars, wait mode, MIDI input and track colours—but its repository explicitly says it is not open source. [NeoKeys](https://github.com/ArtinSHF/NeoKeys) is a closer and prettier web implementation with falling notes, wait mode, scoring, MIDI hardware I/O and recording. It is a 3,307-line single-file app licensed CC BY-NC 4.0 and has no computer-keyboard input, test suite, PWA layer or modular content system. The non-commercial restriction is acceptable for this project, so forking is now a pragmatic way to reach an MVP, provided the monolith is progressively refactored and attribution is retained. Openthesia is genuinely GPL-3.0, but is a Windows/.NET desktop application rather than a PWA and would pull this project away from the intended architecture.

### Upstream contribution strategy

Keep commits small enough for the NeoKeys maintainer to review independently:

1. add a tablet fullscreen control and harden touch/pointer cancellation;
2. extract CSS and JavaScript from `index.html` without changing behaviour;
3. introduce a data-driven track catalogue instead of inline UI entries;
4. add basic automated tests around touch input and practice-mode state;
5. add a web app manifest and service worker;
6. add generic theme/animation extension points.

Contribute those generic changes upstream. Keep Sprunki assets, its collection/phase schema and horror-content policy in the Sprunki Piano fork unless NeoKeys explicitly wants a general content-pack system. Discuss the modularisation direction in an issue before sending a large structural pull request.

## Timing model

Use a single transport time in seconds or ticks. On each animation frame:

1. query audio-context/transport time;
2. calculate which MIDI notes fall inside the visible look-ahead window;
3. calculate character frame as `(transportTime + phaseOffset) mod loopDuration`;
4. render both from that time;
5. evaluate user input against expected note events using calibrated input time.

Schedule audio slightly ahead using the Web Audio clock. Do not schedule musical events with ordinary `setTimeout` callbacks.

Wait mode needs a logical playhead separate from wall-clock time: stop advancement at the next required event, accept the expected note set, then resume while keeping audio and animation aligned.

## Inputs and support

- Pointer/multi-touch piano: primary and required learner input.
- Tablet fullscreen: required browser mode, with installed-PWA display mode following later.
- MIDI keyboard: inherited optional NeoKeys feature where `navigator.requestMIDIAccess()` exists.
- Computer keyboard: deliberately deferred; it is not required for the tablet-first MVP.

Web MIDI requires a secure context and permission, and MDN marks it as limited availability. Feature-detect it and keep the app complete without it. Do not let optional MIDI permission block touch-only startup.

Add latency calibration: play/flash a short pulse, let the learner tap with it, estimate their offset, and apply it only to scoring—not audio scheduling.

## Content-pack model

Use stable IDs and explicit provenance. A compact conceptual schema is:

```ts
type Collection = {
  id: string;
  title: string;
  version?: string;
  source: SourceRecord;
  characters: Character[];
};

type Character = {
  id: string;
  name: string;
  sortOrder: number;
  variants: Variant[];
};

type Variant = {
  id: string;
  label: string;             // "Phase 1", "Horror", "Normal"
  order: number;
  contentRating?: string;
  theme: Theme;
  animation: Animation;
  performances: Performance[];
};

type Performance = {
  id: string;
  title: string;
  role: "pitched" | "percussion" | "vocal" | "effect" | "mixed";
  sourceAudio: AssetRef[];
  loop: { start: number; end: number; bpm?: number; beats?: number };
  lessons: Lesson[];
};

type Lesson = {
  id: string;
  midi: AssetRef;
  difficulty: "easy" | "full";
  inputMode: "piano" | "rhythm";
  playableRange?: [number, number];
  reviewed: boolean;
  transcription: TranscriptionRecord;
};
```

`SourceRecord` should preserve creator, source URL, retrieved date, licence claim, attribution text and SHA-256. `TranscriptionRecord` should preserve tool/version, parameters, human editor, review status and relationship to the source WAV.

Do not infer collection or phase from folder names at runtime. Generate a manifest during import; filenames can change without breaking IDs.

## Suggested repository shape after prototyping

```text
apps/
  player/                  # NeoKeys-derived learner PWA
  workshop/                # optional thin local authoring UI
tools/
  authoring-cli/           # inventory, pack creation and validation
  transcription/           # Python Basic Pitch adapters
  scratch-import/          # later SB3 extraction/staging
packages/
  content-schema/          # schema and validators
  lesson-engine/           # transport, scoring and input mapping
content/
  original-sprunki/
workbench/
  sources/                 # local inputs; not automatically published
  drafts/                  # generated MIDI/MusicXML and reports
Research/
```

The workshop should call tools through adapters rather than baking one transcription engine into its data model. A source can produce several draft candidates: NeuralNote/Basic Pitch from audio, imported MIDI/MusicXML from a service, manual entry, or later sheet-image recognition. All candidates converge on the same review and pack-validation stages.

## Validation and tests

- manifest JSON Schema validation;
- missing asset/hash checks;
- MIDI event bounds, negative duration and playable-range checks;
- deterministic animation/frame ordering (`anim2` before `anim10`);
- transport drift test over at least 100 loops;
- note-on/note-off and lost-focus tests for every input;
- wait-mode chord and sustain-pedal tests;
- PWA offline reload test;
- corrupted/hostile `.sb3` fixture tests for the importer.
