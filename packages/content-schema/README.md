# LearnSprunki content schema

`catalog.schema.json` defines the shared contract between the player and the
song-authoring tools. Version 3 separates ordinary tracks from Sprunki games
and moves reusable instruments and visual effects into their own catalogues.
`game.schema.json` describes characters and their Phase 1/Phase 2 availability;
locked phases may have portraits and presentation metadata without claiming a
playable lesson exists.

Playable MIDI remains a separate file. Generated transcriptions carry an
explicit review status so the player can distinguish a machine-produced draft
from a human-approved lesson.
