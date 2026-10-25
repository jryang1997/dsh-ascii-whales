import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, resizeScene } from '../src/model.js';
import { GATHER, EMPTY_DICTATION, bodyReach, createDictationBridge, gatherActive,
  gatherGeometry, holdOffset, normalizeDictation, stepEngage } from '../src/dictation.js';

const card = { left: 220, top: 710, width: 720, height: 118 };
const school = (count, width = 1160, height = 860) => {
  const scene = createScene(count, '鲸', 'mixed', 1);
  resizeScene(scene, width, height);
  return scene.whales;
};

test('unknown snapshots normalize to the frozen idle snapshot', () => {
  assert.equal(normalizeDictation(undefined), EMPTY_DICTATION);
  assert.equal(normalizeDictation(null), EMPTY_DICTATION);
  assert.equal(normalizeDictation({ phase: 'recording' }), EMPTY_DICTATION, 'schema is required');
  assert.equal(normalizeDictation({ schema: 2, phase: 'recording' }), EMPTY_DICTATION, 'other versions are ignored');
  const unknown = normalizeDictation({ schema: 1, phase: 'teleport' });
  assert.equal(unknown.phase, 'idle');
  const full = normalizeDictation({ schema: 1, seq: 4, phase: 'recording', since: 12,
    sessionId: 's', locked: true, cancelArmed: true, polishing: true, pending: true, code: 'x' });
  assert.deepEqual({ ...full }, { schema: 1, seq: 4, phase: 'recording', since: 12,
    sessionId: 's', locked: true, cancelArmed: true, polishing: true, pending: true, code: 'x' });
  assert.ok(Object.isFrozen(full));
});

test('the hold covers recording and processing only', () => {
  const phase = value => gatherActive(normalizeDictation({ schema: 1, phase: value }));
  assert.equal(phase('recording'), true);
  assert.equal(phase('processing'), true);
  assert.equal(phase('listening'), false, 'a plain press before the threshold must not move the school');
  assert.equal(phase('done'), false);
  assert.equal(phase('idle'), false);
  assert.equal(phase('error'), false);
  assert.equal(gatherActive(null), false);
});

test('body reach is positive and grows with body length', () => {
  const whales = school(2);
  for (const whale of whales) assert.ok(bodyReach(whale) > 0);
  const small = { ...whales[0], length: 100 };
  const large = { ...whales[0], length: 300 };
  assert.ok(bodyReach(large) > bodyReach(small));
});

test('the gather band sits above the card and clears every body', () => {
  const whales = school(3);
  const slots = gatherGeometry({ card, whales, width: 1160, height: 860 });
  assert.ok(Array.isArray(slots) && slots.length === whales.length);
  for (const slot of slots) {
    assert.ok(slot, 'every whale gets a slot');
    assert.ok(slot.y < card.top, 'the body stays above the card top');
    assert.ok(slot.x >= GATHER.edge && slot.x <= 1160 - GATHER.edge);
    assert.equal(Math.abs(Math.sin(slot.heading)) < 1e-9, true, 'headings stay horizontal');
  }
  // The vertical gap is the body reach plus the breathing room the motion layer needs.
  for (let i = 0; i < whales.length; i += 1) {
    assert.ok(card.top - slots[i].y >= bodyReach(whales[i]) + GATHER.bobAlong + GATHER.clearance - 1e-9);
  }
});

test('gather returns null when the canvas has no room above the card', () => {
  const whales = school(3);
  assert.equal(gatherGeometry({ card: { ...card, top: 90 }, whales, width: 1160, height: 860 }), null);
  assert.equal(gatherGeometry({ card: null, whales, width: 1160, height: 860 }), null);
  assert.equal(gatherGeometry({ card, whales: [], width: 1160, height: 860 }), null);
  assert.equal(gatherGeometry({ card, whales, width: 0, height: 0 }), null);
});

test('a crowded narrow school uses a second row instead of misplacing whales', () => {
  const whales = school(8, 390, 844);
  const slots = gatherGeometry({ card: { left: 20, top: 700, width: 350, height: 96 },
    whales, width: 390, height: 844 });
  assert.ok(slots, 'the geometry still succeeds');
  assert.ok(slots.some(slot => slot && slot.row === 1), 'at least one whale uses the far row');
  for (const slot of slots) assert.ok(slot.y > Math.max(24, 844 * GATHER.topLimitRatio));
});

test('two-row slots keep cross-row separation at the avoidance personal space', () => {
  const whales = school(8, 390, 844);
  const width = 390, height = 844;
  const slots = gatherGeometry({ card: { left: 20, top: 700, width: 350, height: 96 }, whales, width, height });
  assert.ok(slots && slots.some(slot => slot.row === 1), 'fixture actually uses two rows');
  for (let i = 0; i < whales.length; i += 1) {
    for (let j = i + 1; j < whales.length; j += 1) {
      if (!slots[i] || !slots[j] || slots[i].row === slots[j].row) continue;
      const space = 0.53 * (whales[i].length + whales[j].length);
      assert.ok(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y) >= space - 1e-6,
        'cross-row pair stays outside the personal space');
    }
  }
});

test('the hold bob stays within a few pixels and is deterministic', () => {
  const slot = { x: 400, y: 500, heading: 0, row: 0 };
  const a = holdOffset(slot, 3.2, 1.1);
  const b = holdOffset(slot, 3.2, 1.1);
  assert.deepEqual(a, b);
  assert.ok(Math.hypot(a.x, a.y) <= GATHER.bobAlong + GATHER.bobAcross + 1e-9);
});

test('the engage ramp is bounded, monotonic and direction-reversible', () => {
  assert.equal(stepEngage(0, true, 0), 0, 'a zero delta never moves');
  assert.equal(stepEngage(0, false, 10), 0, 'already at the target');
  let value = 0;
  for (let i = 0; i < 60; i += 1) value = stepEngage(value, true, 0.05);
  assert.ok(Math.abs(value - 1) < 1e-9, 'settles at 1');
  assert.equal(stepEngage(1, true, 5), 1, 'clamped');
  const down = stepEngage(1, false, 0.1);
  assert.ok(down < 1 && down > 0, 'ramps back down');
  assert.ok(stepEngage(down, true, 0.1) > down, 'can reverse mid-ramp');
  assert.equal(stepEngage(0.5, true, -1), 0.5, 'negative deltas are ignored');
});

const fakeService = () => {
  let snapshot = { schema: 1, seq: 1, phase: 'recording', since: 10, sessionId: 's',
    locked: false, cancelArmed: false, polishing: false, pending: false, code: null };
  const listeners = new Set();
  return {
    face: { schema: 1, getSnapshot: () => snapshot,
      subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
      level: () => 2.5 },
    publish(next) { snapshot = { ...snapshot, ...next }; for (const listener of [...listeners]) listener(); },
  };
};

test('the consumer bridge follows the provider, clamps the level and resets on detach', () => {
  const bridge = createDictationBridge();
  const provider = fakeService();
  assert.equal(bridge.hasProvider(), false);
  assert.deepEqual(bridge.getSnapshot(), EMPTY_DICTATION);
  const detach = bridge.attach(provider.face);
  assert.equal(bridge.hasProvider(), true);
  assert.equal(bridge.getSnapshot().phase, 'recording');
  assert.equal(bridge.level(), 1, 'the consumer clamps an unclamped RMS');
  provider.publish({ phase: 'processing', seq: 2 });
  assert.equal(bridge.getSnapshot().phase, 'processing');
  detach();
  assert.equal(bridge.hasProvider(), false);
  assert.deepEqual(bridge.getSnapshot(), EMPTY_DICTATION);
  assert.equal(bridge.level(), 0);
});

test('provider presence reaches settings without depending on phase changes', () => {
  const bridge = createDictationBridge();
  const seen = [];
  const stop = bridge.subscribePresence(() => seen.push(bridge.hasProvider()));
  const provider = fakeService();
  const detach = bridge.attach(provider.face);
  detach();
  stop();
  assert.deepEqual(seen, [true, false]);
});

test('the degraded DOM channel only publishes valid schema-1 details', () => {
  const listeners = new Map();
  const saved = globalThis.document;
  globalThis.document = {
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => { if (listeners.get(type) === fn) listeners.delete(type); },
    dispatchEvent: () => {},
  };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  try {
    const bridge = createDictationBridge();
    const detach = bridge.attachFallback();
    const handler = listeners.get('dsh:dictation');
    assert.equal(typeof handler, 'function');
    handler({ detail: { schema: 1, phase: 'recording', seq: 3 } });
    assert.equal(bridge.getSnapshot().phase, 'recording');
    handler({ detail: { schema: 2, phase: 'recording' } });
    assert.equal(bridge.getSnapshot().phase, 'recording', 'other versions are ignored');
    detach();
    assert.equal(listeners.has('dsh:dictation'), false);
  } finally {
    globalThis.document = saved;
    delete globalThis.CustomEvent;
  }
});
