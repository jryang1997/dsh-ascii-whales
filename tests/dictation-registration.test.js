import test from 'node:test';
import assert from 'node:assert/strict';
import { registerWhales } from '../src/settings.js';

const recording = { schema: 1, seq: 1, phase: 'recording', since: 10, sessionId: null };

function registration(t, { inject = true, available = undefined, answer = null } = {}) {
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
  const form = { getSnapshot: () => ({ status: 'ready', value: {} }), subscribe: () => () => {} };
  const ctx = {
    configForms: { get: () => form },
    locale: { register: () => () => {}, bind: () => key => key },
    effect(callback) { const dispose = callback(); if (typeof dispose === 'function') cleanups.push(dispose); },
    get: name => name === 'dictation' ? available : undefined,
    slots: { inject: (_name, callback) => callback(), register: (options, component) => slots.set(options.name, component) },
  };
  if (inject) ctx.inject = (names, callback) => injections.set(names[0], callback);
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useMemo: callback => callback(),
    useEffect() {},
  };
  registerWhales(ctx, React, { en: {}, zh: {} });
  const render = () => slots.get('shell.overlay')({ usePanelInfo: () => null }).props.children[0].props;
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
