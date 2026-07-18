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
