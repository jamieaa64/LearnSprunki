# Product and UX

## Product promise

“Choose a Sprunki you like, hear its part, and learn to perform a playable version of it.”

This should be a learning game, not only a MIDI visualiser. The character provides motivation and feedback while the piano roll teaches pitch, order and rhythm.

## Navigation model

The content hierarchy should be visible in the picker:

```text
Collection / game version
  Character
    Phase or variant
      Performance / sound loop
        Lesson arrangement and difficulty
```

Example:

```text
Original Sprunki
  Garnold
    Phase 1
      Arpeggio
        Easy / Full
    Phase 2
      Slow arpeggio
        Easy / Full
```

“Phase” should not be hard-coded to 1 and 2. Mods may have many numbered phases, named states, alternative designs or only one state. Model it as an ordered `variant` whose display label may be “Phase 2”.

## Lesson screen

Recommended desktop layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Back  Original Sprunki › Garnold › Phase 1     tempo 75%   │
├───────────────────┬─────────────────────────────────────────┤
│ Animated Sprunki │ falling notes / beat guides             │
│ reference audio  │                                         │
│ loop progress    │                                         │
├───────────────────┴─────────────────────────────────────────┤
│                  playable piano keyboard                    │
├─────────────────────────────────────────────────────────────┤
│ Listen | Practise | Wait | Loop | Metronome | Input        │
└─────────────────────────────────────────────────────────────┘
```

On a narrow screen, place the smaller animated character above the lanes and allow a reduced key range. Do not promise MIDI keyboard support on every mobile browser.

## Core modes

- **Listen:** play the original WAV and/or the piano arrangement while the notes and character animate.
- **Practise:** notes move at the selected tempo; score pitch and timing with a generous beginner window.
- **Wait:** pause musical progress until the required note or chord is played. This is the most approachable first learning mode.
- **Loop section:** repeat a selected one- or two-bar region.
- **Free play:** animate the character in response to input without scoring a lesson.

Computer-keyboard mappings should be fixed by physical key position (`KeyboardEvent.code`), not by the character printed on the key, so QWERTY and other layouts behave predictably. Ignore key repeat, release notes on blur/visibility change, and provide octave-shift controls.

## Teaching rhythms and non-pitched sounds

Not every Sprunki should be forced into a melodic piano lesson.

| Source part | Lesson treatment |
|---|---|
| Melody, arpeggio, organ, bass | Normal pitched falling notes |
| Chords/choir | Simplified chord or top-line arrangement |
| Kick, snare, cymbal | Rhythm lane mapped to one or a few keys |
| Speech, noise, sound effect | Curated rhythm/pitch approximation or “listen only” |

For percussion, show labelled rhythm lanes such as Kick and Snare rather than pretending that a kick drum is a particular piano pitch. A learner may still use assigned piano/MIDI keys to play those lanes.

## Character animation

Treat the supplied SVGs as ordered animation frames. Each performance manifest should specify:

- idle frame;
- ordered active frames;
- frames per second or per-frame durations;
- loop length and optional phase offset;
- whether the character reacts to reference playback, correct input, or both.

The audio transport must be the clock. Derive the displayed frame from transport time instead of incrementing a timer, preventing visual drift after many loops.

## Colour and accessibility

Store a curated palette for each character/variant: primary, secondary, note, lane, background and high-contrast text. SVG colour extraction can suggest a palette but should not decide it automatically.

- Never encode left/right hand or correctness by colour alone; add shape, labels or patterns.
- Maintain readable contrast even for very light characters such as Wenda.
- Include reduced-motion and gore/horror-content controls.
- Keep phase 2 and later horror content clearly labelled and optionally hidden by default, particularly because the likely audience includes children.
- Offer audio volume controls independently for reference WAV, piano, metronome and feedback.

## Progression

An MVP can use local-device progress with no account:

- best accuracy;
- best timing score;
- comfortable tempo reached;
- completed lesson sections;
- selected input and key range.

Later, derive easier lessons from the approved full arrangement by slowing tempo, limiting range, removing accompaniment notes, or teaching short chunks. Automatically generated simplifications should also be curator-reviewed.

