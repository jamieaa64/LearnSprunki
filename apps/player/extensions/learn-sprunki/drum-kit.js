export const DRUM_PIECES = Object.freeze([
  { id: 'crash', label: 'Crash', midi: 49, aliases: [49, 52, 55, 57], key: 'L', cx: 0.2, cy: 0.23, diameter: 0.42, shape: 'cymbal', labelSide: 'left' },
  { id: 'ride', label: 'Ride', midi: 51, aliases: [51, 53, 59], key: 'K', cx: 0.79, cy: 0.23, diameter: 0.42, shape: 'cymbal', labelSide: 'right' },
  { id: 'open-hi-hat', label: 'Open hi-hat', midi: 46, aliases: [46], key: 'E', cx: 0.24, cy: 0.53, diameter: 0.28, shape: 'hi-hat', labelSide: 'left' },
  { id: 'hi-hat', label: 'Hi-hat', midi: 42, aliases: [42], key: 'D', cx: 0.24, cy: 0.77, diameter: 0.28, shape: 'hi-hat', labelSide: 'left' },
  { id: 'pedal-hi-hat', label: 'Pedal hi-hat', midi: 44, aliases: [44], key: 'C', cx: 0.33, cy: 0.86, width: 0.1, height: 0.28, shape: 'pedal', labelSide: 'left' },
  { id: 'high-tom', label: 'High tom', midi: 48, aliases: [48, 50], key: 'G', cx: 0.43, cy: 0.45, diameter: 0.3, shape: 'drum', labelSide: 'left' },
  { id: 'mid-tom', label: 'Mid tom', midi: 47, aliases: [47], key: 'H', cx: 0.57, cy: 0.46, diameter: 0.31, shape: 'drum', labelSide: 'right' },
  { id: 'low-tom', label: 'Low tom', midi: 45, aliases: [45], key: 'T', cx: 0.73, cy: 0.67, diameter: 0.34, shape: 'drum', labelSide: 'right' },
  { id: 'floor-tom', label: 'Floor tom', midi: 43, aliases: [41, 43], key: 'S', cx: 0.84, cy: 0.79, diameter: 0.33, shape: 'drum', labelSide: 'right' },
  { id: 'snare', label: 'Snare', midi: 38, aliases: [37, 38, 39, 40], key: 'J', cx: 0.49, cy: 0.75, diameter: 0.37, shape: 'drum', labelSide: 'below' },
  { id: 'kick', label: 'Kick', midi: 36, aliases: [35, 36], key: 'F', cx: 0.62, cy: 0.84, width: 0.1, height: 0.34, shape: 'pedal', labelSide: 'right' },
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
  const usableHeight = Math.max(100, height - 8);
  const usableWidth = Math.min(width - 16, 860, usableHeight * 5.45);
  const left = (width - usableWidth) / 2;
  return DRUM_PIECES.map(piece => {
    const pieceWidth = (piece.width ?? piece.diameter) * usableHeight;
    const pieceHeight = (piece.height ?? piece.diameter) * usableHeight;
    const centerX = left + piece.cx * usableWidth;
    const centerY = top + piece.cy * usableHeight;
    return {
      ...piece,
      x: centerX - pieceWidth / 2,
      y: centerY - pieceHeight / 2,
      w: pieceWidth,
      h: pieceHeight,
    };
  });
}

export function drumAtPoint(x, y, layout) {
  for (let index = layout.length - 1; index >= 0; index--) {
    const piece = layout[index];
    if (piece.shape === 'pedal') {
      const horizontalPadding = Math.max(10, (36 - piece.w) / 2);
      if (x >= piece.x - horizontalPadding && x <= piece.x + piece.w + horizontalPadding && y >= piece.y - 5 && y <= piece.y + piece.h + 5) return piece;
      continue;
    }
    const cx = piece.x + piece.w / 2;
    const cy = piece.y + piece.h / 2;
    const nx = (x - cx) / (piece.w / 2);
    const ny = (y - cy) / (piece.h / 2);
    if (nx * nx + ny * ny <= 1) return piece;
  }
  return null;
}
