import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../../../..");
const plan = JSON.parse(await readFile(resolve(scriptDirectory, "original-sprunki-plan.json"), "utf8"));

function readPcm16Wav(buffer) {
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = 0;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (chunk === "fmt ") {
      audioFormat = buffer.readUInt16LE(offset + 8);
      channels = buffer.readUInt16LE(offset + 10);
      sampleRate = buffer.readUInt32LE(offset + 12);
      bitsPerSample = buffer.readUInt16LE(offset + 22);
    }
    if (chunk === "data") {
      dataOffset = offset + 8;
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (audioFormat !== 1 || bitsPerSample !== 16 || !channels || !sampleRate || !dataOffset) {
    throw new Error("Rhythm authoring currently expects PCM 16-bit WAV input");
  }
  const frameCount = Math.floor(dataSize / (channels * 2));
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      sum += buffer.readInt16LE(dataOffset + (frame * channels + channel) * 2) / 32768;
    }
    samples[frame] = sum / channels;
  }
  return { samples, sampleRate };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function detectOnsets(samples, sampleRate) {
  const hop = Math.max(128, Math.round(sampleRate * 0.01));
  const energy = [];
  for (let start = 0; start < samples.length; start += hop) {
    let sum = 0;
    const end = Math.min(samples.length, start + hop * 2);
    for (let index = start; index < end; index++) sum += samples[index] * samples[index];
    energy.push(Math.sqrt(sum / Math.max(1, end - start)));
  }
  const novelty = energy.map((value, index) => {
    const from = Math.max(0, index - 10);
    const history = energy.slice(from, index);
    const baseline = history.length ? history.reduce((sum, item) => sum + item, 0) / history.length : 0;
    return Math.max(0, value - baseline * 1.15);
  });
  const center = median(novelty);
  const deviation = median(novelty.map(value => Math.abs(value - center))) || 0.001;
  const threshold = Math.max(0.012, center + deviation * 4.5);
  const minimumGapFrames = Math.round(0.075 * sampleRate / hop);
  const onsets = [];
  for (let index = 1; index < novelty.length - 1; index++) {
    if (novelty[index] < threshold || novelty[index] < novelty[index - 1] || novelty[index] < novelty[index + 1]) continue;
    if (onsets.length && index - onsets.at(-1) < minimumGapFrames) {
      if (novelty[index] > novelty[onsets.at(-1)]) onsets[onsets.length - 1] = index;
      continue;
    }
    onsets.push(index);
  }
  return onsets.map(index => index * hop / sampleRate);
}

function variableLength(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) buffer = (buffer << 8) | ((value & 0x7f) | 0x80);
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function classifyBreakbeat(samples, sampleRate, onset) {
  const start = Math.max(0, Math.round(onset * sampleRate));
  const end = Math.min(samples.length, start + Math.round(sampleRate * 0.075));
  const alpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  let low = 0;
  let lowEnergy = 0;
  let totalEnergy = 0;
  let crossings = 0;
  let previous = samples[start] || 0;
  for (let index = start; index < end; index++) {
    const sample = samples[index];
    low += alpha * (sample - low);
    lowEnergy += low * low;
    totalEnergy += sample * sample;
    if ((sample >= 0) !== (previous >= 0)) crossings++;
    previous = sample;
  }
  const count = Math.max(1, end - start);
  const lowRatio = lowEnergy / Math.max(0.000001, totalEnergy);
  const crossingRate = crossings / count;
  if (lowRatio > 0.45) return { midi: 36, group: "kick", lowRatio, crossingRate };
  if (lowRatio < 0.15 && crossingRate > 0.16) return { midi: 42, group: "hi-hat", lowRatio, crossingRate };
  return { midi: 38, group: "snare", lowRatio, crossingRate };
}

function writeMidi(hits) {
  const ppq = 480;
  const ticksPerSecond = 960;
  const events = [];
  let previousTick = 0;
  for (const hit of hits) {
    const tick = Math.max(previousTick, Math.round(hit.onset * ticksPerSecond));
    events.push(...variableLength(tick - previousTick), 0x99, hit.midi, 104);
    events.push(...variableLength(72), 0x89, hit.midi, 0);
    previousTick = tick + 72;
  }
  events.push(0x00, 0xff, 0x2f, 0x00);
  const header = Buffer.from([0x4d,0x54,0x68,0x64,0,0,0,6,0,0,0,1,ppq >> 8,ppq & 255]);
  const trackHeader = Buffer.alloc(8);
  trackHeader.write("MTrk", 0, "ascii");
  trackHeader.writeUInt32BE(events.length, 4);
  return Buffer.concat([header, trackHeader, Buffer.from(events)]);
}

let generated = 0;
for (const [phaseKey, phase] of Object.entries(plan.phases)) {
  if (!phase.publishRhythm) continue;
  const [characterId, phaseId] = phaseKey.split("/");
  const input = resolve(repositoryRoot, "apps/player/extensions/learn-sprunki/source-assets/sprunkis", characterId, "sounds", phaseId, phase.sourceAudio);
  const { samples, sampleRate } = readPcm16Wav(await readFile(input));
  const onsets = detectOnsets(samples, sampleRate);
  if (!onsets.length) throw new Error(`No rhythm onsets detected for ${phaseKey}`);
  const hits = onsets.map(onset => phase.rhythmLabel === "Breakbeat"
    ? { onset, ...classifyBreakbeat(samples, sampleRate, onset) }
    : { onset, midi: phase.rhythmMidiNote, group: phase.rhythmLabel.toLowerCase() });
  const outputDirectory = resolve(repositoryRoot, "apps/player/extensions/learn-sprunki/authoring/workbench/original-sprunki", characterId, phaseId);
  await mkdir(outputDirectory, { recursive: true });
  const stem = phase.sourceAudio.replace(/\.wav$/i, "");
  await writeFile(resolve(outputDirectory, `${stem}_rhythm.mid`), writeMidi(hits));
  await writeFile(resolve(outputDirectory, `${stem}_rhythm.json`), `${JSON.stringify({
    sourceAudio: phase.sourceAudio,
    rhythmLabel: phase.rhythmLabel,
    rhythmMidiNote: phase.rhythmMidiNote,
    detector: "energy-novelty-v1",
    hits: hits.map(hit => ({
      seconds: Number(hit.onset.toFixed(4)),
      midi: hit.midi,
      group: hit.group,
      ...(hit.lowRatio == null ? {} : {
        lowRatio: Number(hit.lowRatio.toFixed(4)),
        crossingRate: Number(hit.crossingRate.toFixed(4)),
      }),
    })),
  }, null, 2)}\n`);
  const groups = [...new Set(hits.map(hit => hit.group))].join(", ");
  console.log(`${phaseKey}: ${hits.length} ${phase.rhythmLabel.toLowerCase()} hits (${groups})`);
  generated++;
}
console.log(`Generated ${generated} rhythm MIDI drafts.`);
