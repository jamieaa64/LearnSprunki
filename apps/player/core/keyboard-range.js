export const PIANO_MIN_MIDI = 21;
export const PIANO_MAX_MIDI = 108;
export const STANDARD_KEYBOARD_SIZES = Object.freeze([25, 37, 49, 61, 73, 88]);

export function rangeForSize(size, requiredMin, requiredMax) {
  if (!STANDARD_KEYBOARD_SIZES.includes(size)) return null;
  if (size === 88) {
    if (requiredMin < PIANO_MIN_MIDI || requiredMax > PIANO_MAX_MIDI) return null;
    return { first: PIANO_MIN_MIDI, last: PIANO_MAX_MIDI, size };
  }

  const candidates = [];
  const firstPossibleC = Math.ceil(PIANO_MIN_MIDI / 12) * 12;
  const lastPossibleC = PIANO_MAX_MIDI - (size - 1);
  const requiredCentre = (requiredMin + requiredMax) / 2;
  for (let first = firstPossibleC; first <= lastPossibleC; first += 12) {
    const last = first + size - 1;
    if (first <= requiredMin && last >= requiredMax) {
      candidates.push({
        first,
        last,
        size,
        centreDistance: Math.abs((first + last) / 2 - requiredCentre),
      });
    }
  }
  candidates.sort((a, b) => a.centreDistance - b.centreDistance || a.first - b.first);
  const match = candidates[0];
  return match ? { first: match.first, last: match.last, size: match.size } : null;
}

export function centredRangeForSize(size) {
  if (size === 88) return { first: PIANO_MIN_MIDI, last: PIANO_MAX_MIDI, size };
  return rangeForSize(size, 60, 60);
}

export function chooseKeyboardRange(notes, mode = "88") {
  const supportedNotes = notes
    .map(note => Number(note.midi))
    .filter(midi => Number.isFinite(midi) && midi >= PIANO_MIN_MIDI && midi <= PIANO_MAX_MIDI);

  if (supportedNotes.length === 0) {
    const defaultSize = mode === "auto" ? 49 : Number(mode);
    return centredRangeForSize(defaultSize) || centredRangeForSize(88);
  }

  const minNote = Math.min(...supportedNotes);
  const maxNote = Math.max(...supportedNotes);
  const paddedMin = Math.max(PIANO_MIN_MIDI, minNote - 2);
  const paddedMax = Math.min(PIANO_MAX_MIDI, maxNote + 2);
  const requestedSize = mode === "auto" ? 25 : Number(mode);
  const allowedSizes = STANDARD_KEYBOARD_SIZES.filter(size => size >= requestedSize);

  if (mode === "auto") {
    for (const size of allowedSizes) {
      const range = rangeForSize(size, paddedMin, paddedMax);
      if (range) return range;
    }
  } else {
    const paddedRequested = rangeForSize(requestedSize, paddedMin, paddedMax);
    if (paddedRequested) return paddedRequested;
    const exactRequested = rangeForSize(requestedSize, minNote, maxNote);
    if (exactRequested) return exactRequested;
    for (const size of allowedSizes.slice(1)) {
      const range = rangeForSize(size, paddedMin, paddedMax) || rangeForSize(size, minNote, maxNote);
      if (range) return range;
    }
  }

  return centredRangeForSize(88);
}
