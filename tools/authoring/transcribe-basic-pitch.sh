#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 4 ]]; then
  echo "Usage: $0 INPUT.wav OUTPUT_DIRECTORY [MIN_FREQUENCY_HZ] [MAX_FREQUENCY_HZ]" >&2
  exit 2
fi

input_audio=$1
output_directory=$2
minimum_frequency=${3:-80}
maximum_frequency=${4:-2200}
input_name=$(basename "$input_audio")
input_stem=${input_name%.*}

mkdir -p "$output_directory"

uv run \
  --python 3.9 \
  --with basic-pitch==0.3.0 \
  --with 'setuptools<81' \
  --with tensorflow==2.15.1 \
  --with scipy==1.12.0 \
  --no-progress \
  basic-pitch \
  --save-midi \
  --save-note-events \
  --minimum-frequency "$minimum_frequency" \
  --maximum-frequency "$maximum_frequency" \
  "$output_directory" \
  "$input_audio"

candidate_midi="$output_directory/${input_stem}_basic_pitch.mid"
if [[ ! -s "$candidate_midi" ]]; then
  echo "Basic Pitch did not create the expected candidate: $candidate_midi" >&2
  exit 1
fi

echo "Draft candidate created: $candidate_midi"
