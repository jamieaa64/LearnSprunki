# NeuralNote versus Basic Pitch

Assessment date: 18 July 2026

Assessed NeuralNote commit: `f979e51dfeab54d5921858af39403308ab06e60c` (16 January 2025)

## Short answer

NeuralNote is not a more advanced competing model. It embeds Spotify’s Basic Pitch model and implements its inference in native C++ using RTNeural for the convolutional network and ONNX Runtime for the Constant-Q-transform/harmonic-stacking feature stage.

Its advantage is workflow: NeuralNote puts Basic Pitch behind a polished piano roll where a curator can hear the original and synthetic transcription, adjust detection settings, constrain range, quantise pitch/time and export MIDI. That can produce a better **finished lesson file** with less effort, even though the initial model prediction comes from Basic Pitch.

## Comparison

| Question | Basic Pitch Python | NeuralNote | Basic Pitch TypeScript |
|---|---|---|---|
| Transcription model | Spotify Basic Pitch | Spotify Basic Pitch | Spotify Basic Pitch |
| Main form | Python library and CLI | C++ VST3/AU/standalone app | TypeScript library |
| Best use here | Repeatable batch imports | Interactive audition and cleanup | Browser-side experiments |
| Human interface | Minimal | Strong piano roll and controls | Build it yourself |
| Automation | Excellent | Limited without extracting C++ engine | Possible, but browser-oriented |
| Web PWA integration | Server/local authoring only | Not directly | Best technical fit |
| Real-time transcription | No | No | Not the learner-input mechanism |
| Licence | Apache-2.0 | Apache-2.0 | Apache-2.0 |
| Percussion solution | No | No; tonal instruments | No |

## Does NeuralNote sound more accurate?

It may appear more accurate for three reasons:

- thresholds can be adjusted while listening;
- pitch range and scale constraints suppress implausible notes;
- time quantisation makes machine timing look musical.

Those are valuable post-processing and curation advantages, not evidence of a different neural model. Minor numerical or note-event differences may exist because NeuralNote reimplements the runtime and post-processing, but the project makes no claim of a newly trained, more accurate model.

## Recommended Sprunki workflow

### Stage 1: learn the material interactively

Use the NeuralNote standalone build on each unique pitched WAV:

1. drop in the original file;
2. set a plausible pitch range;
3. adjust onset/frame sensitivity;
4. decide whether pitch bends help or create noise;
5. enter the correct tempo/time signature;
6. quantise conservatively;
7. compare source and MIDI synthesis;
8. export a draft MIDI;
9. make any final musical corrections in a MIDI editor;
10. record settings and review status in the content manifest.

The local clips are only 4.8–13.7 seconds long, making this manual workflow practical for the initial 71 unique audio files.

### Stage 2: automate repeated work

After several characters reveal good presets, run Basic Pitch Python from the curator pipeline and apply the same cleanup rules programmatically. Keep NeuralNote as the visual quality-control tool and fallback for difficult material.

### Stage 3: do not transcribe inside lessons

The learner app should load approved MIDI. MIDI keyboard note detection is direct Web MIDI input and does not require audio transcription. NeuralNote explicitly explains that Basic Pitch requires long Constant-Q-transform windows, adds model latency, and uses backward/non-causal note-event processing, so it cannot provide real-time learning feedback.

## Reusing NeuralNote code

NeuralNote invites reuse of `Lib/Model` and stores weights under `Lib/ModelData`, all under Apache-2.0. This could support a future native curator CLI or desktop tool.

It is not the first integration choice because:

- it brings a C++17/CMake/JUCE, RTNeural and ONNX Runtime toolchain;
- the browser app would need a dedicated WebAssembly port and careful performance work;
- the README says generation of its model-data files involved manual operations and is not currently available as a reproducible script;
- Basic Pitch Python already provides the batch API the content pipeline needs.

Use the NeuralNote executable first. Extract its engine only if Python deployment later becomes a measurable bottleneck or a native authoring app becomes a product goal.

## Decision

- **Best initial curator experience:** NeuralNote standalone.
- **Best repeatable import dependency:** Basic Pitch Python.
- **Best route if transcription must eventually run in-browser:** Basic Pitch TypeScript.
- **MVP learner input/scoring mechanism:** direct on-screen touch events, not audio-to-MIDI. Web MIDI can remain an optional inherited adapter.
- **Drums and percussion:** onset detection plus curated rhythm lanes, not any of the three above.

## Sources

- [NeuralNote repository and README](https://github.com/DamRsn/NeuralNote)
- [NeuralNote Apache-2.0 licence](https://github.com/DamRsn/NeuralNote/blob/master/LICENSE)
- [Spotify Basic Pitch Python](https://github.com/spotify/basic-pitch)
- [Spotify Basic Pitch TypeScript](https://github.com/spotify/basic-pitch-ts)
