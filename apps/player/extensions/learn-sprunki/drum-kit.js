export const DRUM_PIECES = Object.freeze([
  { id: 'crash', label: 'Crash', shortLabel: 'CRASH', midi: 49, aliases: [49, 52, 55, 57], key: 'L', x: 0.08, y: 0.08, w: 0.19, h: 0.31, shape: 'cymbal' },
  { id: 'high-tom', label: 'High tom', shortLabel: 'HIGH', midi: 48, aliases: [48, 50], key: 'G', x: 0.34, y: 0.18, w: 0.18, h: 0.34, shape: 'drum' },
  { id: 'low-tom', label: 'Low tom', shortLabel: 'LOW', midi: 45, aliases: [45, 47], key: 'H', x: 0.52, y: 0.2, w: 0.18, h: 0.34, shape: 'drum' },
  { id: 'ride', label: 'Ride', shortLabel: 'RIDE', midi: 51, aliases: [51, 53, 59], key: 'K', x: 0.75, y: 0.08, w: 0.19, h: 0.31, shape: 'cymbal' },
  { id: 'snare', label: 'Snare', shortLabel: 'SNARE', midi: 38, aliases: [37, 38, 39, 40], key: 'J', x: 0.18, y: 0.53, w: 0.23, h: 0.39, shape: 'drum' },
  { id: 'kick', label: 'Kick', shortLabel: 'KICK', midi: 36, aliases: [35, 36], key: 'F', x: 0.4, y: 0.55, w: 0.22, h: 0.42, shape: 'kick' },
  { id: 'hi-hat', label: 'Hi-hat', shortLabel: 'HAT', midi: 42, aliases: [42, 44, 46], key: 'D', x: 0.68, y: 0.53, w: 0.2, h: 0.36, shape: 'cymbal' },
  { id: 'floor-tom', label: 'Floor tom', shortLabel: 'FLOOR', midi: 43, aliases: [41, 43], key: 'S', x: 0.83, y: 0.56, w: 0.15, h: 0.39, shape: 'drum' },
]);

export function pieceForMidi(midi) {
  return DRUM_PIECES.find(piece => piece.aliases.includes(midi)) || null;
}

export function canonicalDrumMidi(midi) {
  return pieceForMidi(midi)?.midi ?? midi;
}

export function pieceForKey(key) {
  const normalized = `${key || ''}`.toUpperCase();
  return DRUM_PIECES.find(piece => piece.key === normalized) || null;
}

export function drumKitLayout(width, top, height) {
  const usableWidth = Math.min(width - 16, 860);
  const left = (width - usableWidth) / 2;
  const usableHeight = Math.max(80, height - 10);
  return DRUM_PIECES.map(piece => ({
    ...piece,
    x: left + piece.x * usableWidth,
    y: top + piece.y * usableHeight,
    w: piece.w * usableWidth,
    h: piece.h * usableHeight,
  }));
}

export function drumAtPoint(x, y, layout) {
  for (let index = layout.length - 1; index >= 0; index--) {
    const piece = layout[index];
    const cx = piece.x + piece.w / 2;
    const cy = piece.y + piece.h / 2;
    const nx = (x - cx) / (piece.w / 2);
    const ny = (y - cy) / (piece.h / 2);
    if (nx * nx + ny * ny <= 1) return piece;
  }
  return null;
}
