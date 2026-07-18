# Project plan

## Goal

Create a tablet-first progressive web app that lets a learner choose a Sprunki collection, character and phase, then learn a reviewed playable arrangement using falling notes and the on-screen touch piano while the character animates in time.

The plan produces two separate applications joined by a versioned content-pack format:

1. **LearnSprunki Player:** a polished NeoKeys-derived PWA for learners.
2. **Song Authoring Workshop:** a local, initially command-line authoring tool for Sprunki and non-Sprunki material.

Automatic transcription is allowed to create drafts; it must not publish lessons without human review.

## Decisions already made

- Build for non-commercial use initially.
- Use NeoKeys as the MVP player foundation, preserving its CC BY-NC 4.0 attribution and licence conditions.
- Refactor NeoKeys incrementally rather than rewriting it before validating the product.
- Use NeuralNote for early interactive audio-to-MIDI experiments.
- Add Basic Pitch Python later when transcription settings need to become repeatable and batchable.
- Keep the learner app free of transcription models; transcription belongs in an authoring workflow.
- Use a collection → character → phase/variant → performance → lesson content model.
- Start with one manually checked vertical slice before importing every character or mod.
- Keep sheet-image transcription as a later authoring aid, not the first implementation step.
- Keep the Player and Workshop in one repository initially, with separate entry points and dependencies plus a shared schema package.

## Product boundaries

### LearnSprunki Player owns

- catalogue browsing and collection/character/phase selection;
- MIDI playback, falling notes, piano rendering and synchronized animation;
- listen, practise, wait and scoring modes;
- touch input through the on-screen piano;
- explicit fullscreen mode plus PWA installation, offline packs, settings and learner progress;
- strict reading and validation of approved content packs.

It does **not** run Basic Pitch, process raw WAV files, interpret sheet images, open `.sb3` archives or publish content.

### Song Authoring Workshop owns

- source inventory, hashes, provenance, licences and attribution;
- extraction/staging of supplied local assets and, later, `.sb3` archives;
- audio classification and loop metadata;
- NeuralNote/manual workflows and Basic Pitch batch adapters;
- importing MIDI/MusicXML from humans or third-party services;
- later sheet-image/OMR and Codex-skill-assisted transcription;
- audition, correction, difficulty variants and review state;
- validation and export of content packs consumed by the Player.

It can begin as CLI commands, JSON/YAML files and generated reports. A small local web UI should be added only where listening, grouping, piano-roll editing or visual asset mapping is materially easier than the command line.

### Shared contract owns

- versioned JSON schemas and validators;
- MIDI/audio/animation asset references and hashes;
- timing, difficulty, theme, content-rating and compatibility metadata;
- provenance, attribution, transcription history and review state;
- fixtures tested against both applications.

## Questions that still need evidence

These are research tasks, not reasons to stop all progress:

1. What exact Creative Commons licence, source URL, creator and attribution apply to each audio collection? “Creative Commons” does not identify the particular terms.
2. What licences and provenance apply to the character art, animations, backgrounds and UI assets separately from the music?
3. Can NeuralNote produce a usable lesson draft from representative melody, harmony, bass, percussion, vocal and effect loops, and how much cleanup time does each class require?
4. Does NeoKeys remain responsive and readable on the target tablet after character animation is added?
5. Which tablet/browser combinations provide reliable multi-touch, audio resume, orientation and Fullscreen API behaviour?
6. Is Garnold phase 1 still the best first lesson after listening to and transcribing the candidate loops?
7. Should horror phases be hidden by default, labelled, or placed in a separate opt-in pack?

## Delivery sequence

### Phase 0 — repository and evidence baseline

**Purpose:** preserve the research and make every later decision traceable.

Tasks:

1. Make `jamieaa64/LearnSprunki` the main project repository.
2. Preserve NeoKeys history by using `ArtinSHF/NeoKeys` as an `upstream` Git remote when player work begins; do not paste an unattributed copy of `index.html` into a new history.
3. Add the current research and local asset audit.
4. Add `.gitignore` rules for operating-system files, generated transcriptions, temporary extraction directories and local model caches.
5. Add a source/licence ledger template. Record one row per imported collection and distinguish audio, art and code.
6. Decide which supplied assets can be committed publicly from their exact source/licence evidence. Keep uncertain files local until that row is complete.
7. Record major decisions in a lightweight decision log.

Outputs:

- public research repository;
- repeatable asset inventory;
- provenance/licence ledger;
- explicit NeoKeys attribution and upstream strategy.

Exit gate:

- another contributor can understand the idea, sources, risks and next experiment from the repository alone.

### Phase 1 — establish both local application baselines

**Purpose:** test the two highest-risk assumptions before substantial refactoring.

#### Player baseline

Bring the current NeoKeys version into a local, attributed working tree and run it unchanged before refactoring. Record its exact upstream commit. Test it on the target tablet and at least one desktop browser:

- falling-note performance and readability;
- touch accuracy and multi-touch behaviour;
- local MIDI import;
- inherited Web MIDI behaviour as a regression check only, not an MVP dependency;
- wait mode and scoring;
- screen rotation, resizing and audio resume after backgrounding.

Create a throwaway proof that overlays one Sprunki animation and colour theme without restructuring the entire application. Measure frame rate and audio/animation drift over ten loop repetitions.

#### Workshop baseline and transcription benchmark

Create a basic authoring workbench layout for sources, drafts and reports. The first version may be a documented set of commands and templates rather than an application UI.

Choose approximately six short isolated loops representing:

- monophonic melody;
- bass;
- arpeggio or polyphonic harmony;
- percussion;
- vocal;
- effect/noise.

For each loop:

1. record duration, estimated tempo, beat count and intended teaching category;
2. run NeuralNote with recorded thresholds/range/quantisation settings;
3. time the cleanup required to produce a playable result;
4. render or audition the MIDI against the WAV;
5. score recognisability, timing, wrong/missing notes, playability and curator effort;
6. mark the result `piano`, `rhythm`, `simplified motif` or `listen only`.

Do not automate Basic Pitch immediately. First use NeuralNote interactively to discover useful settings and repeatable cleanup rules. Then add one minimal Basic Pitch command that accepts a WAV, records its tool version/parameters and places draft MIDI plus a report in the workbench. Its output must still be reviewed manually.

Outputs:

- transcription benchmark table and reviewed MIDI candidates;
- repeatable workshop directory/command convention;
- device/browser test matrix;
- locally running unmodified NeoKeys baseline tied to an upstream commit;
- one themed animation proof;
- confirmed first character, phase and loop.

Exit gate:

- at least one pitched loop becomes a recognisable, comfortable lesson in an acceptable amount of curator time;
- NeoKeys can render the lesson and character together acceptably on the target tablet.

If either fails, revisit the lesson representation or player foundation before proceeding.

### Phase 2 — content contract and lesson specification

**Purpose:** define stable boundaries before splitting the player or importing many assets.

Tasks:

1. Define JSON schemas for collection, character, phase/variant, performance and lesson.
2. Include source, creator, exact licence, attribution, hashes and review status in the schema.
3. Define lesson timing: BPM, beats, pickup, loop start/end, difficulty, playable range and optional reference audio.
4. Define theme tokens and animation timing without allowing content packs to execute JavaScript.
5. Define input-independent note events so touch is cleanly supported now and optional hardware inputs can remain adapters.
6. Define content ratings/labels for horror and gore.
7. Hand-author the first Garnold (or replacement candidate) manifest and validate it.

Outputs:

- versioned content schemas;
- example built-in content pack;
- validation fixtures;
- documented compatibility/version policy.

Exit gate:

- the first lesson can be described entirely by data rather than hard-coded character-specific branches.

### Phase 3 — develop the two applications against the contract

**Purpose:** make NeoKeys safe to extend and make content creation repeatable without prematurely building a large admin UI.

#### Player: NeoKeys foundation refactor

Work in small behaviour-preserving commits:

1. establish NeoKeys as the upstream ancestry/remote and retain attribution;
2. add `package.json`, Vite and pinned local dependencies;
3. extract CSS and JavaScript from the monolithic `index.html`;
4. split transport, MIDI, renderer, audio, input, practice/scoring, catalogue and UI modules;
5. add tests around timing, scoring, wait mode and input normalization;
6. move the bundled samples from inline base64 into the catalogue interface;
7. retain local MIDI import and MIDI recording/export.

Generic improvements should be prepared as small contributions back to NeoKeys. Discuss large structural changes with its maintainer before presenting a large pull request.

#### Workshop: authoring CLI version 1

Build small composable commands for:

1. inventorying local audio/image inputs and calculating hashes;
2. creating/editing source and licence records;
3. classifying a performance and recording loop/BPM metadata;
4. invoking a Basic Pitch adapter with recorded parameters;
5. importing an externally edited MIDI or MusicXML result;
6. validating MIDI bounds, timing and the shared manifest;
7. staging an approved pack for the Player.

Keep NeuralNote and MuseScore as human-operated external tools at this stage. The CLI should record their outputs and provenance without attempting to reproduce their editors.

Exit gate:

- the existing NeoKeys samples and modes behave equivalently from modular source;
- core timing and scoring logic has automated tests;
- upstream updates can still be understood and reconciled;
- the Workshop can turn one known local source into a validated draft pack through documented repeatable commands;
- generated drafts cannot accidentally be marked reviewed or published.

### Phase 4 — first playable Sprunki vertical slice

**Purpose:** deliver the smallest complete product experience.

Scope:

- one collection;
- one character;
- one non-horror phase;
- one full and optionally one easy lesson;
- listen, practise and wait-for-correct-note modes;
- responsive multi-touch piano input;
- a fullscreen entry/exit control suitable for tablet browsers;
- synchronized character animation and theme;
- PWA installation and offline reload;
- local settings and progress.

Tasks:

1. harden pointer/multi-touch input and prevent stuck notes after pointer cancellation;
2. load the lesson and character through the Phase 2 manifest;
3. drive MIDI playback and animation from one transport clock;
4. apply accessible character-derived theme tokens;
5. add section looping, speed control and clear input/device guidance;
6. store progress/settings locally;
7. add manifest/service-worker caching for the built-in slice;
8. test first and tenth loop synchronization on the target tablet.

Exit gate:

- a new learner can install the app, choose the lesson and complete it without developer assistance;
- the learner can enter and exit fullscreen without accidentally invoking browser menus during play;
- it works offline after installation;
- audio, falling notes and animation remain synchronized;
- the lesson has been musically reviewed.

This is the first meaningful MVP release.

### Phase 5 — expand the Workshop across the original collection

**Purpose:** learn the real editorial workflow before automating imports.

Tasks:

1. classify and deduplicate the original collection's performances;
2. create approved lesson candidates with NeuralNote/manual cleanup;
3. use rhythm lanes for percussion and explicit simplified/listen-only decisions for unsuitable material;
4. map Phase 1 and Phase 2 art/animation manually;
5. complete attribution, content labels and review status;
6. add a curator checklist and pack validator;
7. add Basic Pitch batch commands only for proven repeatable operations.

Exit gate:

- one complete collection is usable;
- the time and failure modes of creating each content type are known;
- no lesson is published without review and provenance metadata.

### Phase 6 — Scratch `.sb3` importer

**Purpose:** reduce repetitive extraction work for later mod collections.

Build the importer only after the manual process reveals what must be automated:

1. accept a local user-supplied `.sb3` file;
2. safely inspect its ZIP contents and `project.json`;
3. inventory referenced sounds and costumes by target;
4. deduplicate by hash and emit previews/contact sheets;
5. suggest character/phase groupings using names and Scratch relationships;
6. require curator confirmation;
7. route audio through the established authoring categories;
8. emit a staged, validated content pack rather than publishing directly.

Exit gate:

- the importer shortens authoring without weakening human review, licence records or archive safety.

### Phase 7 — downloadable catalogue and multiple collections

**Purpose:** update content independently from the player.

Begin with the built-in manifest format already proven by the MVP. Then:

1. create a separate small content repository for manifests and approved MIDI;
2. publish versioned catalogues through GitHub Pages or immutable release assets;
3. validate schemas and hashes before activating a pack;
4. cache installed packs in IndexedDB/Cache Storage;
5. keep the last valid catalogue available offline;
6. support configurable catalogue URLs and local pack/MIDI import;
7. distribute large WAV/animation archives outside ordinary Git history.

The browser should not write directly to GitHub. Curators export locally and publish through reviewed Git changes.

Exit gate:

- a new collection can be published without releasing a new app build;
- an installed collection remains playable without network access;
- malformed or incompatible remote packs fail safely.

### Phase 8 — extend the Workshop with sheet-music and assisted authoring

**Purpose:** add optional routes for difficult performances after the core pipeline works.

Possible work:

- accept MusicXML/MIDI exported directly from Songscription or another service;
- trial Audiveris/homr for larger printed scores;
- use MuseScore for correction and MIDI export;
- create the project-local `sheet-music-to-midi` Codex skill for small screenshots and repeatable validation;
- add machine-readable note-event reports and uncertainty tracking.

The skill belongs here because its exact workflow should be informed by the notation, MIDI and validation conventions established in earlier phases. It is not required for the MVP.

## Suggested first backlog

Complete these in order:

1. push the research baseline to `jamieaa64/LearnSprunki`;
2. create the asset provenance/licence ledger and fill the first collection row;
3. bring the exact NeoKeys upstream commit into a locally runnable baseline;
4. create the Workshop's initial sources/drafts/reports convention;
5. choose the six-loop transcription benchmark set;
6. run and document NeuralNote trials, followed by one recorded Basic Pitch trial;
7. test NeoKeys on the target tablet and desktop;
8. build the throwaway single-character animation/timing spike;
9. decide the first vertical-slice character from the evidence;
10. write the version 1 shared content schema;
11. refactor NeoKeys and build the authoring CLI against that schema.

## Project-level success measures

- Median curator time per normal pitched loop is low enough to make a collection practical.
- Every published lesson has provenance, exact licence, review state and source hashes.
- The target tablet sustains smooth animation and responsive touch input.
- MIDI/audio/animation alignment does not drift over ten loop repetitions.
- A learner can complete lessons using touch without any external hardware.
- Remote or imported content cannot execute code.
- A collection can later be added without character-specific changes to the player engine.
- The app continues to function offline with installed content.

## Deliberately deferred

- automatic publishing from `.sb3` to the public catalogue;
- real-time transcription inside the learner app;
- a comprehensive sheet-music skill;
- direct browser writes to GitHub;
- every mod/phase before the first collection workflow is proven;
- commercial use while depending on NeoKeys under CC BY-NC 4.0.
