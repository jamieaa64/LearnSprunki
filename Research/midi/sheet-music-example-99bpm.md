# Sheet-music screenshot transcription

Source: user-supplied screenshot

- Tempo: quarter note = 99 BPM
- Meter: 4/4
- Sound: acoustic grand piano
- MIDI format: Type 0, 480 ticks per quarter note

## Notes

| Bar | Beat | Notes | Duration |
|---|---:|---|---|
| 1 | 1 | E6 | Dotted half note |
| 1 | 4 | G6 | Eighth note |
| 1 | 4.5 | A6 | Eighth note |
| 2 | 1 | E6 + A6 | Half note |
| 2 | 3 | D6 + D7 | Quarter note |
| 2 | 4 | B5 + B6 | Eighth note |
| 2 | 4.5 | D6 + D7 | Eighth note |

The lower staff contains a whole-bar rest in both measures and therefore produces no MIDI notes.

Regenerate the MIDI with:

```sh
node Research/scripts/create-sheet-example-midi.mjs
```

