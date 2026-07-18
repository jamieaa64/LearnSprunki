# Local asset audit

Audited path: `SprunkiAssets/`

## Summary

| Measure | Result |
|---|---:|
| Character folders | 20 |
| WAV files | 86 |
| Unique WAV SHA-256 hashes | 71 |
| Exact duplicate WAV files beyond first copy | 15 |
| Character sprite SVGs, phase 1 | 184 |
| Character sprite SVGs, phase 2 | 164 |
| Character icon SVGs | 60 |
| All SVG files | 517 |
| PNG files | 1 |
| Non-`.DS_Store` asset size | 90.78 MiB |
| Total WAV duration (including duplicates) | 644.468 seconds |
| Shortest/longest WAV | 4.806 / 13.719 seconds |
| 44.1 kHz / 48 kHz WAVs | 47 / 39 |
| Stereo / mono WAVs | 47 / 39 |

The pack is sufficiently complete for an original-game MVP. Every character directory has phase-1 and phase-2 audio plus phase-specific sprite locations. Most have two sound files per phase; a few have extra files. Sprite-frame counts vary widely, and some variants have only an idle frame.

## Per-character inventory

| Character ID | WAV | Phase-1 sprite SVG | Phase-2 sprite SVG |
|---|---:|---:|---:|
| black-mystery | 4 | 1 | 1 |
| blue-jevin | 6 | 10 | 6 |
| brown-brud | 4 | 10 | 9 |
| fun-bot | 4 | 9 | 9 |
| gold-garnold | 4 | 6 | 9 |
| gray-gray | 4 | 12 | 9 |
| green-vineria | 4 | 9 | 5 |
| lime-owakcx | 4 | 11 | 11 |
| mr-fun-computer | 4 | 19 | 17 |
| mr-sun | 4 | 7 | 7 |
| mr-tree | 4 | 9 | 1 |
| orange-oren | 4 | 7 | 5 |
| pink-pinki | 4 | 8 | 11 |
| purple-durple | 6 | 16 | 13 |
| red-raddy | 4 | 5 | 6 |
| silver-clukr | 4 | 8 | 5 |
| sky-blue-sky | 4 | 7 | 9 |
| tan-tunner | 4 | 12 | 13 |
| white-wenda | 5 | 12 | 13 |
| yellow-simon | 5 | 6 | 5 |

Counts include each phase’s `idle.svg` where present. The `black-mystery` and `mr-tree` phase-2 directories have only an idle SVG, so the player must support static characters.

## Likely teaching categories from filenames

These are hypotheses for curator review, not verified musical analysis.

| Category | Likely characters/parts |
|---|---|
| Strong first pitched candidates | Garnold arpeggio, Mr Sun piano, Mr Tree organ, Gray bass, Sky music box, Tunner whistle, Simon square lead |
| Pitched but likely more cleanup | Jevin/Pinki choir, Durple horns, Fun Computer voice/singing |
| Rhythm candidates | Oren kick, Raddy snare, Clukr ride/knock, Fun Bot amen, Vineria shaker |
| Effects/ambiguous | Black creepy, Brud goofy/weird, OWAKCX wind-up, Wenda voice/crazy |

## Data hygiene findings

- The repository contains 81 `.DS_Store` files; exclude these from manifests and version control.
- Audio formats are mixed between mono/stereo and 44.1/48 kHz. Preserve originals but normalise derived previews/transcription inputs.
- At least 15 WAV entries are byte-identical duplicates. Content-addressed storage will save space and avoid redundant transcription.
- Frame names include both `anim.svg`/`anim1.svg` and multi-digit names. Use natural numeric sorting, never lexical sorting.
- No README, licence or credit file was found beside the local assets. Provenance must be established before publication.
- Icon folders consistently provide three SVGs, which can be mapped to catalogue/selection states after visual review.

## Immediate preparation tasks

1. Add a source/provenance record for this pack.
2. Generate an initial manifest rather than reading the folders directly in the app.
3. Deduplicate WAV processing by hash.
4. Audition and classify all 71 unique sounds.
5. Select canonical loop/take relationships for each phase.
6. Transcribe Garnold phase 1 and phase 2, then Mr Sun and Gray to test polyphonic, piano and bass cases.
7. Test Oren or Raddy as the first rhythm-lane lesson.

