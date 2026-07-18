# LearnSprunki authoring tools

The first authoring command produces a **draft** MIDI and note-event CSV from a
pitched WAV using Spotify Basic Pitch. It pins the compatibility versions needed
by Basic Pitch 0.3.0 on this Mac and runs them in an isolated `uv` environment.

```bash
tools/authoring/transcribe-basic-pitch.sh \
  SprunkiAssets/sprunkis/mr-sun/sounds/phase1/piano1.wav \
  tools/authoring/workbench/original-sprunki/mr-sun/phase1
```

The generated file must be reviewed in NeuralNote, MuseScore or another MIDI
editor before its catalogue status changes from `draft` to `approved`.

Basic Pitch currently returns a successful process status even for some
inference failures, so the wrapper also verifies that a non-empty MIDI was
actually created.

## Original Sprunki batch

`original-sprunki-plan.json` records the teaching classification and canonical
source WAV for all 40 Original Sprunki character/phase combinations. Run the
repeatable batch with:

```bash
node tools/authoring/batch-transcribe-original.mjs
```

Only entries marked `publishDraft` are sent to Basic Pitch. Speech and
noise/effect performances remain locked until a useful teaching representation
exists. Existing non-empty candidates are skipped, so interrupted batches can
be resumed safely.

Percussion phases use a separate deterministic onset pass:

```bash
node tools/authoring/generate-rhythm-midi.mjs
```

It produces single-lane General MIDI percussion drafts plus reviewable onset
JSON. These lessons use the player's large rhythm pad instead of piano keys.
