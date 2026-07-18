# LearnSprunki content schema

`catalog.schema.json` defines the first shared contract between the player and
the future song-authoring tools. A catalogue contains lightweight display
metadata and paths to ordinary MIDI files; the player does not embed MIDI data
inside its JavaScript.

The initial schema deliberately covers playable tracks only. Character,
animation, phase, source-audio, attribution, and transcription metadata will be
added when the first Sprunki pack is assembled, based on real extracted assets
rather than assumptions.
