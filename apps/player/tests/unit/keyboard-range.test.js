import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PIANO_MIN_MIDI,
  PIANO_MAX_MIDI,
  STANDARD_KEYBOARD_SIZES,
  chooseKeyboardRange,
  rangeForSize,
} from '../../core/keyboard-range.js';

test('the supported sizes are standard keyboard sizes', () => {
  assert.deepEqual(STANDARD_KEYBOARD_SIZES, [25, 37, 49, 61, 73, 88]);
});

test('the default range is the full 88-key piano', () => {
  assert.deepEqual(chooseKeyboardRange([], '88'), { first: 21, last: 108, size: 88 });
});

test('auto selects a compact C-to-C range with breathing room', () => {
  const range = chooseKeyboardRange([{ midi: 52 }, { midi: 66 }], 'auto');
  assert.deepEqual(range, { first: 48, last: 72, size: 25 });
  assert.equal(range.first % 12, 0);
  assert.equal(range.last % 12, 0);
});

test('a manual range expands rather than hiding required notes', () => {
  const range = chooseKeyboardRange([{ midi: 35 }, { midi: 91 }], '25');
  assert.deepEqual(range, { first: 24, last: 96, size: 73 });
});

test('low A0 requires the conventional full piano boundary', () => {
  assert.deepEqual(chooseKeyboardRange([{ midi: PIANO_MIN_MIDI }], 'auto'), {
    first: PIANO_MIN_MIDI,
    last: PIANO_MAX_MIDI,
    size: 88,
  });
});

test('compact ranges only shift by complete octaves', () => {
  for (const size of STANDARD_KEYBOARD_SIZES.filter(value => value < 88)) {
    const range = rangeForSize(size, 60, 60);
    assert.equal(range.first % 12, 0);
    assert.equal(range.last % 12, 0);
    assert.equal(range.last - range.first + 1, size);
  }
});
