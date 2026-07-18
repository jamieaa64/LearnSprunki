import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PPQ = 480;
const BPM = 99;

function variableLength(value) {
  const bytes = [value & 0x7f];
  while ((value >>= 7) > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
  }
  return bytes;
}

function textMeta(type, value) {
  const bytes = [...Buffer.from(value, "utf8")];
  return [0xff, type, ...variableLength(bytes.length), ...bytes];
}

const notes = [
  // Bar 1: dotted-half E6, eighth G6, eighth A6.
  { pitch: 88, start: 0, duration: 3 * PPQ, velocity: 80 },
  { pitch: 91, start: 3 * PPQ, duration: PPQ / 2, velocity: 80 },
  { pitch: 93, start: 3.5 * PPQ, duration: PPQ / 2, velocity: 80 },

  // Bar 2: half E6+A6, quarter D6+D7, eighth B5+B6, eighth D6+D7.
  { pitch: 88, start: 4 * PPQ, duration: 2 * PPQ, velocity: 80 },
  { pitch: 93, start: 4 * PPQ, duration: 2 * PPQ, velocity: 80 },
  { pitch: 86, start: 6 * PPQ, duration: PPQ, velocity: 80 },
  { pitch: 98, start: 6 * PPQ, duration: PPQ, velocity: 80 },
  { pitch: 83, start: 7 * PPQ, duration: PPQ / 2, velocity: 80 },
  { pitch: 95, start: 7 * PPQ, duration: PPQ / 2, velocity: 80 },
  { pitch: 86, start: 7.5 * PPQ, duration: PPQ / 2, velocity: 80 },
  { pitch: 98, start: 7.5 * PPQ, duration: PPQ / 2, velocity: 80 },
];

const events = [];
for (const note of notes) {
  events.push({ tick: note.start, order: 1, data: [0x90, note.pitch, note.velocity] });
  events.push({ tick: note.start + note.duration, order: 0, data: [0x80, note.pitch, 0] });
}
events.sort((a, b) => a.tick - b.tick || a.order - b.order || a.data[1] - b.data[1]);

const tempo = Math.round(60_000_000 / BPM);
const track = [
  ...variableLength(0), ...textMeta(0x03, "Sheet music screenshot transcription"),
  ...variableLength(0), 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff,
  ...variableLength(0), 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
  ...variableLength(0), 0xc0, 0x00,
];

let previousTick = 0;
for (const event of events) {
  track.push(...variableLength(event.tick - previousTick), ...event.data);
  previousTick = event.tick;
}
track.push(...variableLength(0), 0xff, 0x2f, 0x00);

function uint16(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32(value) {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

const midi = Buffer.from([
  ...Buffer.from("MThd"), ...uint32(6), ...uint16(0), ...uint16(1), ...uint16(PPQ),
  ...Buffer.from("MTrk"), ...uint32(track.length), ...track,
]);

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../midi/sheet-music-example-99bpm.mid");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, midi);
console.log(output);

