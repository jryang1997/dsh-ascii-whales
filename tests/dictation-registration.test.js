import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWhales } from '../src/settings.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { voiceSeaDisplacement } from '../src/voice-sea.js';
import { normalizeConfig } from '../src/model.js';
import { gatherGeometry } from '../src/dictation.js';
import { resetWhaleRig } from '../src/rig.js';

const recording = { schema: 1, seq: 1, phase: 'recording', since: 10, sessionId: null };

function registration(t, { inject = true, available = undefined, answer = null, value = {} } = {}) {
  const savedDocument = globalThis.document;
  const savedCustomEvent = globalThis.CustomEvent;
  const target = new EventTarget();
  const handlers = new Set();
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, init) { super(type); this.detail = init?.detail; }
  };
  globalThis.document = {
    addEventListener(type, listener) {
      if (type === 'dsh:dictation') handlers.add(listener);
      target.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      if (type === 'dsh:dictation') handlers.delete(listener);
      target.removeEventListener(type, listener);
    },
    dispatchEvent: event => target.dispatchEvent(event),
  };
  const emit = detail => document.dispatchEvent(new CustomEvent('dsh:dictation', { detail }));
  let requests = 0;
  target.addEventListener('dsh:dictation:request', () => { requests++; if (answer) emit(answer); });
  const cleanups = [];
  const injections = new Map();
  const slots = new Map();
  const form = { getSnapshot: () => ({ status: 'ready', value }), subscribe: () => () => {} };
  const ctx = {
    configForms: { get: () => form },
    locale: { register: () => () => {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => 'en' },
    effect(callback) { const dispose = callback(); if (typeof dispose === 'function') cleanups.push(dispose); },
    get: name => name === 'dictation' ? available : undefined,
    slots: { inject: (_name, callback) => callback(), register: (options, component) => slots.set(options.name, component) },
  };
  if (inject) ctx.inject = (names, callback) => injections.set(names[0], callback);
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useMemo: callback => callback(),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: initial => ({ current: initial }),
    useCallback: callback => callback,
    useEffect() {},
  };
  registerWhales(ctx, React, { en: {}, zh: {} });
  const render = () => {
    // The overlay also renders legend and announcement siblings, so find the
    // canvas component rather than assuming it is the first child.
    const findCanvas = node => {
      if (!node || typeof node !== 'object') return null;
      if (node.type?.name === 'Canvas') return node;
      const children = node.props?.children;
      if (!Array.isArray(children)) return null;
      for (const child of children) { const hit = findCanvas(child); if (hit) return hit; }
      return null;
    };
    const canvas = findCanvas(slots.get('shell.overlay')({ usePanelInfo: () => null }));
    if (!canvas) throw new Error('Overlay did not render the canvas');
    return canvas.props;
  };
  const unload = () => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); };
  t.after(() => {
    unload();
    globalThis.document = savedDocument;
    if (savedCustomEvent === undefined) delete globalThis.CustomEvent;
    else globalThis.CustomEvent = savedCustomEvent;
  });
  return {
    emit, render, unload, handlers,
    setService: value => { available = value; },
    activate: face => {
      let detach;
      injections.get('dictation')({ dictation: face, effect: callback => {
        detach = callback();
        if (typeof detach === 'function') cleanups.push(detach);
      } });
      return detach;
    },
    requests: () => requests,
  };
}

function provider(snapshot = recording, value = 0.16) {
  let current = snapshot;
  const listeners = new Set();
  return {
    schema: 1,
    getSnapshot: () => current,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    level: () => value,
    publish(next) { current = next; for (const listener of [...listeners]) listener(); },
  };
}

test('registerWhales receives semantic events when inject exists but never activates', t => {
  const setup = registration(t);
  assert.equal(setup.requests(), 1, 'late consumers request the current semantic state');
  setup.emit(recording);
  assert.equal(setup.render().dictation.phase, 'recording');
  assert.equal(setup.render().dictationLevel(), 0, 'events contain no RMS');
  setup.unload();
  assert.equal(setup.handlers.size, 0, 'unload removes the fallback listener');
});

test('registerWhales pulls real RMS through optional lookup without activating inject', t => {
  const face = provider();
  const setup = registration(t, { available: face, answer: recording });
  assert.equal(setup.render().dictation.phase, 'recording');
  assert.equal(setup.render().dictationLevel(), 0.16);
});

test('registerWhales handles late providers, primary priority, detach and unload', t => {
  const setup = registration(t);
  assert.equal(setup.render().dictation.phase, 'idle');
  assert.equal(setup.render().dictationLevel(), 0);
  const face = provider();
  setup.setService(face);
  setup.emit(recording);
  assert.equal(setup.render().dictation.phase, 'recording');
  assert.equal(setup.render().dictationLevel(), 0.16);
  const detach = setup.activate(face);
  face.publish({ ...recording, seq: 2, phase: 'processing' });
  setup.emit({ ...recording, seq: 3, phase: 'error' });
  assert.equal(setup.render().dictation.phase, 'processing', 'the main subscription wins over DOM');
  setup.setService(undefined);
  detach();
  assert.equal(setup.render().dictation.phase, 'idle');
  assert.equal(setup.render().dictationLevel(), 0);
  setup.emit({ ...recording, seq: 4, phase: 'done' });
  assert.equal(setup.render().dictation.phase, 'done', 'fallback resumes after primary detach');
  setup.unload();
  assert.equal(setup.handlers.size, 0);
  setup.emit(recording);
  assert.equal(setup.render().dictation.phase, 'idle', 'disposed registration cannot hold stale recording');
});

test('registerWhales still uses lookup and fallback on hosts without inject', t => {
  const setup = registration(t, { inject: false, available: provider(), answer: recording });
  assert.equal(setup.render().dictation.phase, 'recording');
  assert.equal(setup.render().dictationLevel(), 0.16);
});

test('a same-frame new recording invalidates targets even without an idle simulation step', () => {
  const simulation = createWhaleSimulation(normalizeConfig({ count: 5, whaleSize: 1.55 }), { seed: 21 });
  simulation.resize(800, 600);
  const card = { left: 96, top: 504, width: 608, height: 72 };
  simulation.setDictationAnchor(card);
  simulation.setDictation(recording, () => 0.02);
  for (let frame = 0; frame < 120; frame++) simulation.advance(1 / 60);
  const before = simulation.scene.dictation.slots;
  simulation.setDictation({ ...recording, seq: 2, phase: 'done' }, () => 0);
  // A hidden/paused page can receive both events before the next animation tick.
  for (const whale of simulation.scene.whales) { whale.x = 800 - whale.x; resetWhaleRig(whale); }
  const expected = gatherGeometry({ card, whales: simulation.scene.whales, width: 800, height: 600 });
  assert.notDeepEqual(expected, before);
  simulation.setDictation({ ...recording, seq: 3 }, () => 0.02);
  simulation.advance(1 / 60);
  assert.deepEqual(simulation.scene.dictation.slots, expected);
  simulation.dispose();
});

test('live provider RMS drives strictly increasing displacement through registered overlay and simulation', t => {
  let rms = 0;
  const face = { ...provider(), level: () => rms };
  const setup = registration(t, { available: face, answer: recording,
    value: { count: 1, glyphSize: 16, glass: false, activity: false } });
  const props = setup.render();
  const simulation = createWhaleSimulation(props.config, { seed: 21 });
  simulation.resize(1160, 860);
  simulation.setDictationAnchor({ left: 220, top: 710, width: 720, height: 118 });
  simulation.setDictation(props.dictation, props.dictationLevel);
  const peak = () => {
    let result = 0;
    for (let frame = 0; frame < 120; frame++) {
      simulation.advance(1 / 60);
      result = Math.max(result, Math.abs(voiceSeaDisplacement(simulation.voiceSea, 600, 650)));
    }
    return result;
  };
  assert.equal(peak(), 0);
  const measured = [];
  for (const level of [0.005, 0.02, 0.08]) {
    rms = level;
    for (let frame = 0; frame < 30; frame++) simulation.advance(1 / 60);
    measured.push(peak());
  }
  assert.ok(measured[0] > 3);
  assert.ok(measured[1] > measured[0] * 1.3);
  assert.ok(measured[2] > measured[1] * 1.3);
  rms = 0;
  for (let frame = 0; frame < 30; frame++) simulation.advance(1 / 60);
  assert.equal(voiceSeaDisplacement(simulation.voiceSea, 600, 650), 0);
  simulation.dispose();
});

test('registerWhales unload disposes active primary and fallback ownership', t => {
  const setup = registration(t);
  const face = provider();
  setup.setService(face);
  setup.activate(face);
  assert.equal(setup.render().dictation.phase, 'recording');
  setup.unload();
  assert.equal(setup.handlers.size, 0);
  face.publish({ ...recording, seq: 2, phase: 'processing' });
  setup.emit(recording);
  assert.equal(setup.render().dictation.phase, 'idle');
  assert.equal(setup.render().dictationLevel(), 0);
});
