'use strict';

/* =====================================================================
   NeoKeys — single-file Synthesia clone
   --------------------------------------------------------------------- */

// ---------- Constants ----------
const PIANO_MIN_MIDI = 21;  // A0
const PIANO_MAX_MIDI = 108; // C8
let FIRST_MIDI = PIANO_MIN_MIDI;
let LAST_MIDI  = PIANO_MAX_MIDI;
const STANDARD_KEYBOARD_SIZES = [25, 37, 49, 61, 73, 88];
const NOTE_NAMES    = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Solfège mapping — standard fixed-do system:
//   C=Do  D=Ré  E=Mi  F=Fa  G=Sol  A=La  B=Si
// Sharps carry the same accidental, e.g. C# → Do#, D# → Ré#.
const NOTE_NAMES_FR = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const WHITE_PATTERN = [true,false,true,false,true,true,false,true,false,true,false,true]; // from C

function isBlackKey(midi) {
  const n = midi % 12;
  return [1,3,6,8,10].includes(n);
}
// Active notation table — flipped by the Note-Naming toggle (state.notation).
function activeNoteTable() {
  return state.notation === 'french' ? NOTE_NAMES_FR : NOTE_NAMES;
}
function noteName(midi) {
  const t = activeNoteTable();
  return t[midi % 12] + (Math.floor(midi / 12) - 1);
}
function noteLetter(midi) {
  return activeNoteTable()[midi % 12];
}



// ---------- External song catalogue ----------
let defaultSongs = Object.create(null);
let lessonMetadataByTrackId = new Map();
let gameDefinitions = new Map();
let instrumentDefinitions = new Map();
let effectDefinitions = new Map();
let selectedGameId = null;

// ---------- Canvas setup ----------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
function preferredCanvasDpr() {
  const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.5 : 2);
}
let DPR = preferredCanvasDpr();
let W = 0, H = 0;        // CSS pixels
let pianoY = 0;          // top Y of piano bed (CSS px)
let pianoH = 0;          // piano bed height (CSS px)
let waterfallH = 0;      // height of waterfall area
let whiteKeyW = 0;
let whiteKeyH = 0;
let blackKeyW = 0;
let blackKeyH = 0;

// Pre-computed key layout
const keyLayout = []; // {midi, isBlack, x, w}

function buildLayout() {
  keyLayout.length = 0;
  // Count whites
  let whites = 0;
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) if (!isBlackKey(m)) whites++;
  whiteKeyW = W / whites;
  whiteKeyH = pianoH;
  blackKeyW = whiteKeyW * 0.6;
  blackKeyH = pianoH * 0.62;

  let xCursor = 0;
  // First pass: place whites and remember each midi's white-index x
  const whiteX = new Map();
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    if (!isBlackKey(m)) {
      whiteX.set(m, xCursor);
      keyLayout.push({ midi: m, isBlack: false, x: xCursor, w: whiteKeyW });
      xCursor += whiteKeyW;
    }
  }
  // Second pass: place blacks between their neighbors
  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    if (isBlackKey(m)) {
      // black sits between (m-1) and (m+1) whites
      const leftWhite = whiteX.get(m - 1);
      if (leftWhite === undefined) continue;
      const x = leftWhite + whiteKeyW - blackKeyW / 2;
      keyLayout.push({ midi: m, isBlack: true, x, w: blackKeyW });
    }
  }
  // sort so whites first, blacks last (for draw order)
  keyLayout.sort((a,b) => (a.isBlack?1:0) - (b.isBlack?1:0));
}

function getKey(midi) {
  const rhythm = state?.activeLesson?.lesson;
  if (rhythm?.playerMode === 'rhythm' && midi === rhythm.rhythmMidiNote) {
    return { midi, isBlack: false, x: W * 0.2, w: W * 0.6 };
  }
  for (let i = 0; i < keyLayout.length; i++) if (keyLayout[i].midi === midi) return keyLayout[i];
  return null;
}

function resize() {
  DPR = preferredCanvasDpr();
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Piano takes a chunk of bottom. Landscape: 22% (min 110, max 180). Portrait: 18%.
  const isLandscape = W > H;
  pianoH = isLandscape
    ? Math.max(110, Math.min(180, H * 0.22))
    : Math.max(90, Math.min(140, H * 0.18));
  pianoY = H - pianoH;
  waterfallH = pianoY;

  buildLayout();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------- State ----------
const state = {
  mode: 'normal',          // 'normal' | 'practice' | 'freeplay'
  hand: 'both',            // 'lh' | 'rh' | 'both'
  speed: 1.0,
  volume: 0.8,
  playing: false,
  // Timeline in milliseconds (song time)
  songTime: 0,
  songDuration: 0,
  lastFrameTs: 0,          // performance.now() of last frame
  // Notes
  notes: [],               // all notes, sorted by start time
  // Per-key live state
  activeMidiPressed: new Set(),    // physical input currently held
  scheduledOn: new Map(),  // midi -> { source, expires } for visual flash from playback
  // Wait-mode bookkeeping
  waiting: false,
  waitingFor: new Set(),   // midi notes that must be pressed to resume
  waitGroupEndTime: 0,
  waitStartedAt: 0,        // perf.now() when current wait began — used for scoring reaction time

  // ---- Freeplay mode ----
  // Each entry: { midi, hand, startTs, endTs (null while held) }
  freeplayBlocks: [],

  // ---- Session recording ----
  recording: {
    active: false,
    startTs: 0,
    events: [],            // {midi, velocity, startMs, durMs, _openAt}
    openByMidi: new Map(), // midi -> event currently being held (for off-pairing)
  },

  // ---- Scoring ----
  score: 0,
  floaters: [],            // {text, x, y, color, life, maxLife, vy}

  // ---- Hand split ----
  // -1 = auto (use original smart track/channel detection on load).
  // 20..108 = manual MIDI note number; notes >= threshold are RH, < are LH.
  handSplit: -1,

  // ---- Visible keyboard range ----
  // 'auto' picks the smallest standard keyboard that safely contains the
  // loaded song. A number is a preferred minimum size; it is expanded when a
  // song needs more notes so required keys are never hidden.
  keyboardRangeMode: '88',
  keyboardRangeExpanded: false,

  // ---- Victory flag ----
  songEnded: false,

  // ---- Note naming (Update 4) — 'english' | 'french' ----
  notation: 'english',

  // ---- Active track tracking (Update 3 — controls download button visibility) ----
  // Catalogue track id | 'upload' | 'recording' | null
  currentTrackId: null,
  currentTrackTitle: '',

  // ---- Active lesson presentation ----
  activeLesson: null,
  characterFrameIndex: -1,
  sprunkiLoopEnabled: true,
  activeEffect: null,
  effectParticles: [],
  theme: {
    lh: '#00d4ff',
    rh: '#ff3da6',
    background: '#06060c',
  },

  // ---- Last successful recording (kept around so the user can re-download
  //      even after they switch songs — but the button only shows while
  //      currentTrackId === 'recording'). ----
  recordedNotes: [],

  // ---- Practice scoring telemetry (Update 5 — feedback engine) ----
  practiceStats: {
    notesExpected: 0,    // total pause-relevant notes from the loaded song
    notesHit:      0,    // chord notes the user successfully struck
    reactionSum:   0,    // accumulated ms reaction time on hits
    reactionCount: 0,
    wrongNotes:    0,    // tally of awardMiss() events during the run
    maxScore:      0,    // notesExpected * 100
  },

  // ---- A-B Loop (Upgrade 1) ----
  // Three-state machine driven by the [A-B Loop] button beneath the scrubber:
  //   'off'       → no markers, no looping. First click captures A.
  //   'set-start' → loopStart captured at click time. Second click captures B
  //                  and flips to 'looping'.
  //   'looping'   → playhead seamlessly snaps loopStart whenever it crosses
  //                  loopEnd. Third click wipes both markers → 'off'.
  loopMode:  'off',
  loopStart: 0,     // ms — Marker A
  loopEnd:   0,     // ms — Marker B

  // ---- Independent left/right hand audio mute (Upgrade 4) ----
  // When true, the corresponding hand's notes are still drawn as falling
  // blocks and still feed practice scoring, but their automated playback skips
  // both the web-audio synth and the hardware MIDI out.
  muteLeftHand:  false,
  muteRightHand: false,

};

// ---------- Adaptive visible keyboard ----------
// Compact keyboards are always C-to-C, so neither edge slices through an
// octave. The full piano keeps its conventional A0-to-C8 88-key range.
function rangeForSize(size, requiredMin, requiredMax) {
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
  return candidates[0] || null;
}

function centredRangeForSize(size) {
  if (size === 88) return { first: PIANO_MIN_MIDI, last: PIANO_MAX_MIDI, size };
  // With no song loaded, centre the compact keyboard around middle C (C4).
  return rangeForSize(size, 60, 60);
}

function chooseKeyboardRange(notes, mode) {
  const supportedNotes = notes
    .map(note => Number(note.midi))
    .filter(midi => Number.isFinite(midi) && midi >= PIANO_MIN_MIDI && midi <= PIANO_MAX_MIDI);

  if (supportedNotes.length === 0) {
    const defaultSize = mode === 'auto' ? 49 : Number(mode);
    return centredRangeForSize(defaultSize) || centredRangeForSize(88);
  }

  const minNote = Math.min(...supportedNotes);
  const maxNote = Math.max(...supportedNotes);
  const paddedMin = Math.max(PIANO_MIN_MIDI, minNote - 2);
  const paddedMax = Math.min(PIANO_MAX_MIDI, maxNote + 2);
  const requestedSize = mode === 'auto' ? 25 : Number(mode);
  const allowedSizes = STANDARD_KEYBOARD_SIZES.filter(size => size >= requestedSize);

  // Prefer a little space outside the highest and lowest song notes. If a
  // manually requested size can only fit the exact notes, honour it before
  // expanding. Auto retains the breathing room by trying larger sizes first.
  if (mode === 'auto') {
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

function updateKeyboardRangeLabel() {
  const label = document.getElementById('keyboardRangeVal');
  if (!label) return;
  const prefix = state.keyboardRangeMode === 'auto'
    ? 'Auto · '
    : (state.keyboardRangeExpanded ? 'Expanded · ' : '');
  label.textContent = `${prefix}${LAST_MIDI - FIRST_MIDI + 1} keys · ${noteName(FIRST_MIDI)}–${noteName(LAST_MIDI)}`;
}

function updateKeyboardRangeForNotes() {
  const range = chooseKeyboardRange(state.notes, state.keyboardRangeMode);
  const requestedSize = state.keyboardRangeMode === 'auto' ? null : Number(state.keyboardRangeMode);
  state.keyboardRangeExpanded = requestedSize !== null && range.size > requestedSize;
  const changed = range.first !== FIRST_MIDI || range.last !== LAST_MIDI;
  FIRST_MIDI = range.first;
  LAST_MIDI = range.last;
  if (changed) buildLayout();
  updateKeyboardRangeLabel();
  return range;
}

// Look-ahead time (ms) for waterfall (how far above the hit line we render).
// pixelsPerSecond is computed from waterfallH so that ~3 seconds of music fits.
const LOOKAHEAD_MS = 3000;
function pxPerMs() { return waterfallH / LOOKAHEAD_MS; }

// ---------- Audio (Tone.js) ----------
// Multi-instrument architecture. `currentInstrument` is the active Tone.js
// polyphonic source — one of: Salamander Sampler (grand), PolySynth(Synth)
// for cyber/arcade/strings. `pianoSampler` is kept as a backwards-compat alias
// that always points at the active instrument so any leftover references in
// the file (scrub releaseAll, volume updates, etc.) keep working unchanged.
let currentInstrument     = null;
let currentInstrumentName = 'grand';
let pianoSampler          = null;  // legacy alias → currentInstrument
let audioReady            = false;
let muteWebAudio          = false; // when true, the web audio synth is silent
let webAudioOnly          = false; // when true, automated playback skips the hardware MIDI out and is voiced only through the web synth

// Cache of constructed instruments. Each entry: { node, fx: [extra Tone nodes] }.
const instruments = {};

// Build (lazily) and return one of the four sound profiles.
function buildInstrument(name) {
  if (instruments[name]) return instruments[name];
  let node, fx = [];
  switch (name) {
    case 'grand': {
      // Salamander acoustic grand — same sample set as before.
      node = new Tone.Sampler({
        urls: {
          "A0": "A0.mp3", "C1": "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
          "A1": "A1.mp3", "C2": "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
          "A2": "A2.mp3", "C3": "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
          "A3": "A3.mp3", "C4": "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
          "A4": "A4.mp3", "C5": "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
          "A5": "A5.mp3", "C6": "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
          "A6": "A6.mp3", "C7": "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
          "A7": "A7.mp3", "C8": "C8.mp3"
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
        onload: () => { console.log('Piano samples loaded'); }
      }).toDestination();
      break;
    }
    case 'cyber': {
      // Sawtooth poly synth → chorus + short delay for a wide neon lead.
      const chorus = new Tone.Chorus({
        frequency: 1.6, delayTime: 3.5, depth: 0.7, feedback: 0.18, wet: 0.55
      }).toDestination().start();
      const delay  = new Tone.FeedbackDelay({
        delayTime: 0.18, feedback: 0.22, wet: 0.18
      }).connect(chorus);
      node = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope:   { attack: 0.01, decay: 0.18, sustain: 0.55, release: 0.6 }
      }).connect(delay);
      fx = [delay, chorus];
      break;
    }
    case 'arcade': {
      // Classic chiptune square wave — no FX so it stays raw and punchy.
      node = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope:   { attack: 0.005, decay: 0.08, sustain: 0.7, release: 0.12 }
      }).toDestination();
      break;
    }
    case 'strings': {
      // Slow-attack pad through a gentle low-pass for a string-section feel.
      const filter = new Tone.Filter({
        type: 'lowpass', frequency: 2200, Q: 0.6
      }).toDestination();
      node = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope:   { attack: 0.85, decay: 0.4, sustain: 0.85, release: 2.4 }
      }).connect(filter);
      fx = [filter];
      break;
    }
    default:
      return null;
  }
  instruments[name] = { node, fx };
  return instruments[name];
}

// Apply current state.volume to a given instrument node, honoring mute. We use
// rampTo() for a click-free transition.
function applyVolumeToInstrument(inst) {
  if (!inst || !inst.node || !inst.node.volume) return;
  const target = muteWebAudio
    ? -Infinity
    : Tone.gainToDb(Math.max(0.0001, state.volume));
  try { inst.node.volume.rampTo(target, 0.04); }
  catch (e) { inst.node.volume.value = target; }
}

async function initAudio() {
  if (audioReady) return;
  await Tone.start();
  // Build the selected voice. A Sprunki lesson may choose it before the first
  // user gesture unlocks Web Audio on a tablet.
  const selected = buildInstrument(currentInstrumentName) || buildInstrument('grand');
  currentInstrument = selected.node;
  pianoSampler = currentInstrument;   // legacy alias
  applyVolumeToInstrument(selected);
  audioReady = true;
}

// Smoothly swap the active instrument:
//   1. releaseAll() on outgoing so we don't get hanging tails.
//   2. rampTo(-Infinity) on outgoing so the cut is inaudible.
//   3. Pivot pianoSampler / currentInstrument at the same instant.
//   4. rampTo(user volume) on the incoming instrument.
function setInstrument(name) {
  if (!audioReady) {
    // Pre-audio change just remembers the choice; initAudio() will pick it up.
    currentInstrumentName = name;
    return;
  }
  if (name === currentInstrumentName) return;
  const next = buildInstrument(name);
  if (!next) return;

  const prev = instruments[currentInstrumentName];
  if (prev && prev.node) {
    try { prev.node.releaseAll && prev.node.releaseAll(); } catch (e) {}
    try { prev.node.volume.rampTo(-Infinity, 0.05); } catch (e) {}
  }
  currentInstrument     = next.node;
  currentInstrumentName = name;
  pianoSampler          = currentInstrument;   // keep legacy alias in sync
  // Start the new instrument silent then ramp up — prevents pop/click as the
  // audio graph re-routes between sample-based and synth-based engines.
  try { next.node.volume.value = -Infinity; } catch (e) {}
  applyVolumeToInstrument(next);
}

// Re-apply the mute state to the *currently active* instrument so the toggle
// takes effect instantly without waiting for the next note.
function applyMuteState() {
  if (!audioReady) return;
  const inst = instruments[currentInstrumentName];
  if (muteWebAudio && inst && inst.node) {
    try { inst.node.releaseAll && inst.node.releaseAll(); } catch (e) {}
  }
  applyVolumeToInstrument(inst);
}

function playNote(midi, velocity = 0.8, durationSec = 0.5) {
  // Hardware pass-through: auto-playback (Normal mode song / recording replay)
  // routes Note-On/Off down the MIDI wire so the digital piano can voice the
  // song through its onboard sound engine — unless the user has opted into
  // "Web Audio Only", in which case we keep sound on the web speakers only.
  if (!webAudioOnly) {
    sendHardwareNoteOn(midi, velocity);
    sendHardwareNoteOffLater(midi, durationSec * 1000);
  }

  if (muteWebAudio) return;
  if (!audioReady || !currentInstrument) return;
  try {
    const n = Tone.Frequency(midi, "midi").toNote();
    currentInstrument.triggerAttackRelease(
      n, durationSec, undefined, Math.max(0.05, Math.min(1, velocity))
    );
  } catch (e) { /* ignore */ }
}
function attackNote(midi, velocity = 0.8) {
  // attackNote/releaseNote fire on *user* input (physical MIDI key / on-screen
  // touch). We deliberately do NOT echo those back to the hardware out: the
  // physical piano already voiced them locally, and echoing would create a
  // feedback loop / double-trigger on the same key.
  if (muteWebAudio) return;
  if (!audioReady || !currentInstrument) return;
  try {
    const n = Tone.Frequency(midi, "midi").toNote();
    currentInstrument.triggerAttack(n, undefined, Math.max(0.05, Math.min(1, velocity)));
  } catch (e) {}
}
function releaseNote(midi) {
  if (!audioReady || !currentInstrument) return;
  try {
    const n = Tone.Frequency(midi, "midi").toNote();
    currentInstrument.triggerRelease(n);
  } catch (e) {}
}

// ---------- Web MIDI ----------
const midiStatusEl = document.getElementById('midiStatus');
const midiStatusTextEl = document.getElementById('midiStatusText');

// Hardware MIDI outputs discovered via the Web MIDI API. We keep them in a
// flat array so the hot-path send helpers stay branch-free.
let midiOutputs = [];
// Pending hardware Note-Off timers — keyed by midi so we can cancel them on
// scrub / restart / song-end and avoid leaving the physical piano hanging.
const pendingHardwareOffs = new Map();

function sendHardwareNoteOn(midi, velocity = 0.8) {
  if (!midiOutputs.length) return;
  const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
  const msg = [0x90, midi & 0x7f, v];
  for (const out of midiOutputs) {
    try { out.send(msg); } catch (e) { /* device went away */ }
  }
}
function sendHardwareNoteOff(midi) {
  if (!midiOutputs.length) {
    const t = pendingHardwareOffs.get(midi);
    if (t) { clearTimeout(t); pendingHardwareOffs.delete(midi); }
    return;
  }
  const msg = [0x80, midi & 0x7f, 0];
  for (const out of midiOutputs) {
    try { out.send(msg); } catch (e) {}
  }
  const t = pendingHardwareOffs.get(midi);
  if (t) { clearTimeout(t); pendingHardwareOffs.delete(midi); }
}
function sendHardwareNoteOffLater(midi, ms) {
  if (!midiOutputs.length) return;
  // Cancel any previously-scheduled off for the same midi so we don't double-fire.
  const existing = pendingHardwareOffs.get(midi);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    sendHardwareNoteOff(midi);
    pendingHardwareOffs.delete(midi);
  }, Math.max(40, ms));
  pendingHardwareOffs.set(midi, t);
}
// Cancel every pending hardware-off and send an All-Notes-Off blast. Called on
// scrub / restart / song-end so the hardware piano never ends up holding a
// note when we jump the playhead.
function allHardwareNotesOff() {
  for (const t of pendingHardwareOffs.values()) clearTimeout(t);
  pendingHardwareOffs.clear();
  if (!midiOutputs.length) return;
  for (const out of midiOutputs) {
    try {
      // CC 123 (All Notes Off) on all 16 channels, plus a safety sweep of
      // explicit Note-Off messages across the 88-key range on channel 1 for
      // hardware that ignores CC 123 in local-keyboard mode.
      for (let ch = 0; ch < 16; ch++) out.send([0xB0 | ch, 123, 0]);
      for (let m = PIANO_MIN_MIDI; m <= PIANO_MAX_MIDI; m++) out.send([0x80, m, 0]);
    } catch (e) { /* ignore */ }
  }
}

async function initMIDI() {
  if (!navigator.requestMIDIAccess) {
    midiStatusEl.classList.add('warn');
    midiStatusTextEl.textContent = 'MIDI not supported';
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess({ sysex: false });
    const update = () => {
      let inCount = 0;
      for (const input of access.inputs.values()) {
        input.onmidimessage = onMIDIMessage;
        inCount++;
      }
      // Re-scan outputs each time so hot-plug works (USB-MIDI piano connected
      // mid-session, Bluetooth device pairing, OS-level driver reload, etc.).
      midiOutputs = [];
      for (const output of access.outputs.values()) {
        midiOutputs.push(output);
      }
      if (inCount > 0 || midiOutputs.length > 0) {
        midiStatusEl.classList.add('ok'); midiStatusEl.classList.remove('warn');
        const parts = [];
        if (inCount > 0)            parts.push(inCount + ' in');
        if (midiOutputs.length > 0) parts.push(midiOutputs.length + ' out');
        midiStatusTextEl.textContent = 'MIDI: ' + parts.join(' · ');
      } else {
        midiStatusEl.classList.remove('ok'); midiStatusEl.classList.add('warn');
        midiStatusTextEl.textContent = 'No MIDI device';
      }
    };
    update();
    access.onstatechange = update;
  } catch (err) {
    midiStatusEl.classList.add('warn');
    midiStatusTextEl.textContent = 'MIDI blocked';
  }
}

function onMIDIMessage(e) {
  const [status, d1, d2] = e.data;
  const cmd = status & 0xf0;
  if (cmd === 0x90 && d2 > 0) {
    // Note on — flag the event as coming from physical Web-MIDI input.
    handleUserNoteOn(d1, d2 / 127, true);
  } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
    handleUserNoteOff(d1, true);
  }
}

function handleUserNoteOn(midi, velocity, fromMidi) {
  state.activeMidiPressed.add(midi);
  attackNote(midi, velocity);

  // ---- Session recording capture ----
  if (state.recording.active) {
    const now = performance.now();
    const ev = {
      midi,
      velocity,
      startMs: now - state.recording.startTs,
      durMs: 0,
      _openAt: now,
    };
    state.recording.events.push(ev);
    state.recording.openByMidi.set(midi, ev);
  }

  // ---- Freeplay: spawn an upward-floating block ----
  if (state.mode === 'freeplay') {
    const hand = (state.handSplit >= 0)
      ? (midi >= state.handSplit ? 'rh' : 'lh')
      : (midi >= 60 ? 'rh' : 'lh');
    state.freeplayBlocks.push({
      midi, hand,
      startTs: performance.now(),
      endTs: null,
    });
  }

  // ---- Practice mode: waiting-set satisfaction + scoring ----
  if (state.waiting && state.waitingFor.has(midi)) {
    awardHit(midi);
    state.waitingFor.delete(midi);
    if (state.waitingFor.size === 0) {
      // Chord fully satisfied → resume playback
      state.waiting = false;
      hideWaitBanner();
    }
  } else if (state.waiting && state.mode === 'practice') {
    // Wrong note while waiting → penalty
    awardMiss(midi);
  }
}
function handleUserNoteOff(midi, fromMidi) {
  state.activeMidiPressed.delete(midi);
  releaseNote(midi);

  // ---- Session recording: close out the open event for this midi ----
  if (state.recording.active) {
    const ev = state.recording.openByMidi.get(midi);
    if (ev) {
      ev.durMs = Math.max(40, performance.now() - ev._openAt);
      state.recording.openByMidi.delete(midi);
    }
  }

  // ---- Freeplay: terminate the trailing edge of the most recent open block ----
  if (state.mode === 'freeplay') {
    // Find the newest still-open block for this midi and close it.
    for (let i = state.freeplayBlocks.length - 1; i >= 0; i--) {
      const b = state.freeplayBlocks[i];
      if (b.midi === midi && b.endTs == null) {
        b.endTs = performance.now();
        break;
      }
    }
  }
}

// ---------- Scoring ----------
const scoreValEl = () => document.getElementById('scoreVal');
function setScore(v) {
  state.score = v;
  const el = scoreValEl();
  if (el) el.textContent = String(v);
}
function awardHit(midi) {
  // Scale points by reaction speed: instant ≤150 ms → +100; linearly down to +20 by 1500 ms.
  const reaction = state.waitStartedAt > 0
    ? Math.max(0, performance.now() - state.waitStartedAt)
    : 0;
  let pts;
  if (reaction <= 150)      pts = 100;
  else if (reaction >= 1500) pts = 20;
  else                       pts = Math.round(100 - ((reaction - 150) / (1500 - 150)) * 80);
  setScore(state.score + pts);
  spawnFloater('+' + pts, midi, pts >= 90 ? '#36e07f' : '#7c5cff');
  // Practice telemetry — fuels the feedback engine on the victory screen.
  state.practiceStats.notesHit      += 1;
  state.practiceStats.reactionSum   += reaction;
  state.practiceStats.reactionCount += 1;
}
function awardMiss(midi) {
  setScore(state.score - 50);
  spawnFloater('-50', midi, '#ff5577');
  state.practiceStats.wrongNotes += 1;
}
function resetPracticeStats() {
  // Pre-count the total pause-relevant notes in the loaded song so the
  // feedback engine knows the user's maximum possible score before the
  // first key is even pressed. This recomputes for the *current* hand
  // setting, which is what the practice engine actually evaluates.
  const want = (h) => state.hand === 'both' ? true : (state.hand === h);
  let n = 0;
  for (const note of state.notes) if (want(note.hand)) n++;
  state.practiceStats = {
    notesExpected: n,
    notesHit:      0,
    reactionSum:   0,
    reactionCount: 0,
    wrongNotes:    0,
    maxScore:      n * 100,
  };
}
function spawnFloater(text, midi, color) {
  const key = getKey(midi);
  if (!key) return;
  // Upgrade 2 — Smooth linear floating-text animation. The previous values
  // (vy=-0.6, maxLife=900) combined with a font-size easing curve created a
  // jarring "pop and bounce" effect during fast runs. We now drift the text
  // straight up at a calm constant velocity over a tight 600 ms lifespan and
  // the renderer fades opacity linearly from 1.0 → 0.0 across that window.
  state.floaters.push({
    text,
    color,
    x: key.x + key.w / 2,
    y: pianoY - 6,
    vy: -0.06,                 // px / ms — gentle constant upward drift
    life: 0,
    maxLife: 600,              // ms — clean, elegant fade-out window
  });
}

// ---------- MIDI File Parsing ----------
const fileInput = document.getElementById('fileInput');
const fileNameEl = document.getElementById('fileName');

fileInput.addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  fileNameEl.textContent = f.name;
  try {
    const buf = await f.arrayBuffer();
    // @tonejs/midi exposes `Midi` global via UMD
    const midi = new Midi(buf);
    state.currentTrackId    = 'upload';
    state.currentTrackTitle = f.name;
    activateLessonPresentation(null);
    loadMidiObject(midi);
    updateTracksMenuActive();
    updateDownloadButtonVisibility();
  } catch (err) {
    console.error(err);
    alert('Failed to parse MIDI: ' + err.message);
  }
});

function applyHandSplit() {
  // Re-color all loaded notes (and any freeplay blocks) according to the
  // current state.handSplit. When -1 we leave whatever was decided on load
  // (the smart track/channel heuristic).
  if (state.handSplit < 0) return;
  const t = state.handSplit;
  for (const n of state.notes) {
    n.hand = n.midi >= t ? 'rh' : 'lh';
  }
  for (const b of state.freeplayBlocks) {
    b.hand = b.midi >= t ? 'rh' : 'lh';
  }
}

function loadMidiObject(midi) {
  // Build flat note list with absolute ms.
  const notes = [];
  // Heuristic: split by track first.
  const tracks = midi.tracks.filter(t => t.notes && t.notes.length > 0);

  // Compute average pitch per track to guess LH vs RH.
  const trackInfo = tracks.map((t, idx) => {
    let sum = 0; let n = 0;
    for (const note of t.notes) { sum += note.midi; n++; }
    return { idx, avg: n>0?sum/n:60, count: n, name: (t.name||'').toLowerCase() };
  });

  let lhTrackIdx = new Set();
  if (trackInfo.length >= 2) {
    // If track names hint, use those
    const namedLH = trackInfo.filter(t => /left|bass|l\.h|lh/i.test(t.name));
    const namedRH = trackInfo.filter(t => /right|treble|r\.h|rh|melody/i.test(t.name));
    if (namedLH.length || namedRH.length) {
      namedLH.forEach(t => lhTrackIdx.add(t.idx));
    } else {
      // Two-track guess: the lower-avg track is LH
      const sorted = [...trackInfo].sort((a,b)=>a.avg-b.avg);
      lhTrackIdx.add(sorted[0].idx);
    }
  }

  for (let ti = 0; ti < tracks.length; ti++) {
    const t = tracks[ti];
    // Find original index in midi.tracks for channel info
    const origIdx = midi.tracks.indexOf(t);
    const isLH = lhTrackIdx.has(origIdx);
    for (const note of t.notes) {
      const startMs = note.time * 1000;
      const durMs = Math.max(40, note.duration * 1000);
      notes.push({
        midi: note.midi,
        startMs,
        endMs: startMs + durMs,
        durMs,
        velocity: note.velocity,
        hand: isLH ? 'lh' : 'rh',
        // playback bookkeeping
        triggered: false,
        released: false,
      });
    }
  }

  notes.sort((a,b) => a.startMs - b.startMs);

  // If only one track and many notes — split by pitch (middle C ~ 60)
  if (lhTrackIdx.size === 0 && notes.length > 0) {
    for (const n of notes) n.hand = n.midi < 60 ? 'lh' : 'rh';
  }

  state.notes = notes;
  updateKeyboardRangeForNotes();
  state.songDuration = notes.length ? Math.max(...notes.map(n => n.endMs)) + 1000 : 0;
  const lessonLoopDuration = state.activeLesson && state.activeLesson.lesson.loopDurationMs;
  if (Number.isFinite(lessonLoopDuration) && lessonLoopDuration > 0) {
    state.songDuration = lessonLoopDuration;
  }
  state.songTime = 0;
  state.waiting = false;
  state.waitingFor.clear();
  hideWaitBanner();
  // Reset trigger flags
  for (const n of state.notes) { n.triggered = false; n.released = false; }
  // Reset scoring & end-of-song flag for the fresh track
  setScore(0);
  resetPracticeStats();
  state.songEnded = false;
  hideVictoryOverlay();
  // If the user has overridden the split, re-apply it on top of the smart guess.
  applyHandSplit();
  // Auto play
  setPlaying(true);
}



// ---------- Built-in songs loader (Update 1) ----------
// Wraps loadMidiObject() so the in-app track menu uses the exact same parsing
// path as the file-upload flow. Also tags currentTrackId so the conditional
// download button stays in sync.
async function loadDefaultSong(trackId) {
  const song = defaultSongs[trackId];
  if (!song) return;
  try {
    // Audio activation can remain pending on some tablet browsers. Loading and
    // drawing the lesson must not wait for that browser-level permission state.
    initAudio().catch(err => console.warn('Audio is not ready yet:', err));
    const response = await fetch(song.midi);
    if (!response.ok) {
      throw new Error(`MIDI request failed (${response.status})`);
    }
    const buf  = await response.arrayBuffer();
    const midi = new Midi(buf);
    state.currentTrackId    = trackId;
    state.currentTrackTitle = song.title;
    activateLessonPresentation(trackId);
    loadMidiObject(midi);
    fileNameEl.textContent = song.title;
    updateTracksMenuActive();
    updateDownloadButtonVisibility();
    const draftLabel = song.reviewStatus === 'draft'
      ? (song.lesson?.playerMode === 'rhythm' ? ' · draft rhythm lesson' : ' · draft transcription')
      : '';
    showToast(song.emoji + '  Loaded: ' + song.title + draftLabel, 'ok');
    const tabletLayout = window.innerWidth <= 1180 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    if (state.activeLesson && tabletLayout && panel) panel.classList.add('collapsed');
  } catch (err) {
    console.error('Failed to load built-in song:', err);
    showToast('Failed to load track: ' + err.message, 'err');
  }
}

// ---------- Toast helper (Update 2 / 3 messaging) ----------
let _toastTimer = null;
function showToast(msg, kind) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('ok');
  if (kind === 'ok') el.classList.add('ok');
  el.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2400);
}

// ---------- Inline MIDI writer (Update 3) ----------
// We prefer the loaded MidiWriterJS CDN library for clean, well-formed files;
// if it failed to load for any reason we fall back to a lightweight inline
// SMF (Standard MIDI File) encoder so the download button never breaks.
function exportRecordingToMidi(notes, trackName) {
  // Try MidiWriterJS path first — it produces musically clean output and
  // handles delta-time / VLQ encoding for us.
  if (typeof MidiWriter !== 'undefined' && MidiWriter && MidiWriter.Track) {
    try {
      const track = new MidiWriter.Track();
      track.addTrackName(trackName || 'NeoKeys Recording');
      // 500_000 µs/quarter = 120 BPM (default). We position notes by absolute
      // ticks, computed from milliseconds at 480 PPQ.
      const PPQ = 128;
      const MS_PER_TICK = 500 / PPQ;   // at 120 BPM, 500ms per beat
      for (const n of notes) {
        const startTick = Math.max(0, Math.round(n.startMs / MS_PER_TICK));
        const durTicks  = Math.max(1, Math.round((n.durMs || (n.endMs - n.startMs)) / MS_PER_TICK));
        const ev = new MidiWriter.NoteEvent({
          pitch:    [n.midi],
          duration: 'T' + durTicks,
          velocity: Math.max(1, Math.min(127, Math.round((n.velocity || 0.8) * 127))),
          startTick,
        });
        track.addEvent(ev);
      }
      const w = new MidiWriter.Writer([track]);
      // Returns a "data:audio/midi;base64,XXXX" URI in browser builds.
      return w.dataUri();
    } catch (err) {
      console.warn('MidiWriterJS path failed, falling back to inline encoder:', err);
    }
  }

  // ----- Fallback: tiny inline SMF Type-0 encoder -----
  // Builds a single-track Type-0 file with absolute-time → delta-time events.
  const PPQ = 480;
  const TEMPO_US = 500000;             // microseconds per quarter (120 BPM)
  const MS_PER_TICK = (TEMPO_US / 1000) / PPQ;
  const events = []; // {tick, bytes:[...]}
  for (const n of notes) {
    const startTick = Math.max(0, Math.round(n.startMs / MS_PER_TICK));
    const endTick   = startTick + Math.max(1, Math.round((n.durMs || (n.endMs - n.startMs)) / MS_PER_TICK));
    const vel = Math.max(1, Math.min(127, Math.round((n.velocity || 0.8) * 127)));
    events.push({ tick: startTick, bytes: [0x90, n.midi & 0x7f, vel] });
    events.push({ tick: endTick,   bytes: [0x80, n.midi & 0x7f, 0]   });
  }
  events.sort((a, b) => a.tick - b.tick);

  // Variable-length quantity encoder used by SMF for delta-times.
  function vlq(value) {
    const out = [];
    let buffer = value & 0x7f;
    value >>= 7;
    while (value > 0) {
      buffer <<= 8;
      buffer |= ((value & 0x7f) | 0x80);
      value >>= 7;
    }
    while (true) {
      out.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return out;
  }

  // Track data
  const trackData = [];
  // Tempo meta
  trackData.push(0x00, 0xff, 0x51, 0x03,
    (TEMPO_US >> 16) & 0xff, (TEMPO_US >> 8) & 0xff, TEMPO_US & 0xff);
  // Track name meta
  const nameStr = (trackName || 'NeoKeys Recording').slice(0, 64);
  trackData.push(0x00, 0xff, 0x03, nameStr.length);
  for (let i = 0; i < nameStr.length; i++) trackData.push(nameStr.charCodeAt(i) & 0x7f);

  let prevTick = 0;
  for (const ev of events) {
    const delta = ev.tick - prevTick;
    prevTick = ev.tick;
    for (const b of vlq(delta)) trackData.push(b);
    for (const b of ev.bytes)   trackData.push(b);
  }
  // End-of-track meta
  trackData.push(0x00, 0xff, 0x2f, 0x00);

  // Assemble header chunk (MThd) + track chunk (MTrk)
  const header = [
    0x4d, 0x54, 0x68, 0x64,              // "MThd"
    0x00, 0x00, 0x00, 0x06,              // header length
    0x00, 0x00,                          // format 0
    0x00, 0x01,                          // 1 track
    (PPQ >> 8) & 0xff, PPQ & 0xff,       // division
  ];
  const trackLen = trackData.length;
  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b,              // "MTrk"
    (trackLen >> 24) & 0xff,
    (trackLen >> 16) & 0xff,
    (trackLen >>  8) & 0xff,
    trackLen         & 0xff,
  ];
  const bytes = new Uint8Array(header.length + trackHeader.length + trackData.length);
  let off = 0;
  bytes.set(header, off);       off += header.length;
  bytes.set(trackHeader, off);  off += trackHeader.length;
  bytes.set(trackData, off);

  // Convert to base64 data-URI for symmetry with the MidiWriterJS path.
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/midi;base64,' + btoa(bin);
}

function downloadRecording() {
  if (!state.recordedNotes || state.recordedNotes.length === 0) {
    showToast('No recording available to download.', 'err');
    return;
  }
  const dataUri = exportRecordingToMidi(state.recordedNotes, 'NeoKeys Recording');
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  a.href = dataUri;
  a.download = 'neokeys-recording-' + stamp + '.mid';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('💾  Recording saved as .mid', 'ok');
}

function updateDownloadButtonVisibility() {
  const btn = document.getElementById('downloadMidiBtn');
  if (!btn) return;
  // Only show when the active track is the user's own recording.
  if (state.currentTrackId === 'recording' && state.recordedNotes.length > 0) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}

// ---------- UI bindings ----------
const speedSlider = document.getElementById('speedSlider');
const speedVal = document.getElementById('speedVal');
const volSlider = document.getElementById('volSlider');
const volVal = document.getElementById('volVal');
const modeNormalBtn = document.getElementById('modeNormal');
const modePracticeBtn = document.getElementById('modePractice');
const handLHBtn = document.getElementById('handLH');
const handRHBtn = document.getElementById('handRH');
const handBothBtn = document.getElementById('handBoth');
const playBtn = document.getElementById('playBtn');
const rewindBtn = document.getElementById('rewindBtn');
const modeFreeplayBtn = document.getElementById('modeFreeplay');
const recordBtn = document.getElementById('recordBtn');
const handSplitSlider = document.getElementById('handSplitSlider');
const handSplitVal = document.getElementById('handSplitVal');
const keyboardRangeSelect = document.getElementById('keyboardRangeSelect');
const victoryOverlay = document.getElementById('victoryOverlay');
const victoryTitle = document.getElementById('victoryTitle');
const victorySub = document.getElementById('victorySub');
const victoryActions = document.getElementById('victoryActions');
const victoryTrophy = document.getElementById('victoryTrophy');
const victoryScoreWrap = document.getElementById('victoryScore');
const victoryScoreVal = document.getElementById('victoryScoreVal');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const startFullscreenBtn = document.getElementById('startFullscreenBtn');
const panelToggleBtn = document.getElementById('panelToggleBtn');
const panel = document.getElementById('panel');
// Wait-banner element removed in NeoKeys redesign — keep null refs so legacy callers stay safe.
const waitBanner = null;
const waitText = null;
const timelineSlider = document.getElementById('timelineSlider');
const timelineVal = document.getElementById('timelineVal');
let timelineScrubbing = false;

function formatTime(ms) {
  if (!isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m + ':' + (s < 10 ? '0' + s : s);
}

function updateTimelineUI() {
  if (!timelineSlider) return;
  const dur = state.songDuration || 0;
  if (!timelineScrubbing) {
    const pct = dur > 0 ? (state.songTime / dur) * 1000 : 0;
    timelineSlider.value = String(Math.max(0, Math.min(1000, pct)));
  }
  if (timelineVal) {
    timelineVal.textContent = formatTime(state.songTime) + ' / ' + formatTime(dur);
  }
}

function scrubToTime(newTime) {
  const dur = state.songDuration || 0;
  const clamped = Math.max(0, Math.min(dur, newTime));
  state.songTime = clamped;
  // Reset wait-state so we don't stay frozen waiting for a chord that already passed.
  state.waiting = false;
  state.waitingFor.clear();
  hideWaitBanner();
  // Recompute trigger/release flags relative to the new playhead so the canvas
  // loop and audio scheduler stay consistent whether the user scrubbed forward
  // or backward.
  for (const n of state.notes) {
    if (n.endMs < clamped) {
      // Note is fully in the past — mark as triggered & released so it won't replay
      n.triggered = true;
      n.released = true;
    } else if (n.startMs <= clamped && clamped <= n.endMs) {
      // Note straddles the playhead — consider it already triggered (don't retrigger sound)
      n.triggered = true;
      n.released = false;
    } else {
      // Future note — reset so it will trigger normally as time advances
      n.triggered = false;
      n.released = false;
    }
  }
  // Release any sustained audio so we don't get hung notes after a jump.
  if (audioReady && currentInstrument) {
    try { currentInstrument.releaseAll && currentInstrument.releaseAll(); }
    catch (e) { /* ignore */ }
  }
  // And kill any in-flight hardware notes so the physical piano doesn't get
  // stuck holding a key after the playhead jumps.
  allHardwareNotesOff();
  state.lastFrameTs = performance.now();
}

if (timelineSlider) {
  timelineSlider.addEventListener('pointerdown', () => { timelineScrubbing = true; });
  timelineSlider.addEventListener('pointerup',   () => { timelineScrubbing = false; });
  timelineSlider.addEventListener('touchstart',  () => { timelineScrubbing = true; }, { passive: true });
  timelineSlider.addEventListener('touchend',    () => { timelineScrubbing = false; });
  timelineSlider.addEventListener('input', () => {
    timelineScrubbing = true;
    const dur = state.songDuration || 0;
    const pct = parseFloat(timelineSlider.value) / 1000;
    scrubToTime(pct * dur);
    if (timelineVal) {
      timelineVal.textContent = formatTime(state.songTime) + ' / ' + formatTime(dur);
    }
  });
  timelineSlider.addEventListener('change', () => { timelineScrubbing = false; });
}

speedSlider.addEventListener('input', () => {
  state.speed = parseFloat(speedSlider.value);
  speedVal.textContent = state.speed.toFixed(2) + '×';
});
volSlider.addEventListener('input', () => {
  state.volume = parseInt(volSlider.value, 10) / 100;
  volVal.textContent = volSlider.value + '%';
  // Route through the shared helper so the mute state is always respected and
  // we never click/pop on rapid slider drags.
  applyVolumeToInstrument(instruments[currentInstrumentName]);
});
if (keyboardRangeSelect) {
  keyboardRangeSelect.addEventListener('change', () => {
    state.keyboardRangeMode = keyboardRangeSelect.value;
    const range = updateKeyboardRangeForNotes();
    if (state.keyboardRangeExpanded) {
      showToast(`This song needs ${range.size} keys, so the keyboard was expanded.`, 'ok');
    }
  });
}

function setMode(m) {
  const prev = state.mode;
  state.mode = m;
  modeNormalBtn.classList.toggle('active',   m === 'normal');
  modePracticeBtn.classList.toggle('active', m === 'practice');
  modeFreeplayBtn.classList.toggle('active', m === 'freeplay');

  // Always exit any wait state when switching modes.
  state.waiting = false; state.waitingFor.clear(); hideWaitBanner();

  if (m === 'freeplay') {
    // Freeplay totally ignores the loaded song. Pause the timeline, clear visual
    // note grid, and start with an empty block buffer so the canvas is clean.
    setPlaying(false);
    state.freeplayBlocks.length = 0;
    state.floaters.length = 0;
    hideVictoryOverlay();
  } else if (prev === 'freeplay') {
    // Coming back from freeplay → drop any lingering floating blocks.
    state.freeplayBlocks.length = 0;
  }

  if (m === 'practice') {
    // Fresh practice run: zero the score so the user sees their progress for this attempt.
    setScore(0);
    resetPracticeStats();
  }
}
modeNormalBtn.addEventListener('click',   () => setMode('normal'));
modePracticeBtn.addEventListener('click', () => setMode('practice'));
modeFreeplayBtn.addEventListener('click', () => setMode('freeplay'));

function setHand(h) {
  state.hand = h;
  handLHBtn.classList.toggle('active', h === 'lh');
  handRHBtn.classList.toggle('active', h === 'rh');
  handBothBtn.classList.toggle('active', h === 'both');
}
handLHBtn.addEventListener('click', () => { setHand('lh');   resetPracticeStats(); });
handRHBtn.addEventListener('click', () => { setHand('rh');   resetPracticeStats(); });
handBothBtn.addEventListener('click', () => { setHand('both'); resetPracticeStats(); });

function setPlaying(p) {
  state.playing = p;
  playBtn.textContent = p ? '⏸' : '▶';
  playBtn.classList.toggle('paused', !p);
  if (p) state.lastFrameTs = performance.now();
}
playBtn.addEventListener('click', async () => {
  await initAudio();
  // If the song already ended, treat play as a clean restart.
  if (state.songEnded) {
    restartCurrentSong();
    return;
  }
  setPlaying(!state.playing);
});
function restartCurrentSong() {
  state.songTime = 0;
  state.waiting = false; state.waitingFor.clear();
  hideWaitBanner();
  for (const n of state.notes) { n.triggered = false; n.released = false; }
  setScore(0);
  resetPracticeStats();
  state.songEnded = false;
  hideVictoryOverlay();
  if (audioReady && currentInstrument) {
    try { currentInstrument.releaseAll && currentInstrument.releaseAll(); } catch(e) {}
  }
  // Kill any lingering hardware notes from the previous run before we restart.
  allHardwareNotesOff();
  setPlaying(true);
}
rewindBtn.addEventListener('click', () => {
  restartCurrentSong();
});

// ---------- Recording transport ----------
function startRecording() {
  // Cleanly start a fresh recording session. Audio sampler is initialized
  // lazily on first user gesture (handled by the start overlay), so by the
  // time the button is clickable we should be ready.
  state.recording.active = true;
  state.recording.startTs = performance.now();
  state.recording.events = [];
  state.recording.openByMidi.clear();
  recordBtn.classList.add('recording');
  recordBtn.textContent = '■';
  recordBtn.title = 'Stop recording';
}
function stopRecording() {
  state.recording.active = false;
  recordBtn.classList.remove('recording');
  recordBtn.textContent = '●';
  recordBtn.title = 'Record (Freeplay mode only)';

  // Close any keys still being held when the user hit stop.
  const stopTs = performance.now();
  for (const ev of state.recording.openByMidi.values()) {
    ev.durMs = Math.max(40, stopTs - ev._openAt);
  }
  state.recording.openByMidi.clear();

  if (state.recording.events.length === 0) {
    // Nothing was played — bail without clobbering the loaded song.
    showToast('Recording stopped — nothing captured.', 'err');
    return;
  }

  // Pack into the app's native note structure.
  const notes = state.recording.events.map(ev => {
    const startMs = ev.startMs;
    const durMs = Math.max(40, ev.durMs);
    const hand = (state.handSplit >= 0)
      ? (ev.midi >= state.handSplit ? 'rh' : 'lh')
      : (ev.midi >= 60 ? 'rh' : 'lh');
    return {
      midi: ev.midi,
      startMs,
      endMs: startMs + durMs,
      durMs,
      velocity: ev.velocity,
      hand,
      triggered: false,
      released: false,
    };
  }).sort((a, b) => a.startMs - b.startMs);

  // Load straight into state.notes — wipes any previously loaded song.
  state.notes = notes;
  updateKeyboardRangeForNotes();
  // Stash a clean copy for the .mid downloader — survives mode/song switches.
  state.recordedNotes = notes.map(n => ({
    midi: n.midi, startMs: n.startMs, endMs: n.endMs,
    durMs: n.durMs, velocity: n.velocity, hand: n.hand,
  }));
  state.songDuration = notes.length
    ? Math.max(...notes.map(n => n.endMs)) + 1000
    : 0;
  state.songTime = 0;
  state.waiting = false; state.waitingFor.clear();
  hideWaitBanner();
  setScore(0);
  state.songEnded = false;
  hideVictoryOverlay();
  fileNameEl.textContent = 'My Recording';
  state.currentTrackId    = 'recording';
  state.currentTrackTitle = 'My Recording';
  activateLessonPresentation(null);
  updateTracksMenuActive();
  updateDownloadButtonVisibility();
  // Per spec (Update 2): always transition to Normal Mode after Stop Recording
  // so the user can immediately watch & hear their take play back. They can
  // manually switch to Practice afterwards from the mode row.
  setMode('normal');
  setPlaying(true);
  showToast('⏹  Recording captured · switched to Normal mode', 'ok');
}
recordBtn.addEventListener('click', async () => {
  await initAudio();
  // If already recording, allow Stop from any mode (Stop performs its own
  // mode-transition logic — see stopRecording()).
  if (state.recording.active) {
    stopRecording();
    return;
  }
  // GATE (Update 2): you can only START a recording while in Freeplay mode.
  // Otherwise notify the user and bail — recording in Normal/Practice would
  // capture auto-playback events from the engine, which is never what the
  // user wants.
  if (state.mode !== 'freeplay') {
    showToast('🎙  Switch to Freeplay mode first to record.', 'err');
    return;
  }
  startRecording();
});

// ---------- Hand-split slider ----------
function updateHandSplitLabel() {
  if (!handSplitVal) return;
  if (state.handSplit < 0) {
    handSplitVal.textContent = 'Auto';
  } else {
    handSplitVal.textContent = noteName(state.handSplit) + ' (' + state.handSplit + ')';
  }
}
if (handSplitSlider) {
  // Initial label.
  updateHandSplitLabel();
  handSplitSlider.addEventListener('input', () => {
    state.handSplit = parseInt(handSplitSlider.value, 10);
    updateHandSplitLabel();
    applyHandSplit();
  });
}

// ---------- Victory / end-of-song modal ----------
function hideVictoryOverlay() {
  if (victoryOverlay) victoryOverlay.classList.add('hidden');
}
function buildPracticeFeedback(stats, score) {
  // Heuristic coach. Returns plain-text feedback evaluating tempo of striking,
  // accuracy, and wrong-note count. Designed to feel encouraging when the
  // user did well, and constructively diagnostic when they struggled.
  const avgReaction = stats.reactionCount > 0
    ? stats.reactionSum / stats.reactionCount
    : 0;
  const completion = stats.notesExpected > 0
    ? stats.notesHit / stats.notesExpected
    : 0;

  let headline;
  if (avgReaction <= 220 && completion >= 0.9 && stats.wrongNotes <= 2) {
    headline = '🔥  Outstanding! Your timing is razor-sharp — almost every note hit right on the line.';
  } else if (avgReaction <= 380 && completion >= 0.8) {
    headline = '✨  Strong run! You’re clearly reading ahead and reacting quickly.';
  } else if (avgReaction >= 700) {
    headline = '🐢  You’re getting the notes, but there’s a noticeable delay before each hit. Try slowing the tempo down so your fingers can lead, not chase.';
  } else if (completion < 0.5) {
    headline = '🌱  Plenty of room to grow — try the left or right hand alone first, then bring them back together.';
  } else if (stats.wrongNotes >= 8) {
    headline = '🎯  Solid effort! Focus on accuracy next — pause on the chord shapes before you commit.';
  } else {
    headline = '👍  Nice work — keep it up! Steady practice will close the gaps.';
  }

  return headline;
}

function showVictoryOverlay() {
  if (!victoryOverlay) return;
  // Stop playback while the modal is up so audio doesn't keep advancing.
  setPlaying(false);

  const isPractice = state.mode === 'practice';
  victoryTrophy.textContent = isPractice ? '🎯' : '🏆';
  victoryTitle.textContent  = isPractice ? 'Practice Complete!' : 'Song Complete!';
  victorySub.textContent    = isPractice
    ? 'Great work — try it again or take it up a level.'
    : 'Nice run. What\'s next?';

  // Strip any previously injected feedback elements so they don't stack
  // across replays.
  const card = victoryOverlay.querySelector('.victory-card');
  if (card) {
    card.querySelectorAll('.max-score, .feedback-box').forEach(el => el.remove());
  }

  // Show score in practice mode only (Normal mode doesn't score).
  if (isPractice) {
    victoryScoreWrap.style.display = '';
    victoryScoreVal.textContent = String(state.score);

    // ---- Update 5: max-possible-score line + AI-style feedback box ----
    const stats = state.practiceStats;
    const maxScore = Math.max(stats.maxScore, state.score); // never lie if we somehow scored higher
    const maxLine = document.createElement('div');
    maxLine.className = 'max-score';
    maxLine.innerHTML = 'out of <b>' + maxScore.toLocaleString() + '</b> possible '
      + '<span style="opacity:0.6;">· ' + stats.notesExpected + ' notes × 100</span>';
    victoryScoreWrap.insertAdjacentElement('afterend', maxLine);

    const avgReaction = stats.reactionCount > 0
      ? Math.round(stats.reactionSum / stats.reactionCount)
      : 0;
    const accuracyPct = stats.notesExpected > 0
      ? Math.round((stats.notesHit / stats.notesExpected) * 100)
      : 0;
    const feedback = buildPracticeFeedback(stats, state.score);

    const fb = document.createElement('div');
    fb.className = 'feedback-box';
    fb.innerHTML =
      '<div class="fb-title">🤖  Performance Feedback</div>' +
      '<div>' + feedback + '</div>' +
      '<div class="fb-stats">' +
        '<span class="fb-stat good"><b>' + accuracyPct + '%</b>Accuracy</span>' +
        '<span class="fb-stat"><b>' + avgReaction + 'ms</b>Avg Reaction</span>' +
        '<span class="fb-stat"><b>' + stats.notesHit + '/' + stats.notesExpected + '</b>Notes Hit</span>' +
        '<span class="fb-stat ' + (stats.wrongNotes > 0 ? 'bad' : '') + '"><b>' + stats.wrongNotes + '</b>Wrong Notes</span>' +
      '</div>';
    maxLine.insertAdjacentElement('afterend', fb);
  } else {
    victoryScoreWrap.style.display = 'none';
  }

  // Build the action buttons fresh each time so listeners don't pile up.
  victoryActions.innerHTML = '';
  const mkBtn = (label, primary, onClick) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (primary) b.classList.add('primary');
    b.addEventListener('click', onClick);
    victoryActions.appendChild(b);
  };
  mkBtn('🔁  Restart Song', true, () => {
    hideVictoryOverlay();
    restartCurrentSong();
  });
  mkBtn('📁  Choose New Song', false, () => {
    hideVictoryOverlay();
    fileInput.click();
  });
  if (isPractice) {
    mkBtn('🎼  Switch to Normal Mode', false, () => {
      hideVictoryOverlay();
      setMode('normal');
      restartCurrentSong();
    });
  } else {
    mkBtn('🎯  Switch to Practice Mode', false, () => {
      hideVictoryOverlay();
      setMode('practice');
      restartCurrentSong();
    });
  }

  victoryOverlay.classList.remove('hidden');
}

// ---------- Sound Engine UI (Instrument Voice + Mute Web Audio) ----------
const instrumentSelect   = document.getElementById('instrumentSelect');
const instrumentVal      = document.getElementById('instrumentVal');
const muteWebAudioToggle = document.getElementById('muteWebAudioToggle');

function labelForInstrument(name) {
  switch (name) {
    case 'grand':   return 'Grand Piano';
    case 'cyber':   return 'Cyber Synth';
    case 'arcade':  return '8-Bit Arcade';
    case 'strings': return 'Ambient Strings';
    default:        return name;
  }
}
if (instrumentSelect) {
  instrumentSelect.addEventListener('change', async () => {
    // Audio might not have been initialized yet if the user opens the panel
    // before tapping Start. Lazily boot it so the change takes effect now.
    if (!audioReady) {
      try { await initAudio(); } catch (e) {}
    }
    const name = instrumentSelect.value;
    setInstrument(name);
    if (instrumentVal) instrumentVal.textContent = labelForInstrument(name);
  });
}
if (muteWebAudioToggle) {
  muteWebAudioToggle.addEventListener('change', () => {
    muteWebAudio = !!muteWebAudioToggle.checked;
    applyMuteState();
  });
}

// ---------- Independent L/R hand audio mute wiring (Upgrade 4) ----------
const muteLeftHandToggle  = document.getElementById('muteLeftHandToggle');
const muteRightHandToggle = document.getElementById('muteRightHandToggle');
if (muteLeftHandToggle) {
  muteLeftHandToggle.addEventListener('change', () => {
    state.muteLeftHand = !!muteLeftHandToggle.checked;
    // If the mute flips ON mid-song, kill any LH voices already ringing so we
    // don't leak a tail across the transition. We don't have per-hand voice
    // tracking, so the simplest correct move is to releaseAll on the current
    // instrument; the other hand will re-attack on its next scheduled note.
    if (state.muteLeftHand && audioReady && currentInstrument) {
      try { currentInstrument.releaseAll && currentInstrument.releaseAll(); }
      catch (e) {}
      allHardwareNotesOff();
    }
  });
}
if (muteRightHandToggle) {
  muteRightHandToggle.addEventListener('change', () => {
    state.muteRightHand = !!muteRightHandToggle.checked;
    if (state.muteRightHand && audioReady && currentInstrument) {
      try { currentInstrument.releaseAll && currentInstrument.releaseAll(); }
      catch (e) {}
      allHardwareNotesOff();
    }
  });
}

// ---------- Web Audio Only wiring ----------
const webAudioOnlyToggle = document.getElementById('webAudioOnlyToggle');
if (webAudioOnlyToggle) {
  webAudioOnlyToggle.addEventListener('change', () => {
    webAudioOnly = !!webAudioOnlyToggle.checked;
    // If we just flipped ON, blast All-Notes-Off down the MIDI wire so the
    // hardware piano doesn't hold any voices we previously triggered.
    if (webAudioOnly) {
      allHardwareNotesOff();
    }
  });
}

// ---------- A-B Loop wiring (Upgrade 1) ----------
const loopBtn     = document.getElementById('loopBtn');
const loopDisplay = document.getElementById('loopDisplay');

function updateLoopUI() {
  if (!loopBtn) return;
  loopBtn.classList.remove('set-start', 'looping');
  if (state.loopMode === 'set-start') {
    loopBtn.classList.add('set-start');
    loopBtn.textContent = 'Set B';
  } else if (state.loopMode === 'looping') {
    loopBtn.classList.add('looping');
    loopBtn.textContent = 'Loop ON · Clear';
  } else {
    loopBtn.textContent = 'A-B Loop';
  }
  if (loopDisplay) {
    if (state.loopMode === 'set-start') {
      loopDisplay.innerHTML = '<b>A</b> ' + formatTime(state.loopStart) + ' &nbsp;·&nbsp; B …';
    } else if (state.loopMode === 'looping') {
      loopDisplay.innerHTML =
        '<b>A</b> ' + formatTime(state.loopStart) +
        ' &nbsp;→&nbsp; <b>B</b> ' + formatTime(state.loopEnd);
    } else {
      loopDisplay.textContent = 'Off';
    }
  }
}

function cycleLoopState() {
  // Three-state machine: off → set-start → looping → off
  if (state.loopMode === 'off') {
    state.loopStart = state.songTime;
    state.loopEnd   = 0;
    state.loopMode  = 'set-start';
    showToast('Loop A set at ' + formatTime(state.loopStart), 'ok');
  } else if (state.loopMode === 'set-start') {
    const candidate = state.songTime;
    if (candidate <= state.loopStart + 50) {
      // Refuse a degenerate / inverted range — the user has not advanced past A.
      showToast('Move playhead past A before setting B');
      return;
    }
    state.loopEnd  = candidate;
    state.loopMode = 'looping';
    showToast('A-B Loop active · ' +
      formatTime(state.loopStart) + ' → ' + formatTime(state.loopEnd), 'ok');
  } else {
    state.loopMode  = 'off';
    state.loopStart = 0;
    state.loopEnd   = 0;
    showToast('A-B Loop cleared');
  }
  updateLoopUI();
}

if (loopBtn) {
  loopBtn.addEventListener('click', cycleLoopState);
  // Initialise the label/state on boot.
  updateLoopUI();
}

panelToggleBtn.addEventListener('click', () => panel.classList.toggle('collapsed'));

// ---------- Tablet fullscreen ----------
// Fullscreen must be requested from a direct user gesture. The webkit fallbacks
// retain support for older iPad Safari versions while the standard API covers
// current Safari, Chrome and Edge.
function activeFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function updateFullscreenButton() {
  if (!fullscreenBtn) return;
  const isFullscreen = Boolean(activeFullscreenElement());
  const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  fullscreenBtn.textContent = '⛶';
  fullscreenBtn.title = label;
  fullscreenBtn.setAttribute('aria-label', label);
  fullscreenBtn.classList.toggle('active', isFullscreen);
}

async function toggleFullscreen() {
  try {
    if (activeFullscreenElement()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) throw new Error('Fullscreen exit is unavailable');
      await exit.call(document);
    } else {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request) throw new Error('Fullscreen is unavailable');
      await request.call(root);
    }
  } catch (_error) {
    showToast('Fullscreen is not available in this browser');
  }
  updateFullscreenButton();
}

if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
if (startFullscreenBtn) startFullscreenBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
updateFullscreenButton();



// ---------- Tracks dropdown wiring (Update 1) ----------
const tracksBtn  = document.getElementById('tracksBtn');
const tracksMenu = document.getElementById('tracksMenu');
const sprunkiBrowserBtn = document.getElementById('sprunkiBrowserBtn');
const gameBrowserOverlay = document.getElementById('gameBrowserOverlay');
const gameBrowserClose = document.getElementById('gameBrowserClose');
const gamePicker = document.getElementById('gamePicker');
const phase1Grid = document.getElementById('phase1Grid');
const phase2Grid = document.getElementById('phase2Grid');
const sprunkiLoopToggle = document.getElementById('sprunkiLoopToggle');
const activeGameLabel = document.getElementById('activeGameLabel');
const characterStage = document.getElementById('characterStage');
const characterCanvas = document.getElementById('characterCanvas');
const characterContext = characterCanvas ? characterCanvas.getContext('2d', { alpha: true }) : null;
const characterName = document.getElementById('characterName');
const characterPhase = document.getElementById('characterPhase');
const characterStatus = document.getElementById('characterStatus');
const referenceAudio = document.getElementById('referenceAudio');
const referenceAudioBtn = document.getElementById('referenceAudioBtn');
let characterLoadToken = 0;
let characterIdleImage = null;
let characterFrameImages = [];

function indexLessonMetadata() {
  lessonMetadataByTrackId = new Map();
  for (const track of Object.values(defaultSongs)) {
    if (track.kind !== 'sprunki-lesson' || !track.lesson) continue;
    const game = gameDefinitions.get(track.lesson.gameId);
    const character = game && game.characters.find(item => item.id === track.lesson.characterId);
    const phase = character && character.phases.find(item => item.id === track.lesson.phaseId);
    if (!game || !character || !phase) continue;
    lessonMetadataByTrackId.set(track.id, {
      game,
      character,
      phase,
      track,
      lesson: track.lesson,
      instrument: instrumentDefinitions.get(track.lesson.instrumentId) || null,
      effect: effectDefinitions.get(track.lesson.effectId) || null,
    });
  }
}

function renderGamePicker() {
  if (!gamePicker) return;
  gamePicker.replaceChildren();
  for (const game of gameDefinitions.values()) {
    const button = document.createElement('button');
    button.className = 'game-picker-btn';
    button.type = 'button';
    button.dataset.gameId = game.id;
    button.textContent = game.title;
    button.classList.toggle('active', game.id === selectedGameId);
    gamePicker.append(button);
  }
}

function characterChoice(game, character, phaseId) {
  const phase = character.phases.find(item => item.id === phaseId);
  if (!phase) return null;
  const track = phase.lessonTrackId ? defaultSongs[phase.lessonTrackId] : null;
  const instrument = instrumentDefinitions.get(phase.instrumentId);
  const locked = phase.locked || !track;
  const item = document.createElement('button');
  item.className = 'character-choice';
  item.type = 'button';
  item.disabled = locked;
  item.style.setProperty('--character-color', character.color);
  if (track) item.dataset.trackId = track.id;
  item.setAttribute('aria-label', `${character.name}, ${phase.title}${locked ? ', locked' : ', lesson available'}`);

  const portrait = document.createElement('img');
  portrait.src = phase.portrait;
  portrait.alt = '';
  portrait.loading = 'lazy';
  const name = document.createElement('strong');
  name.textContent = character.name;
  const detail = document.createElement('small');
  detail.textContent = phase.playerMode === 'rhythm'
    ? `Rhythm · ${phase.rhythmLabel}`
    : (instrument ? instrument.label : 'Lesson');
  item.append(portrait, name, detail);
  if (locked) {
    const lock = document.createElement('span');
    lock.className = 'character-lock';
    lock.setAttribute('aria-hidden', 'true');
    lock.textContent = 'Locked';
    item.append(lock);
  }
  return item;
}

function renderGameBrowser() {
  const game = gameDefinitions.get(selectedGameId);
  if (!game) return;
  if (activeGameLabel) activeGameLabel.textContent = game.title.replace(/ Sprunki$/i, '');
  renderGamePicker();
  for (const [phaseId, grid] of [['phase1', phase1Grid], ['phase2', phase2Grid]]) {
    if (!grid) continue;
    grid.replaceChildren();
    for (const character of game.characters || []) {
      const choice = characterChoice(game, character, phaseId);
      if (choice) grid.append(choice);
    }
  }
  updateTracksMenuActive();
}

function openGameBrowser() {
  if (!gameBrowserOverlay) return;
  renderGameBrowser();
  gameBrowserOverlay.classList.remove('hidden');
  gameBrowserClose?.focus();
}

function closeGameBrowser() {
  if (!gameBrowserOverlay) return;
  gameBrowserOverlay.classList.add('hidden');
  sprunkiBrowserBtn?.focus();
}

function stopReferenceAudio() {
  if (!referenceAudio) return;
  referenceAudio.pause();
  referenceAudio.currentTime = 0;
}

function preloadCharacterImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Character frame failed to load: ${url}`));
    image.src = url;
  });
}

async function prepareCharacterFrames(phase, loadToken) {
  try {
    const images = await Promise.all([
      preloadCharacterImage(phase.animation.idle),
      ...(phase.animation.frames || []).map(preloadCharacterImage),
    ]);
    if (loadToken !== characterLoadToken) return;
    characterIdleImage = images[0];
    characterFrameImages = images.slice(1);
    state.characterFrameIndex = -2;
    updateCharacterAnimation();
  } catch (err) {
    console.warn('Character animation could not be prepared:', err);
  }
}

function drawCharacterImage(image) {
  if (!characterCanvas || !characterContext || !image) return;
  const cssWidth = Math.max(1, characterCanvas.clientWidth);
  const cssHeight = Math.max(1, characterCanvas.clientHeight);
  const dpr = preferredCanvasDpr();
  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);
  if (characterCanvas.width !== pixelWidth || characterCanvas.height !== pixelHeight) {
    characterCanvas.width = pixelWidth;
    characterCanvas.height = pixelHeight;
  }

  characterContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  characterContext.clearRect(0, 0, cssWidth, cssHeight);
  const sourceWidth = image.naturalWidth || cssWidth;
  const sourceHeight = image.naturalHeight || cssHeight;
  const scale = Math.min(cssWidth / sourceWidth, cssHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  characterContext.drawImage(
    image,
    (cssWidth - drawWidth) / 2,
    cssHeight - drawHeight,
    drawWidth,
    drawHeight
  );
}

function activateLessonPresentation(trackId) {
  stopReferenceAudio();
  characterLoadToken++;
  const lesson = lessonMetadataByTrackId.get(trackId) || null;
  state.activeLesson = lesson;
  state.characterFrameIndex = -1;

  const root = document.documentElement;
  if (!lesson) {
    state.activeEffect = null;
    state.effectParticles = [];
    state.theme = { lh: '#00d4ff', rh: '#ff3da6', background: '#06060c' };
    root.style.removeProperty('--lesson-primary');
    root.style.removeProperty('--lesson-secondary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--lh');
    root.style.removeProperty('--rh');
    if (characterStage) characterStage.classList.add('hidden');
    characterIdleImage = null;
    characterFrameImages = [];
    if (characterCanvas && characterContext) {
      characterContext.clearRect(0, 0, characterCanvas.width, characterCanvas.height);
      characterCanvas.setAttribute('aria-label', '');
    }
    if (referenceAudio) referenceAudio.removeAttribute('src');
    return;
  }

  const { character, phase, track, instrument, effect } = lesson;
  const theme = lesson.lesson.theme;
  state.activeEffect = effect;
  state.effectParticles = [];
  state.theme = {
    lh: theme.leftHand,
    rh: theme.rightHand,
    background: theme.background,
  };
  root.style.setProperty('--lesson-primary', theme.primary);
  root.style.setProperty('--lesson-secondary', theme.secondary);
  root.style.setProperty('--accent', theme.secondary);
  root.style.setProperty('--lh', theme.leftHand);
  root.style.setProperty('--rh', theme.rightHand);

  characterStage.classList.remove('hidden');
  characterCanvas.setAttribute('aria-label', `${character.name}, ${phase.title}`);
  characterName.textContent = character.name;
  characterPhase.textContent = phase.title;
  characterStatus.textContent = track.reviewStatus === 'draft'
    ? (lesson.lesson.playerMode === 'rhythm' ? 'Draft rhythm lesson' : 'Draft transcription')
    : 'Lesson ready';
  referenceAudio.src = lesson.lesson.referenceAudio;
  referenceAudio.loop = state.sprunkiLoopEnabled;
  if (instrument) {
    setInstrument(instrument.playerVoice);
    if (instrumentSelect) instrumentSelect.value = instrument.playerVoice;
    if (instrumentVal) instrumentVal.textContent = instrument.label;
  }
  prepareCharacterFrames(lesson.lesson, characterLoadToken);
}

function updateCharacterAnimation() {
  const lesson = state.activeLesson;
  if (!lesson || !characterCanvas || !characterIdleImage) return;
  const animation = lesson.lesson.animation;
  const nextIndex = state.playing && characterFrameImages.length
    ? Math.floor(state.songTime / animation.frameDurationMs) % characterFrameImages.length
    : -1;
  if (nextIndex === state.characterFrameIndex) return;
  state.characterFrameIndex = nextIndex;
  drawCharacterImage(nextIndex < 0 ? characterIdleImage : characterFrameImages[nextIndex]);
}

window.addEventListener('resize', () => { state.characterFrameIndex = -2; });

function renderTracksMenu(tracks) {
  if (!tracksMenu) return;
  tracksMenu.replaceChildren();
  for (const track of tracks) {
    const item = document.createElement('button');
    item.className = 'track-item';
    item.type = 'button';
    item.dataset.trackId = track.id;

    const emoji = document.createElement('span');
    emoji.className = 'ti-emoji';
    emoji.textContent = track.emoji || '🎵';

    const title = document.createElement('span');
    title.textContent = track.title;

    const meta = document.createElement('span');
    meta.className = 'ti-meta';
    meta.textContent = track.subtitle || '';

    item.append(emoji, title, meta);
    tracksMenu.append(item);
  }
  updateTracksMenuActive();
}

async function loadSongCatalog() {
  const response = await fetch('./content/catalog.json');
  if (!response.ok) {
    throw new Error(`Song catalogue request failed (${response.status})`);
  }
  const catalog = await response.json();
  if (!Array.isArray(catalog.tracks)) {
    throw new Error('Song catalogue is missing its tracks list.');
  }
  defaultSongs = Object.fromEntries(catalog.tracks.map(track => [track.id, track]));
  const [instrumentCatalog, effectCatalog, ...games] = await Promise.all([
    fetchJsonAsset(catalog.resources.instruments),
    fetchJsonAsset(catalog.resources.effects),
    ...(catalog.games || []).map(game => fetchJsonAsset(game.manifest)),
  ]);
  instrumentDefinitions = new Map((instrumentCatalog.instruments || []).map(item => [item.id, item]));
  effectDefinitions = new Map((effectCatalog.effects || []).map(item => [item.id, item]));
  gameDefinitions = new Map(games.map(game => [game.id, game]));
  selectedGameId = catalog.games?.[0]?.id || games[0]?.id || null;
  indexLessonMetadata();
  renderGameBrowser();
  renderTracksMenu(catalog.tracks.filter(track => track.kind !== 'sprunki-lesson'));
}

async function fetchJsonAsset(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Content request failed (${response.status}): ${path}`);
  return response.json();
}

function updateTracksMenuActive() {
  if (tracksMenu) {
    tracksMenu.querySelectorAll('.track-item').forEach(it => {
      it.classList.toggle('active', it.dataset.trackId === state.currentTrackId);
    });
  }
  for (const grid of [phase1Grid, phase2Grid]) {
    if (!grid) continue;
    grid.querySelectorAll('.character-choice').forEach(it => {
      it.classList.toggle('active', it.dataset.trackId === state.currentTrackId);
    });
  }
}

sprunkiBrowserBtn?.addEventListener('click', openGameBrowser);
gameBrowserClose?.addEventListener('click', closeGameBrowser);
gameBrowserOverlay?.addEventListener('click', event => {
  if (event.target === gameBrowserOverlay) closeGameBrowser();
});
gamePicker?.addEventListener('click', event => {
  const button = event.target.closest('[data-game-id]');
  if (!button) return;
  selectedGameId = button.dataset.gameId;
  renderGameBrowser();
});
for (const grid of [phase1Grid, phase2Grid]) {
  grid?.addEventListener('click', async event => {
    const item = event.target.closest('.character-choice[data-track-id]');
    if (!item || item.disabled) return;
    closeGameBrowser();
    await loadDefaultSong(item.dataset.trackId);
  });
}

sprunkiLoopToggle?.addEventListener('change', () => {
  state.sprunkiLoopEnabled = sprunkiLoopToggle.checked;
  if (referenceAudio) referenceAudio.loop = state.sprunkiLoopEnabled;
  showToast(state.sprunkiLoopEnabled ? 'Sprunki lessons will loop' : 'Sprunki looping is off', 'ok');
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && gameBrowserOverlay && !gameBrowserOverlay.classList.contains('hidden')) {
    closeGameBrowser();
  }
});

if (referenceAudioBtn && referenceAudio) {
  referenceAudioBtn.addEventListener('click', async () => {
    if (referenceAudio.paused) {
      setPlaying(false);
      try {
        await referenceAudio.play();
      } catch (err) {
        console.warn('Reference audio was blocked by the browser:', err);
        showToast('The original loop could not be played', 'err');
      }
    } else {
      referenceAudio.pause();
      referenceAudio.currentTime = 0;
    }
  });
  referenceAudio.addEventListener('play', () => {
    referenceAudioBtn.classList.add('playing');
    referenceAudioBtn.textContent = '■ Stop original loop';
  });
  referenceAudio.addEventListener('pause', () => {
    referenceAudioBtn.classList.remove('playing');
    referenceAudioBtn.textContent = '▶ Hear original loop';
  });
}

if (tracksBtn && tracksMenu) {
  tracksBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = tracksMenu.classList.toggle('open');
    tracksBtn.classList.toggle('open', open);
  });
  // Click-away closes the dropdown.
  document.addEventListener('click', (e) => {
    if (!tracksMenu.classList.contains('open')) return;
    if (tracksMenu.contains(e.target) || tracksBtn.contains(e.target)) return;
    tracksMenu.classList.remove('open');
    tracksBtn.classList.remove('open');
  });
  tracksMenu.addEventListener('click', async (event) => {
    const item = event.target.closest('.track-item');
    if (!item || !tracksMenu.contains(item)) return;
    const id = item.dataset.trackId;
    tracksMenu.classList.remove('open');
    tracksBtn.classList.remove('open');
    await loadDefaultSong(id);
  });
}

loadSongCatalog().catch((err) => {
  console.error('Failed to load song catalogue:', err);
  if (tracksBtn) tracksBtn.disabled = true;
  if (tracksMenu) tracksMenu.textContent = 'Songs unavailable';
});

// ---------- Notation toggle wiring (Update 4) ----------
const notationEnglishBtn = document.getElementById('notationEnglish');
const notationFrenchBtn  = document.getElementById('notationFrench');
function setNotation(n) {
  state.notation = n;
  if (notationEnglishBtn) notationEnglishBtn.classList.toggle('active', n === 'english');
  if (notationFrenchBtn)  notationFrenchBtn.classList.toggle('active',  n === 'french');
  updateKeyboardRangeLabel();
  // The next animation frame redraws the piano + waterfall using
  // activeNoteTable() so labels change instantly.
}
if (notationEnglishBtn) notationEnglishBtn.addEventListener('click', () => setNotation('english'));
if (notationFrenchBtn)  notationFrenchBtn.addEventListener('click',  () => setNotation('french'));

// ---------- Download MIDI button wiring (Update 3) ----------
const downloadMidiBtn = document.getElementById('downloadMidiBtn');
if (downloadMidiBtn) {
  downloadMidiBtn.addEventListener('click', downloadRecording);
}

// Start overlay
const startOverlay = document.getElementById('startOverlay');
document.getElementById('startBtn').addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  resize();
  initAudio().catch(err => {
    console.warn('Audio could not start:', err);
    showToast('Tap a piano key to retry audio', 'err');
  });
});

// Wait-banner UI was removed in NeoKeys — practice indicators now render
// directly on the falling note blocks inside drawWaterfall(). These stubs are
// kept so the existing state-machine call sites keep working unchanged.
function showWaitBanner(_midis) { /* no-op: visual indicator is on the blocks */ }
function hideWaitBanner()       { /* no-op */ }

// ---------- Touch input on piano (optional bonus) ----------
const touchActive = new Map(); // touchId -> midi

function midiAtPoint(x, y) {
  if (y < pianoY) return null;
  const rhythm = state.activeLesson?.lesson;
  if (rhythm?.playerMode === 'rhythm') return rhythm.rhythmMidiNote;
  // Check black first (drawn on top)
  for (const k of keyLayout) if (k.isBlack) {
    if (x >= k.x && x <= k.x + k.w && y <= pianoY + blackKeyH) return k.midi;
  }
  for (const k of keyLayout) if (!k.isBlack) {
    if (x >= k.x && x <= k.x + k.w) return k.midi;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  if (!audioReady) return;
  const m = midiAtPoint(e.clientX, e.clientY);
  if (m != null) {
    touchActive.set(e.pointerId, m);
    handleUserNoteOn(m, 0.8, false);
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointerup', (e) => {
  const m = touchActive.get(e.pointerId);
  if (m != null) { handleUserNoteOff(m, false); touchActive.delete(e.pointerId); }
});
canvas.addEventListener('pointercancel', (e) => {
  const m = touchActive.get(e.pointerId);
  if (m != null) { handleUserNoteOff(m, false); touchActive.delete(e.pointerId); }
});

let rhythmSpaceHeld = false;
document.addEventListener('keydown', event => {
  const rhythm = state.activeLesson?.lesson;
  const tagName = event.target?.tagName?.toLowerCase();
  if (event.code !== 'Space' || rhythm?.playerMode !== 'rhythm' || event.repeat || ['input', 'select', 'button'].includes(tagName)) return;
  event.preventDefault();
  rhythmSpaceHeld = true;
  initAudio().then(() => handleUserNoteOn(rhythm.rhythmMidiNote, 0.9, false));
});
document.addEventListener('keyup', event => {
  const rhythm = state.activeLesson?.lesson;
  if (event.code !== 'Space' || !rhythmSpaceHeld || rhythm?.playerMode !== 'rhythm') return;
  event.preventDefault();
  rhythmSpaceHeld = false;
  handleUserNoteOff(rhythm.rhythmMidiNote, false);
});

// ---------- Game Loop ----------
const WAIT_LEAD_MS = 50;        // pause this many ms before hit
const WAIT_GROUP_MS = 30;       // notes within this window count as one chord

function shouldPauseForHand(hand) {
  if (state.mode !== 'practice') return false;
  if (state.hand === 'both') return true;
  return state.hand === hand;
}

function spawnLessonEffect(note) {
  const effect = state.activeEffect;
  if (!effect || effect.type !== 'note-sparks') return;
  const key = getKey(note.midi);
  if (!key) return;
  const count = Math.max(1, Math.min(10, effect.particlesPerNote || 4));
  const colors = effect.colors?.length ? effect.colors : [state.theme.rh];
  for (let index = 0; index < count; index++) {
    const angle = Math.PI * (1.08 + Math.random() * 0.84);
    const speed = (effect.speed || 0.14) * (0.65 + Math.random() * 0.7);
    state.effectParticles.push({
      x: key.x + key.w * (0.25 + Math.random() * 0.5),
      y: pianoY - 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: effect.lifetimeMs || 480,
      color: colors[index % colors.length],
      size: (effect.size || 3) * (0.7 + Math.random() * 0.6),
    });
  }
  if (state.effectParticles.length > 220) {
    state.effectParticles.splice(0, state.effectParticles.length - 220);
  }
}

function updateLessonEffects(dtMs) {
  if (!state.effectParticles.length) return;
  for (const particle of state.effectParticles) {
    particle.life += dtMs;
    particle.x += particle.vx * dtMs;
    particle.y += particle.vy * dtMs;
    particle.vy += 0.00018 * dtMs;
  }
  state.effectParticles = state.effectParticles.filter(particle => particle.life < particle.maxLife);
}

function drawLessonEffects() {
  for (const particle of state.effectParticles) {
    const opacity = Math.max(0, 1 - particle.life / particle.maxLife);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size * (0.55 + opacity * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function update(dtMs) {
  // Always age floaters so they keep animating even while paused/waiting.
  if (state.floaters.length) {
    for (const f of state.floaters) {
      f.life += dtMs;
      f.y += f.vy * dtMs;
    }
    state.floaters = state.floaters.filter(f => f.life < f.maxLife);
  }

  // Freeplay mode never advances the song timeline — it just prunes off-screen
  // upward-floating blocks so memory doesn't grow unbounded.
  if (state.mode === 'freeplay') {
    if (state.freeplayBlocks.length) {
      const now = performance.now();
      const ppms = pxPerMs();
      // A block is fully off-screen once its bottom (most recent point) rises
      // past y=0. While still held, bottom stays at pianoY → never prunes.
      state.freeplayBlocks = state.freeplayBlocks.filter(b => {
        if (b.endTs == null) return true;
        const yBottom = pianoY - (now - b.endTs) * ppms;
        return yBottom > -20;
      });
    }
    return;
  }

  if (!state.playing) return;
  if (state.waiting) return;

  const prevTime = state.songTime;
  let nextTime = prevTime + dtMs * state.speed;

  // ---- Practice / Wait-for-note detection ----
  // Find the next "group" of notes the user must play.
  // A note belongs to the wait set if shouldPauseForHand(note.hand).
  if (state.mode === 'practice') {
    // Find earliest pause-relevant note whose startMs > prevTime (not yet triggered).
    let earliest = Infinity;
    for (const n of state.notes) {
      if (n.triggered) continue;
      if (!shouldPauseForHand(n.hand)) continue;
      if (n.startMs < earliest) earliest = n.startMs;
      // notes are sorted by start so we could break early when n.startMs > earliest+epsilon
      if (n.startMs > earliest + WAIT_GROUP_MS) break;
    }
    if (earliest !== Infinity) {
      const pauseAt = earliest - WAIT_LEAD_MS;
      if (nextTime >= pauseAt) {
        // Clamp time and enter wait state
        nextTime = pauseAt;
        // Collect all notes in this chord window
        const waitSet = new Set();
        for (const n of state.notes) {
          if (n.triggered) continue;
          if (!shouldPauseForHand(n.hand)) continue;
          if (n.startMs <= earliest + WAIT_GROUP_MS) {
            waitSet.add(n.midi);
            // Mark as triggered so we don't re-wait on the same chord.
            n.triggered = true;
            spawnLessonEffect(n);
            // They will be auto-released after their duration via the playback pass below
            n.released = false;
            // Their start time is "now" effectively (paused), endMs stays the same
          }
        }

        // ---- FAST-PLAY BUG PATCH ----
        // If the user *already* nailed any of these notes a hair before the
        // engine officially paused (fast runs, trills, arpeggios), credit them
        // instantly so we don't freeze the timeline waiting for keys that are
        // already physically held down. If the chord is fully satisfied by
        // this early input, skip the pause state entirely so playback never
        // stutters.
        for (const heldMidi of state.activeMidiPressed) {
          if (waitSet.has(heldMidi)) {
            // Credit a Perfect for the early hit (reaction window = 0).
            const prevWaitStart = state.waitStartedAt;
            state.waitStartedAt = performance.now(); // ⇒ reaction = 0 ⇒ +100
            awardHit(heldMidi);
            state.waitStartedAt = prevWaitStart;
            waitSet.delete(heldMidi);
          }
        }

        if (waitSet.size === 0) {
          // Chord fully satisfied before pause — don't enter wait state at all.
          // Leave nextTime where we clamped it (pauseAt); the next frame will
          // continue advancing normally.
          state.waiting = false;
          state.waitingFor.clear();
          hideWaitBanner();
        } else {
          state.waitingFor = waitSet;
          state.waiting = true;
          state.waitStartedAt = performance.now();
          showWaitBanner(waitSet);
        }
      }
    }
  }

  // ---- Auto-play notes whose start time has been crossed ----
  // We trigger sound for any note whose startMs is between prevTime and nextTime,
  // EXCEPT notes that we just put into the wait set (those are played by the user).
  for (const n of state.notes) {
    if (!n.triggered && n.startMs <= nextTime) {
      // In practice mode, wait-relevant notes are user-played, others auto-play.
      const userPlays = state.mode === 'practice' && shouldPauseForHand(n.hand);
      // Upgrade 4 — Independent left/right hand audio mute. The note's visual
      // falling block and any practice-mode scoring/wait bookkeeping are
      // already wired up above; we only gate the *audio* generation here so
      // the canvas continues to render the silenced hand's blocks normally.
      const handMuted =
        (n.hand === 'lh' && state.muteLeftHand) ||
        (n.hand === 'rh' && state.muteRightHand);
      if (!userPlays && !handMuted) {
        playNote(n.midi, n.velocity, Math.max(0.1, n.durMs / 1000));
      }
      spawnLessonEffect(n);
      n.triggered = true;
    }
  }

  state.songTime = Math.min(nextTime, state.songDuration || nextTime);

  // ---- Upgrade 1 — A-B Loop playback enforcement ----
  // Runs every frame while looping is armed. The moment the playhead reaches
  // or crosses Marker B we seamlessly snap back to Marker A via scrubToTime()
  // so all note triggers, hardware-out events and held audio voices are
  // properly reset (no hung notes on the loop seam).
  if (state.loopMode === 'looping'
      && state.loopEnd > state.loopStart
      && state.songTime >= state.loopEnd) {
    scrubToTime(state.loopStart);
    return;
  }

  if (state.songDuration > 0 && state.songTime >= state.songDuration) {
    if (state.activeLesson && state.sprunkiLoopEnabled) {
      const overflow = Math.max(0, nextTime - state.songDuration);
      state.songEnded = false;
      scrubToTime(overflow % state.songDuration);
      return;
    }
    if (!state.songEnded) {
      state.songEnded = true;
      // Ensure no hardware notes are left hanging when the song wraps up.
      allHardwareNotesOff();
      showVictoryOverlay();   // showVictoryOverlay() also pauses transport
    } else {
      setPlaying(false);
    }
  }
}

// ---------- Rendering ----------
function clear() {
  // Gradient bg drawn via CSS, but we still need to clear canvas
  ctx.fillStyle = state.theme.background;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid lines in waterfall area for readability
  ctx.fillStyle = 'rgba(255,255,255,0.02)';
  for (const k of keyLayout) {
    if (!k.isBlack) {
      ctx.fillRect(k.x, 0, 1, waterfallH);
    }
  }
  // Octave dividers (every C) brighter
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (const k of keyLayout) {
    if (!k.isBlack && (k.midi % 12) === 0) {
      ctx.fillRect(k.x, 0, 1, waterfallH);
    }
  }
}

function drawFreeplayBlocks() {
  // Render upward-floating blocks for Freeplay mode. Each block grows out of
  // the piano bed and floats up off the top of the screen.
  const ppms = pxPerMs();
  const now  = performance.now();

  for (const b of state.freeplayBlocks) {
    const key = getKey(b.midi);
    if (!key) continue;

    // Oldest edge (the start moment) has risen the longest.
    const yTop    = pianoY - (now - b.startTs) * ppms;
    // Most-recent edge: while held it sticks to pianoY, after release it rises.
    const recent  = b.endTs == null ? now : b.endTs;
    const yBottom = pianoY - (now - recent) * ppms;

    if (yBottom < -8) continue; // fully off-screen

    const inset = 2;
    const x = key.x + inset;
    const w = Math.max(2, key.w - inset * 2);
    const y = yTop;
    const h = Math.max(3, yBottom - yTop);

    const base = b.hand === 'lh' ? state.theme.lh : state.theme.rh;
    const glow = b.hand === 'lh' ? 'rgba(0,212,255,' : 'rgba(255,61,166,';

    // Gradient: bright (recent) at the bottom, fading at the top as it floats away.
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, glow + '0.25)');
    grad.addColorStop(1, base);
    ctx.fillStyle = grad;

    const r = Math.min(6, w / 2, h / 2);
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Soft outline only for the freshest part of the block.
    if (b.endTs == null || (now - b.endTs) < 500) {
      ctx.save();
      ctx.shadowColor = base;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Hit line still drawn for visual reference.
  const grad = ctx.createLinearGradient(0, pianoY - 2, 0, pianoY + 2);
  grad.addColorStop(0,   'rgba(255,255,255,0.0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1,   'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, pianoY - 2, W, 4);
}

function drawFloaters() {
  // Upgrade 2 — Smooth linear floating-text animation.
  //   • Font size is now FIXED so glyphs don't scale/pop on spawn.
  //   • Vertical motion is purely linear (driven by f.vy in update()).
  //   • Opacity interpolates straight from 1.0 → 0.0 across f.maxLife (600 ms)
  //     for a clean, elegant fade-out instead of an abrupt visual snap.
  for (const f of state.floaters) {
    const p = Math.max(0, Math.min(1, f.life / f.maxLife));   // 0 → 1
    const alpha = 1 - p;                                       // linear fade
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

function drawWaterfall() {
  const ppms = pxPerMs();
  const t0 = state.songTime;
  const t1 = state.songTime + LOOKAHEAD_MS;

  // Draw shaded background bands behind black keys for visual alignment
  if (state.activeLesson?.lesson?.playerMode !== 'rhythm') {
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    for (const k of keyLayout) {
      if (k.isBlack) {
        ctx.fillRect(k.x, 0, k.w, waterfallH);
      }
    }
  }

  // Notes
  for (const n of state.notes) {
    if (n.endMs < t0) continue;
    if (n.startMs > t1) break; // sorted by start
    const key = getKey(n.midi);
    if (!key) continue;

    // Y positions: hit line is at pianoY. Notes move down toward it.
    // A note at songTime = startMs should have its bottom at pianoY.
    const bottom = pianoY - (n.startMs - t0) * ppms;
    const top    = pianoY - (n.endMs   - t0) * ppms;
    const y = top;
    const h = Math.max(3, bottom - top);

    // Inset for visual clarity
    const inset = key.isBlack ? 2 : 2;
    const x = key.x + inset;
    const w = Math.max(2, key.w - inset * 2);

    const isActive = n.startMs <= state.songTime && state.songTime <= n.endMs;
    const isWaiting = state.waiting && state.waitingFor.has(n.midi);

    // Color by hand
    const base = n.hand === 'lh' ? state.theme.lh : state.theme.rh;
    const glow = n.hand === 'lh' ? 'rgba(0,212,255,' : 'rgba(255,61,166,';

    // Body
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    if (isWaiting) {
      grad.addColorStop(0, '#fff');
      grad.addColorStop(1, base);
    } else if (isActive) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, base);
      grad.addColorStop(1, base);
    } else {
      grad.addColorStop(0, base);
      grad.addColorStop(1, glow + '0.55)');
    }
    ctx.fillStyle = grad;

    // Rounded rect
    const r = Math.min(6, w/2, h/2);
    roundRect(ctx, x, y, w, h, r);
    ctx.fill();

    // Glow for nearest notes
    const dist = Math.max(0, n.startMs - state.songTime);
    if (dist < 600) {
      ctx.save();
      ctx.shadowColor = base;
      ctx.shadowBlur = 12 * (1 - dist/600);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, r);
      ctx.stroke();
      ctx.restore();
    }

    // ---- Practice-mode label: render note name centered inside the block ----
    // (Update 6) Mobile landscape bug fix: accidentals (C#, D#, F#, G#, A#) sit
    // in much narrower rectangles than naturals (~60% width). The original
    // sizing pipeline tied font size to `w * 0.55`, which for sharps with the
    // French solfège labels ("Ré#", "Sol#") could exceed the available width
    // → text either clipped to nothing or measured wider than the block and
    // visually dropped. The fix below:
    //   1. picks a label string from the active notation table,
    //   2. computes the longest font size that *measures* under the available
    //      pixel budget using ctx.measureText(), not a fixed ratio,
    //   3. uses a tighter floor for sharps (down to 6 px) so even a 14 px-wide
    //      black-key block on a 360 px landscape phone still shows text,
    //   4. clips draws to the block bounds so any residual overflow is
    //      contained instead of leaking onto adjacent rectangles.
    if (state.mode === 'practice') {
      const label = noteLetter(n.midi); // 'C' / 'C#' / 'Do' / 'Do#' depending on notation
      const isSharp = key.isBlack;
      // Available pixel budget — leave ~12% padding on each side.
      const maxTextW = w * 0.86;
      // Initial guess scaled by width; sharps get a lower floor so we don't
      // hide labels entirely on tiny black-key columns.
      const floorPx = isSharp ? 6 : 8;
      const ceilPx  = isSharp ? 13 : 16;
      let fontSize = Math.max(floorPx, Math.min(ceilPx, w * (isSharp ? 0.45 : 0.55)));
      // Iteratively shrink until measureText fits, but never below floorPx.
      // measureText is cheap enough that 1–3 iterations is the common path.
      ctx.font = '700 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      let mW = ctx.measureText(label).width;
      let safety = 6;
      while (mW > maxTextW && fontSize > floorPx && safety-- > 0) {
        fontSize = Math.max(floorPx, fontSize - 1);
        ctx.font = '700 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        mW = ctx.measureText(label).width;
      }
      // Only draw if the block is tall enough AND the rendered text actually
      // fits horizontally — guarantees no clipped/cut-off glyphs on mobile.
      if (h >= fontSize + 2 && mW <= w - 2) {
        ctx.save();
        // Clip strictly to the block so overflow never bleeds into neighbours.
        ctx.beginPath();
        const r2 = Math.min(6, w / 2, h / 2);
        roundRect(ctx, x, y, w, h, r2);
        ctx.clip();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Contrast: waiting blocks are white-tinted → use dark gray; otherwise white.
        ctx.fillStyle = isWaiting ? '#1a1a2a' : '#ffffff';
        // Subtle shadow for readability over the gradient body.
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 2;
        ctx.fillText(label, x + w / 2, y + h / 2);
        ctx.restore();
      }
    }
  }

  // Hit line
  const grad = ctx.createLinearGradient(0, pianoY - 2, 0, pianoY + 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, pianoY - 2, W, 4);
}

function drawPiano() {
  // Determine which keys are "lit" (either pressed by user, or actively playing)
  const lit = new Map(); // midi -> {color, intensity}
  // Active notes from playback timeline
  for (const n of state.notes) {
    if (n.startMs <= state.songTime && state.songTime <= n.endMs) {
      lit.set(n.midi, { color: n.hand === 'lh' ? state.theme.lh : state.theme.rh, source: 'play' });
    }
  }
  // Waiting notes — special highlight
  if (state.waiting) {
    for (const m of state.waitingFor) {
      lit.set(m, { color: '#ffffff', source: 'wait' });
    }
  }
  // User-pressed (physical/touch) — overrides
  for (const m of state.activeMidiPressed) {
    lit.set(m, { color: '#36e07f', source: 'user' });
  }

  const rhythm = state.activeLesson?.lesson;
  if (rhythm?.playerMode === 'rhythm') {
    drawRhythmPad(rhythm, lit.get(rhythm.rhythmMidiNote));
    return;
  }

  // White keys
  for (const k of keyLayout) {
    if (k.isBlack) continue;
    const litInfo = lit.get(k.midi);
    if (litInfo) {
      // Splash background
      const g = ctx.createLinearGradient(0, pianoY, 0, pianoY + pianoH);
      g.addColorStop(0, hexToRgba(litInfo.color, 0.9));
      g.addColorStop(1, hexToRgba(litInfo.color, 0.4));
      ctx.fillStyle = g;
    } else {
      const g = ctx.createLinearGradient(0, pianoY, 0, pianoY + pianoH);
      g.addColorStop(0, '#fafbff');
      g.addColorStop(0.85, '#e6e9f5');
      g.addColorStop(1, '#cdd2e4');
      ctx.fillStyle = g;
    }
    ctx.fillRect(k.x, pianoY, k.w, pianoH);
    // Edge
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(k.x + 0.5, pianoY + 0.5, k.w - 1, pianoH - 1);

    // ---- Responsive labels ----
    // Strategy (mobile-friendly):
    //   • Always show the C label with its octave (anchor for orientation).
    //   • Show all white-key letters when the key is wide enough to fit them.
    //   • Font size scales with key width but is clamped so it never disappears
    //     on narrow Android landscape views and never overflows wide keys.
    const isC = (k.midi % 12) === 0;
    // Lower the show-all threshold significantly so labels appear on mobile too.
    // A single capital letter at ~7px is still readable; we just scale the font.
    const showAll = whiteKeyW >= 10;
    if (showAll || isC) {
      // Octave labels like "C4" need a bit more horizontal room — use a smaller
      // font when the key is narrow so the text never clips outside the key.
      let fontSize;
      if (isC) {
        // Reserve ~80% of the key width for a 2-char string like "C4".
        fontSize = Math.max(7, Math.min(13, whiteKeyW * 0.42));
      } else {
        // Single-letter labels can use a higher ratio.
        fontSize = Math.max(7, Math.min(12, whiteKeyW * 0.5));
      }
      // Upgrade 3 — Outlined high-contrast key labels.
      // The previous renderer flipped between dark/light fill depending on key
      // press state, which produced a strobing/flicker effect during rapid
      // playback on mobile. We now lock the fill to a permanent light tone
      // and add a 3 px black stroke beneath the fill so the text stays legible
      // against ANY background (cool unpressed white key, glowing neon-pink RH
      // splash, neon-cyan LH splash, white-flash waiting key, etc.).
      ctx.font = (isC ? 'bold ' : '600 ') + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const label = isC ? noteName(k.midi) : noteLetter(k.midi);
      // Bottom padding scales with piano height so it doesn't get cut off in
      // short landscape views on phones.
      const pad = Math.max(3, Math.min(8, pianoH * 0.05));
      const labelX = k.x + k.w / 2;
      const labelY = pianoY + pianoH - pad;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(label, labelX, labelY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, labelX, labelY);
    }
  }

  // Black keys (drawn after whites)
  for (const k of keyLayout) {
    if (!k.isBlack) continue;
    const litInfo = lit.get(k.midi);
    if (litInfo) {
      const g = ctx.createLinearGradient(0, pianoY, 0, pianoY + blackKeyH);
      g.addColorStop(0, hexToRgba(litInfo.color, 1));
      g.addColorStop(1, hexToRgba(litInfo.color, 0.6));
      ctx.fillStyle = g;
    } else {
      const g = ctx.createLinearGradient(0, pianoY, 0, pianoY + blackKeyH);
      g.addColorStop(0, '#2a2c3e');
      g.addColorStop(0.5, '#15161f');
      g.addColorStop(1, '#0a0b13');
      ctx.fillStyle = g;
    }
    roundRect(ctx, k.x, pianoY, k.w, blackKeyH, 3);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(k.x + 2, pianoY + 2, k.w - 4, 2);

    // Label for black keys — lowered threshold so labels stay visible in mobile
    // landscape. Font scales with the (narrower) black-key width.
    // Upgrade 3 — Outlined high-contrast key labels. Identical strategy as the
    // white-key labels: permanent white fill + 3 px black stroke. Eliminates
    // the eye-straining strobe that used to happen when a black key fired.
    if (blackKeyW >= 8) {
      const fontSize = Math.max(6, Math.min(10, blackKeyW * 0.55));
      ctx.font = '600 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const bkLabel = noteLetter(k.midi);
      const bkX = k.x + k.w / 2;
      const bkY = pianoY + blackKeyH - 3;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(bkLabel, bkX, bkY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(bkLabel, bkX, bkY);
    }
  }

  // Top bar above piano
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, pianoY - 4, W, 1);
  const topGrad = ctx.createLinearGradient(0, pianoY - 12, 0, pianoY);
  topGrad.addColorStop(0, 'rgba(0,0,0,0)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, pianoY - 12, W, 12);
}

function drawRhythmPad(rhythm, litInfo) {
  ctx.fillStyle = '#090a12';
  ctx.fillRect(0, pianoY, W, pianoH);
  const x = W * 0.2;
  const width = W * 0.6;
  const y = pianoY + 12;
  const height = Math.max(58, pianoH - 24);
  const color = litInfo?.color || state.theme.rh;
  const gradient = ctx.createLinearGradient(0, y, 0, y + height);
  gradient.addColorStop(0, hexToRgba(color, litInfo ? 0.95 : 0.42));
  gradient.addColorStop(1, hexToRgba(color, litInfo ? 0.48 : 0.12));
  ctx.fillStyle = gradient;
  ctx.shadowColor = litInfo ? color : 'transparent';
  ctx.shadowBlur = litInfo ? 22 : 0;
  roundRect(ctx, x, y, width, height, 18);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hexToRgba(color, 0.8);
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 18);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(rhythm.rhythmLabel.toUpperCase(), W / 2, y + height / 2 - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('TAP THE PAD · OR PRESS SPACE', W / 2, y + height / 2 + 17);
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2*r) r = w/2;
  if (h < 2*r) r = h/2;
  if (r < 0) r = 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex, a) {
  // Accept #rrggbb or rgb()-already
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  const h = hex.replace('#','');
  const bi = parseInt(h, 16);
  const r = (bi >> 16) & 255, g = (bi >> 8) & 255, b = bi & 255;
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- Main loop ----------
function frame(ts) {
  const dt = Math.min(50, ts - (state.lastFrameTs || ts));
  state.lastFrameTs = ts;

  update(dt);
  updateLessonEffects(dt);
  updateCharacterAnimation();

  clear();
  if (state.mode === 'freeplay') {
    // Skip the song waterfall entirely — render only the user's upward blocks.
    drawFreeplayBlocks();
  } else {
    drawWaterfall();
  }
  drawPiano();
  drawLessonEffects();
  drawFloaters();

  // Keep the timeline slider in sync with playhead (unless user is dragging it)
  updateTimelineUI();

  requestAnimationFrame(frame);
}

updateKeyboardRangeForNotes();
resize();
requestAnimationFrame((ts) => { state.lastFrameTs = ts; frame(ts); });

// Some browsers (mobile Chrome) may suspend audio until user gesture.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.playing) setPlaying(false);
});
