# Sheet music to MIDI

## Recommendation

Treat optical music recognition (OMR) as a separate authoring route alongside audio transcription:

```text
WAV loop
  → NeuralNote (interactive) or Basic Pitch (batch)
  → reviewed MIDI

sheet image/PDF
  → direct manual transcription for a tiny excerpt
  → or OMR for a longer printed score
  → reviewed MusicXML
  → MuseScore
  → reviewed MIDI

Songscription or another paid service
  → request MusicXML and MIDI directly when available
  → review and simplify for the lesson
```

MusicXML should be the intermediate format for notation because it retains measures, voices, clefs and note spelling. MIDI is the learner-player format, but it loses most notation semantics. Keep both files whenever a service or OMR tool can provide them.

## Tool choices

### Audiveris

[Audiveris](https://github.com/Audiveris/audiveris) is the default recommendation for substantial printed scores. It combines an OMR engine with a correction editor, handles PDFs/images and exports MusicXML 4.0. It is actively released, supports macOS, Windows and Linux, and explicitly expects a human to correct recognition errors. It focuses on printed common Western notation rather than handwritten music.

Its AGPL-3.0 licence is not a problem when it is used as a separate authoring application. Do not embed or modify its server-side code inside the learner app without reviewing the resulting licence obligations.

### homr

[homr](https://github.com/liebharc/homr) is a useful experimental alternative for photos and command-line automation. It accepts a score image and emits MusicXML, and can currently be run with `uvx homr <image>`. Its own documentation says it focuses on pitch and rhythm in bass/treble clefs and omits or incompletely handles some dynamics, articulation and accidentals. It is also AGPL-3.0.

Use homr for trials on clean camera/screenshot inputs, but do not make it the only route until its results have been benchmarked against this project's real samples.

### oemer

[oemer](https://github.com/BreezeWhite/oemer) is an earlier deep-learning OMR tool that converts phone images to MusicXML. Its repository now points to homr as an improved descendant. Keep oemer as a comparison/fallback rather than the first choice for a new pipeline.

### MuseScore Studio

[MuseScore Studio](https://handbook.musescore.org/file-management/working-with-musicxml-files) is the review and conversion workbench. Open the MusicXML, compare every bar with the source, correct it, preserve an editable MuseScore/MusicXML source, and export MIDI. MusicXML imports commonly need cleanup, even without OMR errors.

## What the Codex skill should do

The reusable `sheet-music-to-midi` skill should route each input by complexity:

- **Tiny, clean excerpt:** inspect the image at full resolution, transcribe notes and durations directly, write a note-event JSON file and MIDI, then perform a second measure-by-measure check.
- **Longer printed score:** prefer an existing MusicXML/MIDI download. Otherwise run or guide Audiveris/homr, then inspect the MusicXML in MuseScore before MIDI export.
- **Handwritten, blurry or cropped score:** request a better scan or use a specialist/paid service; do not silently guess missing clefs, key signatures or measures.
- **Paid transcription result:** ask for MusicXML and MIDI exports, not just a screenshot. Use image transcription only as the fallback.

The skill's deliverables should be:

- the `.mid` lesson candidate;
- MusicXML when it exists;
- a machine-readable note-event list;
- a short report containing tempo, time signature, measures, uncertain readings and validation performed.

Validation must check clef, key signature, accidentals, octave, simultaneous notes, ties/dots/tuplets, exact measure durations and the MIDI tempo/time-signature metadata. The MIDI remains a draft until it has been auditioned against the source.

## Fit with Sprunki Piano

This route is an escape hatch, not the primary importer. Most Sprunki assets are short isolated audio loops, so NeuralNote/Basic Pitch plus manual cleanup remains the normal workflow. Sheet music becomes useful when:

- a third-party service produces a more intelligible notation transcription;
- a mod author publishes a score instead of MIDI;
- a human wants to arrange a difficult vocal/effect part manually;
- an image contains a short motif that is faster to enter directly than to clean up from audio.

