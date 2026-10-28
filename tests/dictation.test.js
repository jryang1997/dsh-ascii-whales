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
    assert.ok(Math.abs(slot.heading - Math.atan2(card.top + card.height / 2 - slot.y,
      card.left + card.width / 2 - slot.x)) < 1e-9, 'every heading faces the composer centre');
  }
  // The vertical gap is the body reach plus the breathing room the motion layer needs.
  for (let i = 0; i < whales.length; i += 1) {
    if (!slots[i].queue) assert.ok(card.top - slots[i].y >= bodyReach(whales[i]) + GATHER.bobAlong + GATHER.clearance - 1e-9);
  }
});

test('gather keeps every approach target when no waiting band fits', () => {
  const whales = school(3);
  const targets = gatherGeometry({ card: { ...card, top: 90 }, whales, width: 1160, height: 860 });
  assert.equal(targets.length, whales.length);
  targets.forEach(target => assert.ok(target && Number.isFinite(target.x) && Number.isFinite(target.y)));
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
      if (slots[i].queue || slots[j].queue || slots[i].row === slots[j].row) continue;
      const space = 0.53 * (whales[i].length + whales[j].length);
      assert.ok(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y) >= space - 1e-6,
        'cross-row pair stays outside the personal space');
    }
  }
});

test('an oversized school keeps safe rows when the entire school cannot fit', () => {
  const scene = createScene(5, '鲸', 'mixed', 1.55, 21);
  resizeScene(scene, 800, 600);
  const composer = { left: 96, top: 445, width: 640, height: 110 };
  const slots = gatherGeometry({ card: composer, whales: scene.whales, width: 800, height: 600 });
  assert.ok(Array.isArray(slots), 'at least the first safe row must respond');
  assert.equal(slots.length, scene.whales.length);
  const placed = slots.flatMap((slot, index) => slot ? [{ slot, whale: scene.whales[index] }] : []);
  assert.equal(placed.length, scene.whales.length, 'crowding must never opt a whale out');
  assert.ok(placed.some(entry => entry.slot.queue), 'the fixture exercises approach queues');
  for (const { slot, whale } of placed) {
    assert.ok(Number.isFinite(slot.x) && Number.isFinite(slot.y) && Number.isFinite(slot.heading));
    if (slot.queue) continue;
    assert.ok(slot.y >= Math.max(24, 600 * GATHER.topLimitRatio));
    assert.ok(slot.y + bodyReach(whale) + GATHER.bobAlong < composer.top);
  }
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    const a = placed[i], b = placed[j];
    if (a.slot.queue || b.slot.queue) continue;
    assert.ok(Math.hypot(a.slot.x - b.slot.x, a.slot.y - b.slot.y)
      >= 0.53 * (a.whale.length + b.whale.length) * 1.18 - 1e-8);
  }
});

test('every count and cramped viewport keeps finite composer-facing approach intentions', () => {
  for (let count = 1; count <= 8; count++) {
    for (const [width, height] of [[1160, 860], [390, 844], [120, 90], [1, 1]]) {
      const whales = school(count, width, height);
      const composer = { left: width * 0.1, top: height * 0.65, width: width * 0.8, height: height * 0.3 };
      const targets = gatherGeometry({ card: composer, whales, width, height });
      assert.equal(targets.length, count);
      targets.forEach(slot => {
        assert.ok(slot && Number.isFinite(slot.x) && Number.isFinite(slot.y) && Number.isFinite(slot.heading));
        assert.ok(slot.x >= 0 && slot.x <= width && slot.y >= 0 && slot.y <= height);
        const heading = Math.atan2(composer.top + composer.height / 2 - slot.y,
          composer.left + composer.width / 2 - slot.x);
        assert.ok(Math.abs(slot.heading - heading) < 1e-9, 'heading is never preserved merely to avoid a large turn');
      });
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
  const savedCustomEvent = globalThis.CustomEvent;
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
    if (savedCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = savedCustomEvent;
  }
});

function fallbackDom(t) {
  const savedDocument = globalThis.document;
  const savedCustomEvent = globalThis.CustomEvent;
  const listeners = new Map();
  let answer = null;
  let requests = 0;
  const emit = detail => listeners.get('dsh:dictation')?.({ detail });
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  };
  globalThis.document = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    dispatchEvent(event) {
      if (event.type === 'dsh:dictation:request') { requests++; if (answer) emit(answer); }
    },
  };
  t.after(() => {
    globalThis.document = savedDocument;
    if (savedCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = savedCustomEvent;
  });
  return { emit, listeners, requests: () => requests, answer: detail => { answer = detail; } };
}

test('new attachments own cleanup even when the service face is reused', () => {
  const bridge = createDictationBridge();
  const first = fakeService();
  const second = fakeService();
  const oldDetach = bridge.attach(first.face);
  const sameFaceDetach = bridge.attach(first.face);
  oldDetach();
  assert.equal(bridge.hasProvider(), true, 'older detach must not clear a newer attachment of the same face');
  first.publish({ phase: 'processing', seq: 2 });
  assert.equal(bridge.getSnapshot().phase, 'processing');
  const nextDetach = bridge.attach(second.face);
  sameFaceDetach();
  first.publish({ phase: 'error', seq: 3 });
  assert.equal(bridge.getSnapshot().phase, 'recording', 'replaced providers cannot publish into the new attachment');
  nextDetach();
  assert.equal(bridge.hasProvider(), false);
  assert.deepEqual(bridge.getSnapshot(), EMPTY_DICTATION);
  second.publish({ phase: 'processing', seq: 4 });
  assert.deepEqual(bridge.getSnapshot(), EMPTY_DICTATION, 'detached providers no longer publish');
});

test('an already queued callback from a replaced provider cannot overwrite the primary', () => {
  const bridge = createDictationBridge();
  const old = fakeService();
  const next = fakeService();
  let queued;
  old.face.subscribe = callback => { queued = callback; return () => {}; };
  bridge.attach(old.face);
  const detach = bridge.attach(next.face);
  old.publish({ phase: 'error', seq: 5 });
  queued();
  assert.equal(bridge.getSnapshot().phase, 'recording');
  detach();
  queued();
  assert.equal(bridge.getSnapshot().phase, 'idle');
});

test('fallback stays listening while primary wins without duplicate snapshot notifications', t => {
  const dom = fallbackDom(t);
  const bridge = createDictationBridge();
  const provider = fakeService();
  const detachFallback = bridge.attachFallback(() => provider.face);
  const first = bridge.getSnapshot();
  let notifications = 0;
  bridge.subscribe(() => notifications++);
  dom.emit(provider.face.getSnapshot());
  assert.equal(bridge.getSnapshot(), first, 'equivalent semantic events preserve the snapshot reference');
  const detach = bridge.attach(provider.face);
  assert.equal(bridge.getSnapshot(), first, 'primary handover with the same state is stable');
  assert.equal(notifications, 0);
  assert.equal(dom.listeners.has('dsh:dictation'), true);
  provider.publish({ phase: 'processing', seq: 2 });
  const primary = bridge.getSnapshot();
  dom.emit(provider.face.getSnapshot());
  dom.emit({ schema: 1, phase: 'error', seq: 99 });
  assert.equal(bridge.getSnapshot(), primary, 'DOM events cannot supersede the primary');
  assert.equal(notifications, 1, 'one producer transition is one consumer notification');
  detach();
  assert.equal(bridge.getSnapshot().phase, 'idle', 'detach resets before a fresh fallback event');
  dom.emit({ schema: 1, phase: 'recording', seq: 3 });
  assert.equal(bridge.getSnapshot().phase, 'recording');
  detachFallback();
  assert.equal(dom.listeners.size, 0);
  assert.equal(bridge.getSnapshot().phase, 'idle');
  assert.equal(bridge.level(), 0, 'fallback cleanup releases its resolver');
});

test('primary detach requests current fallback state instead of replaying pre-primary events', t => {
  const dom = fallbackDom(t);
  const bridge = createDictationBridge();
  const fallback = { schema: 1, phase: 'recording', seq: 1 };
  dom.answer(fallback);
  const detachFallback = bridge.attachFallback();
  assert.equal(bridge.getSnapshot().phase, 'recording');
  const detach = bridge.attach(fakeService().face);
  dom.answer({ ...fallback, phase: 'done', seq: 3 });
  detach();
  assert.equal(dom.requests(), 2);
  assert.equal(bridge.getSnapshot().phase, 'done', 'synchronous request responses reach the restored fallback');
  detachFallback();
});

test('fallback level is a safe pull of a live schema-1 face with no React notifications', t => {
  const dom = fallbackDom(t);
  const bridge = createDictationBridge();
  let face;
  let throws = false;
  const detachFallback = bridge.attachFallback(() => {
    if (throws) throw new Error('lookup unavailable');
    return face;
  });
  let notifications = 0;
  let presenceNotifications = 0;
  bridge.subscribe(() => notifications++);
  bridge.subscribePresence(() => presenceNotifications++);
  assert.equal(bridge.level(), 0);
  assert.equal(bridge.hasProvider(), false);
  dom.emit({ schema: 1, phase: 'recording', level: 1, rms: 1 });
  assert.equal(bridge.level(), 0, 'semantic event fields never substitute for audio RMS');
  face = { ...fakeService().face, level: () => 0.08 };
  dom.emit(face.getSnapshot());
  const before = notifications;
  const presenceBefore = presenceNotifications;
  const snapshot = bridge.getSnapshot();
  for (let frame = 0; frame < 120; frame++) assert.equal(bridge.level(), 0.08);
  assert.equal(notifications, before);
  assert.equal(presenceNotifications, presenceBefore, 'frame pulls do not notify either store');
  assert.equal(bridge.getSnapshot(), snapshot);
  assert.equal(bridge.hasProvider(), true);
  const primary = fakeService();
  primary.face.level = () => 0.25;
  const detach = bridge.attach(primary.face);
  assert.equal(bridge.level(), 0.25, 'the attached provider owns amplitude as well as semantics');
  primary.face.level = () => NaN;
  assert.equal(bridge.level(), 0, 'invalid primary RMS cannot borrow another provider\'s signal');
  detach();
  assert.equal(bridge.level(), 0.08, 'primary detach restores the live fallback resolver');
  for (const [raw, expected] of [[NaN, 0], [Infinity, 0], [-1, 0], [2.5, 1]]) {
    face = { ...face, level: () => raw };
    assert.equal(bridge.level(), expected);
  }
  face = { ...face, level: () => { throw new Error('analyser disposed'); } };
  assert.equal(bridge.level(), 0);
  face = { ...face, schema: 2, level: () => 0.8 };
  assert.equal(bridge.level(), 0, 'foreign schemas cannot supply RMS');
  throws = true;
  assert.equal(bridge.level(), 0);
  assert.equal(bridge.hasProvider(), false);
  detachFallback();
});

test('fallback replacement gives cleanup to the newest registration', t => {
  const dom = fallbackDom(t);
  const bridge = createDictationBridge();
  const oldDetach = bridge.attachFallback();
  dom.emit({ schema: 1, phase: 'recording', seq: 1 });
  const detach = bridge.attachFallback();
  assert.equal(bridge.getSnapshot().phase, 'idle', 'new fallback ownership cannot inherit stale recording');
  oldDetach();
  dom.emit({ schema: 1, phase: 'recording', seq: 1 });
  assert.equal(bridge.getSnapshot().phase, 'recording');
  detach();
  assert.equal(dom.listeners.size, 0);
  assert.equal(bridge.getSnapshot().phase, 'idle');
});
