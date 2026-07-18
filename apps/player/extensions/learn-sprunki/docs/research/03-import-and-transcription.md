# Import and audio-to-MIDI pipeline

## Why this is an authoring workflow

Automatic transcription produces a draft, not a lesson. A musically valid MIDI may still be too wide for a learner, contain tiny false notes, drift away from a loop boundary, or represent a vocal effect that cannot sensibly be played on piano. The import tool should therefore end in a review screen, not publish directly.

## Scratch `.sb3` extraction

An `.sb3` is a ZIP archive containing `project.json` and hashed media assets. In `project.json`, Scratch targets (stage and sprites) refer to costumes and sounds by fields such as `name`, `assetId`, `dataFormat` and `md5ext`.

Recommended importer:

1. accept a user-supplied local `.sb3` file; do not scrape or bypass an itch.io download gate;
2. calculate a source SHA-256 and record the supplied source URL/creator;
3. open it as ZIP with strict limits on entry count, compressed/uncompressed size and nesting;
4. reject absolute paths, `..` traversal, symlinks, executables and unsupported formats;
5. parse and validate `project.json`;
6. enumerate each target and copy its referenced costumes and sounds into a staging area using friendly generated names while retaining original hashes;
7. generate contact sheets, audio previews and a target/asset report;
8. ask the curator to group sprites into characters, variants/phases and performances;
9. transcribe suitable sounds and review the output;
10. emit a validated content pack and attribution record.

The target structure is useful evidence, but phase detection cannot be fully generic. Scratch mod authors may switch phases through costumes, broadcasts, variables, clones or duplicate sprites with arbitrary names. Use heuristics to suggest groups, then require confirmation.

Useful grouping signals include:

- target/sprite name;
- costume and sound names;
- common target ownership;
- dimensions and visual similarity;
- broadcast/variable names containing `phase`, `horror`, `normal` or numbers;
- blocks that select costumes or start sounds after the same broadcast;
- source order and repeated character colour.

Avoid taking a dependency on the AGPL Scratch parser or VM just to unzip and read this simple data structure unless the whole application’s licensing is intentionally compatible. A small clean-room importer using the documented archive shape and your own validation is enough.

## Audio classification

Before transcription, tag each performance:

- `pitched-monophonic` (whistle, lead, bass);
- `pitched-polyphonic` (piano, organ, arpeggio, choir/chords);
- `percussion` (kick, snare, cymbal, beat loop);
- `vocal`;
- `effect/noise`;
- `mixed/unknown`.

Names provide initial hints but the curator should confirm by listening.

## Pitched workflow with Basic Pitch

Spotify Basic Pitch is the underlying open-source transcription model. The Python and TypeScript projects are Apache-2.0 licensed, accept WAV, support polyphonic/pitch-bend transcription, and work best on one instrument at a time.

For the first content pack, use the Apache-2.0 NeuralNote standalone application as the curator interface. NeuralNote runs the Basic Pitch model through RTNeural and ONNX Runtime, then makes it easy to listen to source and transcription together, adjust note thresholds and pitch range, apply scale/time quantisation, and export MIDI. It is more convenient, not a fundamentally more accurate model.

Once the preferred settings and cleanup rules are understood, reproduce the batchable parts with Basic Pitch Python so imports are scriptable, versioned and deterministic. Do not add NeuralNote to the learner PWA: it is a native C++/JUCE VST3/AU/standalone application, and its model pipeline is explicitly non-real-time.

Batch/curator flow:

```text
original WAV (preserved)
  → trim/identify useful loop and downmix a working copy
  → NeuralNote interactive pass or Basic Pitch batch prediction
  → remove low-confidence and implausibly short notes
  → identify BPM/beat count and quantise onsets/durations
  → repair octave errors, chords and loop boundary
  → fold/transpose into the supported key range if needed
  → make easy/full lesson variants
  → render MIDI back to audio and compare by ear
  → human approval
```

Keep the original WAV unchanged. Basic Pitch itself resamples to 22,050 Hz and downmixes stereo during prediction, so a derived working file is acceptable. Save the exact Basic Pitch version and thresholds because output can change between versions.

Useful parameters to expose include onset threshold, frame threshold, minimum note length, minimum/maximum frequency and pitch-bend inclusion. For a beginner piano arrangement, pitch bends may be better discarded or rounded to semitones after review.

## Percussion workflow

Basic Pitch is designed around pitched note transcription and is not the right representation for kick/snare/cymbal loops. For the MVP:

1. detect onsets using a simple spectral-flux/librosa-style onset detector;
2. estimate or enter BPM and beat count;
3. quantise hits to the musical grid;
4. map the performance to a labelled rhythm lane and an assigned MIDI note;
5. review every hit.

Because each local performance is already an isolated character part, this is much easier than separating drums from a complete song. Simple onset detection plus manual review is adequate here and avoids bringing in an additional large or restrictively licensed percussion model.

## Vocals and effects

Try Basic Pitch for clearly sung single-note material, but expect cleanup. For speech, growls, noise and ambiguous sound design, choose one:

- create a deliberately simplified playable motif;
- teach only its rhythm;
- mark it as a reference/listening performance;
- use a commercial/manual service and record that provenance.

Songscription currently advertises direct transcription for piano, bass, drums and vocals, editable piano roll, and MIDI/MusicXML export. Its free tier advertises unlimited 30-second transcriptions, which covers these local 4.8–13.7 second clips. It is a useful human-operated fallback, not an open-source dependency or reproducible build step.

When a service supplies sheet music, request its MusicXML and MIDI downloads as well as the rendered score. Those preserve far more usable information than reconstructing notes from a screenshot. If only an image/PDF is available, use the separate [sheet-music-to-MIDI workflow](./08-sheet-music-to-midi.md): direct transcription for a tiny excerpt, or OMR to reviewed MusicXML and then MIDI for a larger printed score.

## Loop and duplicate handling

Do not assume similarly named `sound.wav` and `sound2.wav` are distinct. The local audit found exact duplicates. Deduplicate storage by SHA-256 while retaining every logical source reference.

Determine whether pairs are alternate takes, stereo/mono variants, sections or accidental duplicates. Store that relationship explicitly (`take`, `part`, `alternate`, `duplicate`) rather than relying on a numeric suffix.

For each approved lesson, store loop start/end, beats, BPM and any pickup. The MIDI loop must end on the same musical boundary as the reference animation/audio, even if the WAV contains tail audio.

## Quality checklist

- recognisable against the source at piano timbre;
- correct octave and no spurious very high/low notes;
- no tiny “machine-gun” fragments;
- clear, stable tempo and loop boundary;
- playable on the target range;
- sensible rhythm-lane mapping where not pitched;
- easy arrangement preserves the identity of the part;
- MIDI, audio and animation align on first and tenth repeat;
- creator/source/tool attribution is complete;
- a curator has set `reviewed: true`.
