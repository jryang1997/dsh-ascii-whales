import test from 'node:test';
import assert from 'node:assert/strict';
import { createInkPalette } from '../src/shading.js';
import { createWaterField, drawWater, resetWaterField, stepWater, waterRippleRadius } from '../src/water.js';

const TAU = Math.PI * 2;
const FRAME = 1 / 60;
const RIPPLE_KEYS = ['x', 'y', 'age', 'life', 'startRadius', 'endRadius', 'strength', 'seed'];
const SILENT_GLYPHS = new Set(['·', '˙', "'", '~', ',']);
const CONTEXT_KEYS = new Set(['font', 'fillStyle', 'globalAlpha', 'textAlign', 'textBaseline', 'fillText']);

/** A whale with sane geometry; overrides replace whole fields, motion included. */
function makeWhale(overrides = {}) {
  return {
    id: 1,
    x: 320,
    y: 200,
    heading: 0,
    length: 120,
    bodyRadius: 16,
    speed: 40,
    _motion: { wave: 0, stroke: 1, age: 0 },
    ...overrides,
  };
}

const school = (...whales) => ({ whales });
const beat = index => index * TAU + 0.05;

/** Seed the beat record at phase 0, then cross one beat with an active stroke. */
function liveRipple(overrides = {}) {
  const field = createWaterField();
  const whale = makeWhale(overrides);
  stepWater(field, school(whale), FRAME);
  whale._motion.wave = beat(1);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1, 'one active beat makes one ring');
  return { field, whale, ripple: field.ripples[0] };
}

/** Fake 2D context: records fillText calls and rejects any other property. */
function fakeTarget() {
  const calls = [];
  const base = {
    font: '',
    fillStyle: '',
    globalAlpha: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillText(text, x, y, maxWidth) {
      calls.push({ text, x, y, maxWidth, alpha: base.globalAlpha, fill: base.fillStyle });
    },
  };
  const target = new Proxy(base, {
    get(object, key) {
      if (typeof key === 'symbol' || CONTEXT_KEYS.has(key)) return object[key];
      throw new Error(`water read forbidden context property: ${String(key)}`);
    },
    set(object, key, value) {
      if (typeof key === 'symbol' || CONTEXT_KEYS.has(key)) {
        object[key] = value;
        return true;
      }
      throw new Error(`water wrote forbidden context property: ${String(key)}`);
    },
  });
  return { target, calls, base };
}

const drawOptions = extra => ({
  width: 640,
  height: 400,
  cellWidth: 8,
  cellHeight: 14,
  ratio: 1,
  font: '600 11px monospace',
  palette: createInkPalette('ocean'),
  opacity: 0.6,
  ...extra,
});

test('a first sighting only records the beat; each 2π crossing adds one ring', () => {
  const field = createWaterField();
  const whale = makeWhale();
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 0, 'a phase never observed must not splash');
  assert.equal(field.beats.get(1).beat, 0);

  whale._motion.wave = beat(1);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);

  // Still inside the same beat: no second ring for the same slap.
  for (let frame = 0; frame < 12; frame++) stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);

  // Several beats skipped in one step still earn a single ring.
  whale._motion.wave = beat(5);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 2);
  assert.equal(field.beats.get(1).beat, 5);
});

test('two actively stroking whales crossing one beat leave two rings at their tails', () => {
  const field = createWaterField();
  const first = makeWhale({ id: 1, x: 320, y: 200, heading: 0 });
  const second = makeWhale({ id: 2, x: 500, y: 300, heading: Math.PI });
  stepWater(field, school(first, second), FRAME);
  first._motion.wave = beat(1);
  second._motion.wave = beat(1);
  stepWater(field, school(first, second), FRAME);
  assert.equal(field.ripples.length, 2);
  const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-9,
    `${value} should be ${expected}`);
  near(field.ripples[0].x, 320 - 120 * 0.54);
  near(field.ripples[0].y, 200);
  near(field.ripples[1].x, 500 + 120 * 0.54);
  near(field.ripples[1].y, 300);
});

test('a gliding fluke updates the beat without splashing and never backfills', () => {
  const field = createWaterField();
  const whale = makeWhale();
  stepWater(field, school(whale), FRAME);
  whale._motion.stroke = 0;
  whale._motion.wave = beat(1);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 0);
  assert.equal(field.beats.get(1).beat, 1, 'the crossed glide beat is remembered');

  // Resuming the stroke inside the already-crossed beat must not splash late.
  whale._motion.stroke = 1;
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 0);

  whale._motion.wave = beat(2);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);
});

test('submerged tail strokes consume their beat without leaving surface ripples', () => {
  const field = createWaterField();
  const whale = makeWhale();
  stepWater(field, school(whale), FRAME);
  whale._motion.submergence = 1;
  whale._motion.wave = beat(1);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 0);
  whale._motion.submergence = 0;
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 0, 'surfacing does not backfill an underwater beat');
  whale._motion.wave = beat(2);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);
});

test('a curved whale splashes at its actual trailing spine node', () => {
  const tail = { x: 174, y: 253 };
  const { ripple } = liveRipple({ rig: { nodes: new Float64Array([320, 200, tail.x, tail.y]) } });
  assert.equal(ripple.x, tail.x);
  assert.equal(ripple.y, tail.y);
});

test('a zero, negative or NaN delta never generates a ring', () => {
  const field = createWaterField();
  const whale = makeWhale();
  stepWater(field, school(whale), FRAME);
  whale._motion.wave = beat(1);
  for (const delta of [0, -1, NaN, undefined, Infinity, -Infinity]) {
    stepWater(field, school(whale), delta);
    assert.equal(field.ripples.length, 0, `delta ${delta}`);
  }
  assert.equal(field.beats.get(1).beat, 0, 'a paused step must not consume the crossing');
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);
});

test('rings expire once their life is spent', () => {
  const { field, ripple } = liveRipple();
  assert.ok(ripple.life >= 2.8 && ripple.life < 3.8);
  // A single long step both ages the ring past its life and removes it.
  stepWater(field, school(), ripple.life + 0.01);
  assert.equal(field.ripples.length, 0);
  const { target, calls } = fakeTarget();
  drawWater(target, field, drawOptions());
  assert.equal(calls.length, 0);
});

test('radius grows quickly first then slowly, bounded by the start and end radii', () => {
  const { ripple } = liveRipple();
  const at = progress => {
    ripple.age = ripple.life * progress;
    return waterRippleRadius(ripple);
  };
  const start = at(0), quarter = at(0.25), half = at(0.5), late = at(0.75), end = at(1);
  assert.ok(start >= 3);
  assert.ok(Math.abs(end - ripple.endRadius) < 1e-9);
  assert.ok(start < quarter && quarter < half && half < late && late < end);
  assert.equal(waterRippleRadius({ age: 0, life: 0, startRadius: 4, endRadius: 40 }), 4);
  assert.equal(waterRippleRadius({ age: 10, life: 1, startRadius: 4, endRadius: 40 }), 40);
  // "fast then slow": the first quarter covers far more ground than the last.
  assert.ok(quarter - start > (end - late) * 2);
  // Bad rings still yield a finite radius instead of NaN.
  const fallback = waterRippleRadius({ age: NaN, life: NaN, startRadius: NaN, endRadius: NaN });
  assert.ok(Number.isFinite(fallback) && fallback >= 0);
});

test('the live-ring cap defaults to 16 and honours a lower maxRipples option', () => {
  const field = createWaterField();
  const whale = makeWhale();
  stepWater(field, school(whale), FRAME);
  for (let index = 1; index <= 24; index++) {
    whale._motion.wave = beat(index);
    stepWater(field, school(whale), 0.01);
  }
  assert.equal(field.ripples.length, 16);
  assert.equal(field.beats.get(1).beat, 24, 'the beat record keeps advancing at the cap');

  const capped = createWaterField();
  const other = makeWhale({ id: 9 });
  stepWater(capped, school(other), FRAME);
  for (let index = 1; index <= 6; index++) {
    other._motion.wave = beat(index);
    stepWater(capped, school(other), 0.01, { maxRipples: 2 });
  }
  assert.equal(capped.ripples.length, 2);
  stepWater(capped, school(other), 0.01, { maxRipples: 0 });
  assert.equal(capped.ripples.length, 2, 'a cap of zero adds nothing but keeps live rings');
});

test('the ring centre trails the whale by 0.54 of its length along -heading', () => {
  const straight = liveRipple({ x: 300, y: 200, heading: 0, length: 100, bodyRadius: 12 });
  assert.ok(Math.abs(straight.ripple.x - 246) < 1e-9);
  assert.ok(Math.abs(straight.ripple.y - 200) < 1e-9);

  const upward = liveRipple({ x: 300, y: 200, heading: Math.PI / 2, length: 100, bodyRadius: 12 });
  assert.ok(Math.abs(upward.ripple.x - 300) < 1e-9);
  assert.ok(Math.abs(upward.ripple.y - 146) < 1e-9);

  const lengthZero = liveRipple({ x: 140, y: 90, heading: 0.7, length: 0 });
  assert.ok(Math.abs(lengthZero.ripple.x - 140) < 1e-9);
  assert.ok(Math.abs(lengthZero.ripple.y - 90) < 1e-9);
});

test('NaN, missing and hostile whale fields never throw or create NaN rings', () => {
  const field = createWaterField();
  const broken = [
    null,
    undefined,
    {},
    { id: NaN, x: NaN, y: NaN, heading: NaN, length: NaN, bodyRadius: NaN },
    { id: 'bad', x: Infinity, y: -Infinity, heading: 'left', length: Infinity, bodyRadius: -5,
      _motion: { wave: NaN, stroke: NaN } },
    { id: 3, x: 10, y: 10, heading: 0, length: 80, bodyRadius: 12, _motion: {} },
    { id: 4, x: 200, y: 120, heading: 0, length: 80, bodyRadius: 12,
      _motion: { wave: beat(1), stroke: 1 } },
  ];
  assert.doesNotThrow(() => stepWater(field, school(...broken), FRAME));
  assert.doesNotThrow(() => stepWater(field, { whales: 'nope' }, FRAME));
  assert.doesNotThrow(() => stepWater(field, {}, FRAME));
  assert.doesNotThrow(() => stepWater(field, null, FRAME));
  assert.doesNotThrow(() => stepWater(field, null, NaN));
  assert.doesNotThrow(() => stepWater(null, null, NaN));
  assert.doesNotThrow(() => resetWaterField(null));
  broken[6]._motion.wave = beat(2);
  assert.doesNotThrow(() => stepWater(field, school(...broken), FRAME));
  assert.ok(field.ripples.length >= 1);
  for (const ripple of field.ripples) {
    for (const key of RIPPLE_KEYS) {
      assert.ok(Number.isFinite(ripple[key]), `ripple.${key} should be finite`);
    }
  }

  // Malformed rings already in the field are pruned, not painted as NaN cells.
  field.ripples.push(null, { age: NaN, life: NaN }, { x: NaN, y: 10, age: 0, life: 5 },
    { x: 10, y: 10, age: 0, life: 5, startRadius: NaN, endRadius: NaN, strength: NaN, seed: NaN });
  assert.doesNotThrow(() => stepWater(field, school(), FRAME));
  for (const ripple of field.ripples) {
    assert.ok(Number.isFinite(ripple.x) && Number.isFinite(ripple.y));
    assert.ok(Number.isFinite(ripple.age) && Number.isFinite(ripple.life));
  }
  const { target, calls } = fakeTarget();
  assert.doesNotThrow(() => drawWater(target, field, drawOptions()));
  for (const call of calls) {
    assert.ok(Number.isFinite(call.x) && Number.isFinite(call.y) && Number.isFinite(call.alpha));
  }
});

test('a reset wave resynchronises silently instead of splashing', () => {
  const field = createWaterField();
  const whale = makeWhale();
  stepWater(field, school(whale), FRAME);
  whale._motion.wave = beat(3);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);
  whale._motion.wave = 0.2;
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1, 'a rewound phase makes no ring');
  assert.equal(field.beats.get(1).beat, 0);
  whale._motion.wave = beat(1);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 2);
});

test('resetWaterField clears both rings and beat memory', () => {
  const { field, whale } = liveRipple();
  resetWaterField(field);
  assert.equal(field.ripples.length, 0);
  assert.equal(field.beats.size, 0);
  // Same phase, but the beat memory is gone: this is a first sighting again.
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 0);
  whale._motion.wave = beat(2);
  stepWater(field, school(whale), FRAME);
  assert.equal(field.ripples.length, 1);
});

test('ripple fields follow the specified life, radius and strength ranges', () => {
  const { ripple } = liveRipple();
  assert.ok(ripple.life >= 2.8 && ripple.life < 3.8);
  assert.ok(ripple.startRadius >= 3);
  assert.ok(Math.abs(ripple.endRadius - 16 * 2.8) < 1e-9);
  assert.equal(ripple.strength, 1);
  assert.ok(ripple.seed >= 0 && ripple.seed < 1);

  const gentle = liveRipple({ _motion: { wave: 0, stroke: 0.6, age: 0 } });
  assert.ok(Math.abs(gentle.ripple.strength - 0.6) < 1e-9);
  assert.ok(Math.abs(gentle.ripple.endRadius - 16 * (1.9 + 0.9 * 0.6)) < 1e-9);

  const huge = liveRipple({ bodyRadius: 400 });
  assert.equal(huge.ripple.endRadius, 120);
  const tiny = liveRipple({ bodyRadius: 1 });
  assert.equal(tiny.ripple.endRadius, 34);
  assert.equal(tiny.ripple.startRadius, 3);
});

test('drawWater paints dashed rings into snapped cell centres under the opacity cap', () => {
  const { field } = liveRipple({ x: 320, y: 200, length: 200, bodyRadius: 40 });
  // A just-born ring is only a few pixels wide; sample it after it has grown.
  for (const ripple of field.ripples) ripple.age = 0.5;
  const { target, calls, base } = fakeTarget();
  const rendered = drawWater(target, field, drawOptions());
  assert.equal(rendered, calls.length, 'the return value counts painted glyphs');
  assert.ok(calls.length >= 12, `expected a visible ring, got ${calls.length}`);
  assert.equal(base.textAlign, 'center');
  assert.equal(base.textBaseline, 'middle');
  assert.equal(base.font, '600 11px monospace');
  assert.equal(base.globalAlpha, 1, 'the context alpha is restored after painting');
  const palette = createInkPalette('ocean');
  for (const call of calls) {
    assert.ok(call.alpha > 0 && call.alpha <= 0.6 + 1e-9, `alpha ${call.alpha}`);
    assert.ok(SILENT_GLYPHS.has(call.text), `quiet glyph expected, got ${call.text}`);
    assert.ok(Number.isInteger(call.x) && Number.isInteger(call.y), 'snapped to cell centre');
    assert.ok(call.x >= 0 && call.x <= 640 && call.y >= 0 && call.y <= 400);
    assert.ok(palette.includes(call.fill), `palette ink expected, got ${call.fill}`);
    assert.ok(call.maxWidth > 0);
  }
  // The splash is only alive during the first 0.3s.
  const { target: quiet, calls: quietCalls } = fakeTarget();
  for (const ripple of field.ripples) ripple.age = 0.8;
  drawWater(quiet, field, drawOptions());
  assert.ok(quietCalls.length > 0);
  assert.ok(quietCalls.every(call => call.text !== ','), 'splash drops have settled');

  // Without a font option the engine's configured font stays untouched.
  const untouched = fakeTarget();
  assert.ok(drawWater(untouched.target, field, drawOptions({ font: undefined })) > 0);
  assert.equal(untouched.base.font, '');
});

test('ratio snaps painted coordinates to device pixels', () => {
  const { field } = liveRipple();
  const { target, calls } = fakeTarget();
  drawWater(target, field, drawOptions({ ratio: 2 }));
  assert.ok(calls.length > 0);
  for (const call of calls) {
    assert.ok(Math.abs(call.x * 2 - Math.round(call.x * 2)) < 1e-9);
    assert.ok(Math.abs(call.y * 2 - Math.round(call.y * 2)) < 1e-9);
  }
});

test('a zero fade paints nothing, a partial fade clips at the cell centre', () => {
  const { field } = liveRipple({ x: 60, y: 100, length: 40, bodyRadius: 16 });
  const zero = fakeTarget();
  assert.equal(drawWater(zero.target, field, drawOptions({ fade: () => 0 })), 0);
  assert.equal(zero.calls.length, 0);

  const partial = fakeTarget();
  drawWater(partial.target, field, drawOptions({ fade: (x, y) => x < 50 ? 1 : 0 }));
  assert.ok(partial.calls.length > 0, 'the visible half still paints');
  assert.ok(partial.calls.every(call => call.x < 50));

  const nanFade = fakeTarget();
  drawWater(nanFade.target, field, drawOptions({ fade: () => NaN }));
  assert.equal(nanFade.calls.length, 0);
});

test('empty fields, zero opacity and invalid targets are no-ops', () => {
  const empty = fakeTarget();
  assert.equal(drawWater(empty.target, createWaterField(), drawOptions()), 0);
  assert.equal(empty.calls.length, 0);

  const { field } = liveRipple();
  const hidden = fakeTarget();
  drawWater(hidden.target, field, drawOptions({ opacity: 0 }));
  assert.equal(hidden.calls.length, 0);
  drawWater(hidden.target, field, drawOptions({ width: 0 }));
  assert.equal(hidden.calls.length, 0);
  drawWater(hidden.target, field, drawOptions({ height: -20 }));
  assert.equal(hidden.calls.length, 0);
  assert.doesNotThrow(() => drawWater(null, field, drawOptions()));
  assert.doesNotThrow(() => drawWater({}, field, drawOptions()));
  assert.doesNotThrow(() => drawWater(hidden.target, null, drawOptions()));
  assert.doesNotThrow(() => drawWater(hidden.target, { ripples: 'nope' }, drawOptions()));
  assert.equal(hidden.calls.length, 0);
});
