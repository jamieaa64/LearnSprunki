import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import midiPackage from '@tonejs/midi';
import { DRUM_PIECES, canonicalDrumMidi, drumAtPoint, drumKitLayout, pieceForKey, pieceForMidi } from '../drum-kit.js';

const { Midi } = midiPackage;
const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the visual kit exposes distinct General MIDI percussion pieces', () => {
  assert.equal(DRUM_PIECES.length, 8);
  assert.equal(new Set(DRUM_PIECES.map(piece => piece.midi)).size, DRUM_PIECES.length);
  assert.equal(pieceForMidi(36).id, 'kick');
  assert.equal(pieceForMidi(40).id, 'snare');
  assert.equal(pieceForMidi(46).id, 'hi-hat');
  assert.equal(canonicalDrumMidi(35), 36);
});

test('keyboard shortcuts address separate drums', () => {
  assert.equal(pieceForKey('f').id, 'kick');
  assert.equal(pieceForKey('J').id, 'snare');
  assert.equal(pieceForKey('d').id, 'hi-hat');
  assert.equal(pieceForKey('x'), null);
});

test('touch hit testing returns the visible drum', () => {
  const layout = drumKitLayout(1000, 500, 240);
  for (const piece of layout) {
    assert.equal(drumAtPoint(piece.x + piece.w / 2, piece.y + piece.h / 2, layout)?.id, piece.id);
  }
  assert.equal(drumAtPoint(2, 502, layout), null);
});

test('published breakbeat lessons contain multiple drum lanes', async () => {
  for (const [phase, filename] of [
    ['phase1', 'fun-bot-phase1-draft-rhythm.mid'],
    ['phase2', 'fun-bot-phase2-draft-rhythm.mid'],
  ]) {
    const path = resolve(extensionRoot, 'content/tracks', `fun-bot-${phase}`, 'lesson', filename);
    const midi = new Midi(await readFile(path));
    const notes = midi.tracks.flatMap(track => track.notes.map(note => note.midi));
    assert.ok(new Set(notes).size >= 2, `${phase} collapsed to one drum lane`);
    assert.equal(notes.every(note => pieceForMidi(note)), true);
  }
});
