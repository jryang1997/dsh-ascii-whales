import test from 'node:test';
import assert from 'node:assert/strict';
import { createInkPalette } from '../src/shading.js';
import {
  createVoiceSeaField,
  drawVoiceSea,
  resetVoiceSeaField,
  stepVoiceSea,
  voiceSeaDisplacement,
  VOICE_SEA_MAX_AMPLITUDE,
  VOICE_SEA_MAX_GLYPHS,
  VOICE_SEA_MAX_RINGS,
} from '../src/voice-sea.js';

const FRAME = 1 / 60;
const SILENT_GLYPHS = new Set(['~', '·', '˙', "'", ';']);
const CONTEXT_KEYS = new Set(['font', 'fillStyle', 'globalAlpha', 'textAlign', 'textBaseline', 'fillText']);
const RING_KEYS = ['x', 'y', 'age', 'life', 'startRadius', 'maxRadius', 'strength', 'seed', 'phase', 'rise', 'serial'];

const scene = extra => ({ x: 320, y: 280, width: 640, height: 400, enabled: true, ...extra });

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
      throw new Error(`voice-sea read forbidden context property: ${String(key)}`);
    },
    set(object, key, value) {
      if (typeof key === 'symbol' || CONTEXT_KEYS.has(key)) {
        object[key] = value;
        return true;
      }
      throw new Error(`voice-sea wrote forbidden context property: ${String(key)}`);
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

function drive(field, seconds, level, options = scene(), frame = FRAME) {
  const steps = Math.max(1, Math.round(seconds / frame));
  for (let i = 0; i < steps; i++) stepVoiceSea(field, frame, level, options);
  return field;
}

function paint(field, options = drawOptions()) {
  const { target, calls } = fakeTarget();
  const drawn = drawVoiceSea(target, field, options);
  return { drawn, calls };
}

/** A hand-built ring at a known age, useful when a test needs exact radii. */
function ringAt(serial, extra = {}) {
  return {
    x: 320,
    y: 280,
    age: 0.42,
    life: 1.3,
    startRadius: 4,
    maxRadius: 200,
    strength: 0.9,
    seed: (serial * 0.37) % 1,
    serial,
    phase: serial * 0.7,
    rise: 5,
    ...extra,
  };
}

const syntheticField = rings => ({
  rings,
  level: 1,
  smoothed: 1,
  time: 0,
  x: 320,
  y: 280,
  width: 640,
  height: 400,
});

test('createVoiceSeaField starts at rest with the documented shape', () => {
  assert.deepEqual(createVoiceSeaField(), {
    rings: [],
    level: 0,
    smoothed: 0,
    time: 0,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
});

test('the field and the drawer are deterministic for identical inputs', () => {
  const script = field => {
    for (let frame = 0; frame < 240; frame++) {
      const level = frame % 90 < 45 ? Math.sin(frame * 0.11) ** 2 : 0;
      stepVoiceSea(field, FRAME, level, scene({
        x: 300 + frame % 7,
        y: 260 + frame % 5,
        enabled: frame % 30 < 25,
      }));
    }
    return field;
  };
  const a = script(createVoiceSeaField());
  const b = script(createVoiceSeaField());
  assert.deepEqual(a, b);
  assert.ok(a.rings.length > 0, 'the script has to actually make rings');
  assert.deepEqual(paint(a), paint(b));
});

test('zero, negative and non-finite deltas are true no-ops', () => {
  const field = drive(createVoiceSeaField(), 0.8, 1);
  assert.ok(field.rings.length > 0);
  const before = structuredClone(field);
  for (const delta of [0, -1 / 60, NaN, undefined, Infinity, -Infinity]) {
    stepVoiceSea(field, delta, 1, scene());
    assert.deepEqual(field, before, `delta ${delta}`);
  }
  stepVoiceSea(field, FRAME, 1, scene());
  assert.notDeepEqual(field, before, 'a later valid step still advances normally');
});

test('a disabled step never spawns and a resting field stays byte-identical', () => {
  const resting = createVoiceSeaField();
  const before = structuredClone(resting);
  for (let frame = 0; frame < 120; frame++) {
    stepVoiceSea(resting, FRAME, 1, scene({ enabled: false }));
  }
  assert.deepEqual(resting, before);
  assert.equal(resting.time, 0);

  // A loud field drains instead of emitting once enabled turns false.
  const field = drive(createVoiceSeaField(), 0.6, 1);
  const live = field.rings.length;
  assert.ok(live > 0);
  for (let frame = 0; frame < 6; frame++) stepVoiceSea(field, FRAME, 1, scene({ enabled: false }));
  assert.equal(field.level, 0);
  assert.ok(field.smoothed < 1);
  assert.ok(field.rings.length <= live, 'no ring may be born while disabled');
  drive(field, 2.5, 1, scene({ enabled: false }));
  assert.equal(field.rings.length, 0);
  assert.equal(field.smoothed, 0);
  assert.equal(paint(field).drawn, 0);
});

test('attack reaches the live level in about 80ms and silence releases it in about 400ms', () => {
  const field = createVoiceSeaField();
  stepVoiceSea(field, 0.04, 1, scene());
  assert.ok(Math.abs(field.smoothed - 0.5) < 1e-9, `smoothed ${field.smoothed}`);
  stepVoiceSea(field, 0.04, 1, scene());
  assert.equal(field.smoothed, 1);
  assert.equal(field.level, 1);
  stepVoiceSea(field, 0.2, 0, scene());
  assert.ok(Math.abs(field.smoothed - 0.5) < 1e-9, `release ${field.smoothed}`);
  stepVoiceSea(field, 0.2, 0, scene());
  assert.equal(field.smoothed, 0);
});

test('silence stops emission and leaves a visually calm sea within 0.5s', () => {
  const field = drive(createVoiceSeaField(), 1, 1);
  assert.ok(field.rings.length > 0);
  drive(field, 0.5, 0);
  assert.equal(field.smoothed, 0);
  assert.equal(field.level, 0);
  const lingering = field.rings.length;
  for (let frame = 0; frame < 60; frame++) stepVoiceSea(field, FRAME, 0, scene());
  assert.ok(field.rings.length <= lingering, 'silence must not spawn');
  assert.equal(paint(field).drawn, 0, 'a settled envelope paints nothing');
});

test('the envelope is frame-step safe on attack and release', () => {
  const single = createVoiceSeaField();
  stepVoiceSea(single, 0.04, 1, scene());
  const split = createVoiceSeaField();
  for (let i = 0; i < 4; i++) stepVoiceSea(split, 0.01, 1, scene());
  assert.ok(Math.abs(single.smoothed - split.smoothed) < 1e-12);
  assert.ok(single.smoothed > 0 && single.smoothed < 1);

  const coarse = createVoiceSeaField();
  const fine = createVoiceSeaField();
  stepVoiceSea(coarse, 0.2, 1, scene());
  stepVoiceSea(fine, 0.2, 1, scene());
  stepVoiceSea(coarse, 0.2, 0, scene());
  for (let i = 0; i < 12; i++) stepVoiceSea(fine, FRAME, 0, scene());
  assert.ok(Math.abs(coarse.smoothed - fine.smoothed) < 1e-12);
  assert.ok(coarse.smoothed > 0 && coarse.smoothed < 1);
});

test('the level is clamped to 0..1 and rings never exceed the documented limits', () => {
  const field = drive(createVoiceSeaField(), 0.5, 5);
  assert.equal(field.level, 1);
  assert.equal(field.smoothed, 1);
  const limit = Math.min(640, 400) * 0.55;
  assert.ok(field.rings.length > 0 && field.rings.length <= VOICE_SEA_MAX_RINGS);
  for (const ring of field.rings) {
    assert.ok(ring.strength > 0 && ring.strength <= 1);
    assert.ok(ring.maxRadius > 0 && ring.maxRadius <= limit);
  }
  drive(field, 0.5, -5);
  assert.equal(field.level, 0);
  assert.ok(field.smoothed < 1);
  const quiet = drive(createVoiceSeaField(), 0.2, NaN);
  assert.equal(quiet.level, 0);
  assert.equal(quiet.smoothed, 0);
  assert.equal(quiet.rings.length, 0);
});

test('quiet microphone RMS emits visible wave fronts while silence stays calm', () => {
  for (const rms of [0.01, 0.02, 0.04]) {
    const field = drive(createVoiceSeaField(), 2, rms);
    assert.ok(field.rings.length > 0, `raw RMS ${rms} must emit a front`);
    assert.ok(paint(field).drawn > 0, `raw RMS ${rms} must reach the canvas`);
  }
  const silence = drive(createVoiceSeaField(), 2, 0);
  assert.equal(silence.rings.length, 0);
  assert.equal(paint(silence).drawn, 0);
});

test('quiet, medium and loud raw RMS have strictly increasing measured surface amplitude', () => {
  const fields = [0, 0.005, 0.02, 0.08].map(rms => drive(createVoiceSeaField(), 1, rms));
  const peaks = fields.map(field => {
    let peak = 0;
    for (let frame = 0; frame < 120; frame++) {
      field.time = frame / 120;
      peak = Math.max(peak, Math.abs(voiceSeaDisplacement(field, 340, 260)));
    }
    return peak;
  });
  assert.equal(peaks[0], 0);
  assert.ok(peaks[1] > 3, `quiet input must visibly move the sea: ${peaks[1]}`);
  assert.ok(peaks[2] > peaks[1] * 1.3);
  assert.ok(peaks[3] > peaks[2] * 1.3);
  assert.ok(peaks[3] <= VOICE_SEA_MAX_AMPLITUDE);
  drive(fields[3], 0.5, 0);
  assert.equal(voiceSeaDisplacement(fields[3], 340, 260), 0);
  assert.equal(voiceSeaDisplacement(null, 340, 260), 0);
  assert.equal(voiceSeaDisplacement(fields[2], NaN, 260), 0);
});

test('live loudness changes actual vertical wave displacement, not just ink or ring count', () => {
  const ring = ringAt(7, { x: 750, y: 500, maxRadius: 140 });
  const options = drawOptions({ width: 1500, height: 1000, cellWidth: 1, cellHeight: 1, opacity: 1 });
  const coordinates = (smoothed, time = 0.17) => paint({ ...syntheticField([ring]), smoothed, time }, options)
    .calls.map(({ x, y }) => ({ x, y }));
  const quiet = coordinates(0.1);
  const loud = coordinates(0.7);
  assert.ok(quiet.length > 0 && loud.length > 0);
  assert.notDeepEqual(quiet, loud, 'the same existing front must rise/fall further at a louder live level');
  assert.notDeepEqual(coordinates(0.7, 0.17), coordinates(0.7, 0.32),
    'the same front must oscillate with the live surface clock');
});

test('louder levels spawn more, larger and brighter rings within the cap', () => {
  const loud = drive(createVoiceSeaField(), 1.2, 1);
  const soft = drive(createVoiceSeaField(), 1.2, 0.035);
  assert.equal(loud.rings.length, VOICE_SEA_MAX_RINGS);
  assert.ok(soft.rings.length > 0 && soft.rings.length < VOICE_SEA_MAX_RINGS);
  const maxRadius = field => Math.max(...field.rings.map(ring => ring.maxRadius));
  assert.ok(maxRadius(loud) > maxRadius(soft));
  const loudPaint = paint(loud);
  const softPaint = paint(soft);
  assert.ok(loudPaint.drawn > softPaint.drawn);
  assert.ok(loudPaint.drawn <= VOICE_SEA_MAX_GLYPHS);

  // Track the live-ring cap on every frame, not only at the end.
  const tracked = createVoiceSeaField();
  let peak = 0;
  for (let frame = 0; frame < 300; frame++) {
    stepVoiceSea(tracked, FRAME, 1, scene());
    peak = Math.max(peak, tracked.rings.length);
  }
  assert.equal(peak, VOICE_SEA_MAX_RINGS);
});

test('rings live 0.8-1.6s, cull when spent, and reset clears the field', () => {
  const field = drive(createVoiceSeaField(), 0.8, 1);
  assert.ok(field.rings.length > 0);
  for (const ring of field.rings) {
    assert.ok(ring.life >= 0.8 && ring.life <= 1.6, `life ${ring.life}`);
    assert.ok(Number.isFinite(ring.age) && ring.age >= 0 && ring.age < ring.life);
  }
  const longest = Math.max(...field.rings.map(ring => ring.life));
  stepVoiceSea(field, longest + 0.01, 0, scene({ enabled: false }));
  assert.equal(field.rings.length, 0);
  assert.equal(paint(field).drawn, 0);

  const reset = drive(createVoiceSeaField(), 0.5, 1);
  const oldRings = reset.rings;
  resetVoiceSeaField(reset);
  assert.deepEqual(reset, createVoiceSeaField());
  assert.notEqual(reset.rings, oldRings);
  const fresh = drive(createVoiceSeaField(), 0.5, 1);
  assert.deepEqual(drive(reset, 0.5, 1), fresh, 'a reset restarts deterministically');
});

test('the max radius follows the smaller canvas edge with a floor and a ceiling', () => {
  const wide = drive(createVoiceSeaField(), 2, 1, scene({ x: 400, y: 300, width: 800, height: 600 }));
  const limit = Math.min(800, 600) * 0.55;
  assert.ok(wide.rings.length > 0);
  for (const ring of wide.rings) {
    assert.ok(ring.maxRadius <= limit + 1e-9, `radius ${ring.maxRadius}`);
    assert.ok(ring.maxRadius >= 12);
    assert.equal(ring.x, 400);
    assert.equal(ring.y, 300);
  }

  // A tiny canvas keeps a sane floor instead of collapsing to zero.
  const tiny = drive(createVoiceSeaField(), 1, 1, scene({ x: 60, y: 30, width: 120, height: 60 }));
  const tinyLimit = Math.max(24, Math.min(120, 60) * 0.55);
  assert.ok(tiny.rings.length > 0);
  for (const ring of tiny.rings) assert.ok(ring.maxRadius <= tinyLimit + 1e-9);

  // A resize may push a live anchor off-screen: the ring is dropped, not drawn.
  stepVoiceSea(tiny, FRAME, 1, scene({ x: 10, y: 10, width: 40, height: 30, enabled: false }));
  assert.equal(tiny.rings.length, 0);

  // A canvas smaller than the radius floor has no room for a swell at all.
  const micro = drive(createVoiceSeaField(), 1, 1, scene({ x: 10, y: 6, width: 20, height: 12 }));
  assert.equal(micro.rings.length, 0);
});

test('the drawer paints snapped cell centres under the opacity cap like drawWater', () => {
  const field = drive(createVoiceSeaField(), 0.9, 1);
  const { target, calls, base } = fakeTarget();
  const drawn = drawVoiceSea(target, field, drawOptions());
  assert.equal(drawn, calls.length, 'the return value counts painted glyphs');
  assert.ok(drawn > 0 && drawn <= VOICE_SEA_MAX_GLYPHS);
  assert.equal(base.textAlign, 'center');
  assert.equal(base.textBaseline, 'middle');
  assert.equal(base.font, '600 11px monospace');
  assert.equal(base.globalAlpha, 1, 'the context alpha is restored after painting');
  const palette = createInkPalette('ocean');
  for (const call of calls) {
    assert.ok(SILENT_GLYPHS.has(call.text), `quiet glyph expected, got ${call.text}`);
    assert.ok(Number.isInteger(call.x) && Number.isInteger(call.y), 'snapped to the cell centre');
    assert.ok(call.alpha > 0 && call.alpha <= 0.6 + 1e-9, `alpha ${call.alpha}`);
    assert.ok(call.x >= 0 && call.x <= 640 && call.y >= 0 && call.y <= 400);
    assert.ok(palette.includes(call.fill), `palette ink expected, got ${call.fill}`);
    assert.ok(call.maxWidth > 0);
  }
  assert.deepEqual(paint(field), { drawn, calls }, 'the same field paints the same cells');

  // Device-pixel ratio and the engine's fractional cell grid snap cleanly too.
  const fractional = fakeTarget();
  const fractionalDrawn = drawVoiceSea(fractional.target, field,
    drawOptions({ cellWidth: 7.7, cellHeight: 13.2, ratio: 2 }));
  assert.ok(fractionalDrawn > 0);
  for (const call of fractional.calls) {
    assert.ok(Math.abs(call.x * 2 - Math.round(call.x * 2)) < 1e-9, 'x snaps to a device pixel');
    assert.ok(Math.abs(call.y * 2 - Math.round(call.y * 2)) < 1e-9, 'y snaps to a device pixel');
    assert.ok(call.x >= 0 && call.x <= 640 + 7.7);
    assert.ok(call.y >= 0 && call.y <= 400 + 13.2);
    assert.ok(palette.includes(call.fill));
  }

  // Without a font option the engine's configured font stays untouched.
  const untouched = fakeTarget();
  assert.ok(drawVoiceSea(untouched.target, field, drawOptions({ font: undefined })) > 0);
  assert.equal(untouched.base.font, '');
});

test('one ring reads as broken arcs with real angular gaps, not a closed circle', () => {
  const field = syntheticField([ringAt(7)]);
  const { calls } = paint(field);
  assert.ok(calls.length >= 8);
  const centreX = 320, centreY = 280;
  const angles = calls.map(call => Math.atan2(call.y - centreY, call.x - centreX)).sort((a, b) => a - b);
  let largestGap = angles[0] + Math.PI * 2 - angles[angles.length - 1];
  for (let i = 1; i < angles.length; i++) largestGap = Math.max(largestGap, angles[i] - angles[i - 1]);
  assert.ok(largestGap > 0.25, `largest angular gap ${largestGap}`);
});

test('the glyph budget caps a dense frame at 180 and honours a smaller cap', () => {
  const denseField = syntheticField(Array.from({ length: VOICE_SEA_MAX_RINGS }, (_, index) =>
    ringAt(index, { maxRadius: 220, age: 0.5 })));
  const dense = paint(denseField, drawOptions({ maxGlyphs: 9999 }));
  assert.equal(dense.drawn, VOICE_SEA_MAX_GLYPHS, 'a dense frame saturates the hard cap');
  assert.equal(dense.drawn, dense.calls.length);

  const capped = paint(denseField, drawOptions({ maxGlyphs: 40 }));
  assert.equal(capped.drawn, Math.min(dense.drawn, 40));
  assert.ok(capped.drawn > 0);
  assert.equal(capped.calls.length, capped.drawn);
});

test('zero fade, zero opacity and invalid targets paint nothing', () => {
  const field = drive(createVoiceSeaField(), 1.2, 1);
  assert.ok(field.rings.length > 0);
  const zeroFade = fakeTarget();
  assert.equal(drawVoiceSea(zeroFade.target, field, drawOptions({ fade: () => 0 })), 0);
  assert.equal(zeroFade.calls.length, 0);
  const nanFade = fakeTarget();
  assert.equal(drawVoiceSea(nanFade.target, field, drawOptions({ fade: () => NaN })), 0);
  const hidden = fakeTarget();
  assert.equal(drawVoiceSea(hidden.target, field, drawOptions({ opacity: 0 })), 0);
  assert.equal(drawVoiceSea(hidden.target, field, drawOptions({ width: 0 })), 0);
  assert.equal(drawVoiceSea(hidden.target, field, drawOptions({ height: -20 })), 0);
  assert.equal(drawVoiceSea(hidden.target, createVoiceSeaField(), drawOptions()), 0);
  assert.doesNotThrow(() => drawVoiceSea(null, field, drawOptions()));
  assert.doesNotThrow(() => drawVoiceSea({}, field, drawOptions()));
  assert.doesNotThrow(() => drawVoiceSea(hidden.target, null, drawOptions()));
  assert.doesNotThrow(() => drawVoiceSea(hidden.target, { rings: 'nope' }, drawOptions()));
  assert.equal(hidden.calls.length, 0);

  // A partial fade clips at the cell centre, exactly like drawWater.
  const partial = fakeTarget();
  drawVoiceSea(partial.target, field, drawOptions({ fade: x => x < 320 ? 1 : 0 }));
  assert.ok(partial.calls.length > 0, 'the visible half still paints');
  assert.ok(partial.calls.every(call => call.x < 320));

  // The palette falls back to the shared ocean table when the caller omits one.
  const fallback = fakeTarget();
  assert.ok(drawVoiceSea(fallback.target, field, drawOptions({ palette: undefined })) > 0);
  assert.ok(fallback.calls.every(call => typeof call.fill === 'string' && call.fill.length > 0));
});

test('every painted point stays within its ring radius of the composer anchor', () => {
  // The simulation passes 0/0 until the composer rect is measured: no rings may
  // grow out of the canvas origin before a real anchor arrives.
  const unset = drive(createVoiceSeaField(), 0.5, 1, scene({ x: 0, y: 0 }));
  assert.equal(unset.rings.length, 0);

  const anchorX = 300, anchorY = 260;
  const field = drive(createVoiceSeaField(), 1.1, 1, scene({ x: anchorX, y: anchorY }));
  assert.equal(field.x, anchorX);
  assert.equal(field.y, anchorY);
  assert.ok(field.rings.length > 0);
  for (const ring of field.rings) {
    assert.equal(ring.x, anchorX);
    assert.equal(ring.y, anchorY);
  }
  const reach = Math.max(...field.rings.map(ring => ring.maxRadius + ring.rise));
  const { calls } = paint(field);
  assert.ok(calls.length > 0);
  for (const call of calls) {
    const distance = Math.hypot(call.x - anchorX, call.y - anchorY);
    assert.ok(distance <= reach + 16, `distance ${distance} from anchor`);
  }
});

test('NaN, missing and hostile inputs never throw or paint NaN cells', () => {
  assert.doesNotThrow(() => stepVoiceSea(null, FRAME, 1));
  assert.doesNotThrow(() => resetVoiceSeaField(null));
  assert.doesNotThrow(() => stepVoiceSea({}, FRAME, NaN, null));
  assert.doesNotThrow(() => stepVoiceSea(createVoiceSeaField(), FRAME, 1,
    { x: NaN, y: 'up', width: -5, height: NaN, enabled: true }));

  const field = createVoiceSeaField();
  stepVoiceSea(field, FRAME, Infinity, scene());
  assert.equal(field.level, 1);
  stepVoiceSea(field, FRAME, -Infinity, scene());
  assert.equal(field.level, 0);

  field.rings.push(null, {}, { x: NaN, y: 10, age: 0, life: 1 },
    { x: 10, y: 10, age: NaN, life: NaN, maxRadius: NaN, strength: NaN, seed: NaN,
      startRadius: NaN, phase: NaN, rise: NaN, serial: NaN });
  assert.doesNotThrow(() => stepVoiceSea(field, FRAME, 1, scene()));
  for (const ring of field.rings) {
    for (const key of RING_KEYS) {
      assert.ok(Number.isFinite(ring[key]), `ring.${key} should be finite`);
    }
  }
  const { target, calls } = fakeTarget();
  assert.doesNotThrow(() => drawVoiceSea(target, field, drawOptions()));
  for (const call of calls) {
    assert.ok(Number.isFinite(call.x) && Number.isFinite(call.y) && Number.isFinite(call.alpha));
  }
});
