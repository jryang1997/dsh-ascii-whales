import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhaleLayer } from '../src/engine.js';
import { DEFAULTS } from '../src/model.js';
import { createWorkMetrics } from '../src/work-metrics.js';
import { environment } from './helpers/artifact-render-harness.js';

function fixture(extra = {}, reduced = false) {
  const env = environment('', {}, 42, reduced);
  const saved = new Map(Object.keys(env.globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(env.globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const canvas = env.document.createElement('canvas');
  const metrics = createWorkMetrics();
  const config = { ...DEFAULTS, glass: false, readingEffect: 'none', clouds: false, quietCenter: false, spout: false, ...extra };
  const presentations = [];
  const layer = createWhaleLayer(canvas, config, { seed: 42, metrics, onActivityChange: value => presentations.push(value) });
  return { ...env, canvas, metrics, layer, config, presentations,
    update(patch) { Object.assign(config, patch); layer.update(config); },
    close() { layer.dispose(); for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    } },
  };
}
const activity = kind => ({ scope: 'main', entities: [{ key: 'job:build', type: 'job', label: 'build', kind }] });
const glyphs = f => f.canvas.getContext('2d').commands.filter(c => c.op === 'fillText').map(c => c.args[0]);

test('events reach text and Canvas without waiting for the economy timer and bursts remain bounded', () => {
  for (const reduced of [false, true]) {
    const f = fixture({ resourceMode: 'economy' }, reduced);
    try {
      f.metrics.reset();
      f.layer.setActivity(activity('running'));
      for (let i = 0; i < 50; i++) f.layer.setActivity(activity(i % 2 ? 'failed' : 'running'));
      assert.equal(f.presentations.at(-1).entities[0].kind, 'failed', 'text comes from the same tracker immediately');
      f.elapse(20, 120);
      assert.ok(glyphs(f).includes('× build'));
      const s = f.metrics.snapshot();
      assert.equal(s.counters.wakeup.count, 0, 'event paint did not need the timer');
      assert.equal(s.counters.refreshWakeup.count, 1);
      assert.equal(s.timeline.filter(e => e.name === 'draw' && e.cause === 'activity').length, 2);
      assert.ok(s.timeline.filter(e => e.name === 'draw').every(e => e.atMs <= 20));
      assert.deepEqual(f.pending(), { raf: 0, timers: reduced ? 0 : 1 });
    } finally { f.close(); }
  }
});

test('pause, hidden, disabled and dispose cancel both channels and resume without catchup', () => {
  for (const resourceMode of ['standard', 'economy']) {
    const f = fixture({ resourceMode });
    try {
      f.elapse(1000);
      f.update({ speed: 0 });
      assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
      const frozen = structuredClone(f.canvas.getContext('2d').commands);
      f.metrics.reset();
      f.elapse(10000);
      assert.equal(f.metrics.snapshot().counters.wakeup.count, 0);
      assert.deepEqual(f.canvas.getContext('2d').commands, frozen);
      f.update({ opacity: 0.5 });
      assert.equal(f.metrics.snapshot().counters.draw.count, 1, 'paused config has one static refresh');
      assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
      f.layer.setActivity(activity('running'));
      f.document.hidden = true;
      f.document.dispatchEvent({ type: 'visibilitychange' });
      assert.deepEqual(f.observersActive(), { resize: 0, mutation: 0 });
      assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
      f.metrics.reset(); f.elapse(10000);
      assert.equal(f.metrics.snapshot().counters.draw.count, 0);
      f.document.hidden = false;
      f.document.dispatchEvent({ type: 'visibilitychange' });
      f.update({ speed: 0.65 });
      f.elapse(100);
      assert.ok(f.metrics.snapshot().counters.motionStep.count <= 6, 'hidden time was discarded');
      f.update({ enabled: false });
      f.document.dispatchEvent({ type: 'wheel' });
      assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
      f.update({ enabled: true });
      f.layer.setActivity(activity('waiting'));
    } finally { f.close(); }
    assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
    const before = f.metrics.snapshot(); f.elapse(1000);
    assert.deepEqual(f.metrics.snapshot(), before);
  }
});

test('mid-result mode, reduced-motion and scene changes retain deadline and select exactly one scheduler', () => {
  const f = fixture({ resourceMode: 'economy', speed: 0.3 });
  try {
    f.layer.setActivity(activity('running'));
    f.layer.setActivity(activity('completed'));
    f.elapse(2000);
    f.setReducedMotion(true);
    f.update({ resourceMode: 'standard', text: '接续' });
    assert.equal(f.config.speed, 0.3);
    assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
    f.elapse(20000);
    assert.equal(f.presentations.at(-1).entities[0].kind, 'completed');
    assert.ok(glyphs(f).includes('✓ build'));
    f.setReducedMotion(false);
    assert.deepEqual(f.pending(), { raf: 1, timers: 0 });
    f.elapse(3800);
    assert.equal(f.presentations.at(-1).entities[0].kind, 'completed');
    f.elapse(300);
    assert.ok(!f.presentations.at(-1).entities.some(e => e.kind === 'completed'));
    f.update({ resourceMode: 'economy' });
    f.metrics.reset();
    assert.deepEqual(f.pending(), { raf: 0, timers: 1 });
    f.elapse(1000, 120);
    assert.equal(f.metrics.snapshot().counters.wakeup.count, 15);
    f.update({ resourceMode: 'standard' });
    f.metrics.reset();
    f.elapse(1000, 120);
    assert.equal(f.metrics.snapshot().counters.wakeup.count, 120);
    assert.equal(f.metrics.snapshot().counters.motionStep.count, 59);
    assert.deepEqual(f.pending(), { raf: 1, timers: 0 });
  } finally { f.close(); }
});

test('scroll pause keeps text current and defers Canvas until the quiet interval', () => {
  const f = fixture({ resourceMode: 'economy', pauseOnScroll: true });
  try {
    f.layer.setActivity(activity('running'));
    f.document.dispatchEvent({ type: 'wheel' });
    assert.equal(f.canvas.style.opacity, '0');
    assert.deepEqual(f.pending(), { raf: 0, timers: 1 });
    f.metrics.reset();
    f.layer.setActivity(activity('waiting'));
    assert.equal(f.presentations.at(-1).entities[0].kind, 'waiting');
    f.elapse(130);
    assert.equal(f.metrics.snapshot().counters.draw.count, 0);
    assert.equal(f.metrics.snapshot().counters.motionStep.count, 0);
    f.elapse(20);
    assert.ok(glyphs(f).includes('! build'));
    assert.equal(f.metrics.snapshot().counters.scrollWakeup.count, 1);
    assert.deepEqual(f.pending(), { raf: 0, timers: 1 });
  } finally { f.close(); }
});

test('disabling a scroll-paused instance releases the pause and re-enables a visible layer', () => {
  for (const resourceMode of ['standard', 'economy']) for (const reduced of [false, true]) {
    for (const visibility of ['visible', 'hidden-before-disable', 'hidden-after-disable']) {
      const f = fixture({ resourceMode, pauseOnScroll: true }, reduced);
      try {
        f.layer.setActivity(activity('running'));
        f.layer.setActivity(activity('completed'));
        f.document.dispatchEvent({ type: 'wheel' });
        assert.equal(f.canvas.style.opacity, '0');
        if (visibility === 'hidden-before-disable') {
          f.document.hidden = true;
          f.document.dispatchEvent({ type: 'visibilitychange' });
        }
        f.update({ enabled: false });
        assert.equal(f.canvas.style.opacity, '', `${resourceMode}/${reduced}/${visibility} releases scroll opacity`);
        assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
        assert.deepEqual(f.observersActive(), { resize: 0, mutation: 0 });
        f.metrics.reset();
        f.elapse(10000);
        assert.equal(f.metrics.snapshot().counters.draw.count, 0);
        assert.equal(f.metrics.snapshot().counters.motionStep.count, 0);
        assert.equal(f.metrics.snapshot().counters.scrollWakeup.count, 0);
        if (visibility === 'hidden-after-disable') f.document.hidden = true;
        f.update({ enabled: true });
        f.document.hidden = false;
        f.document.dispatchEvent({ type: 'visibilitychange' });
        assert.equal(f.canvas.style.opacity, '');
        assert.ok(glyphs(f).includes('✓ build'), 'result clock did not consume disabled time');
        assert.deepEqual(f.pending(), { raf: reduced || resourceMode === 'economy' ? 0 : 1,
          timers: !reduced && resourceMode === 'economy' ? 1 : 0 });
      } finally { f.close(); }
      assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
      assert.deepEqual(f.observersActive(), { resize: 0, mutation: 0 });
    }
  }
});

test('economy owns a low frequency timer rather than display-rate RAF and performs fewer real steps', () => {
  for (const hz of [60, 120]) {
    const f = fixture({ resourceMode: 'economy', rain: true });
    try {
      assert.deepEqual(f.pending(), { raf: 0, timers: 1 });
      f.metrics.reset();
      f.elapse(1000, hz);
      const s = f.metrics.snapshot();
      assert.equal(s.counters.wakeup.count, 15);
      assert.equal(s.counters.motionStep.count, 30);
      assert.ok(s.counters.rainStep.count <= 15);
      assert.equal(s.timeline.filter(e => e.name === 'draw' && e.cause === 'animation').length, 15);
      assert.deepEqual(f.pending(), { raf: 0, timers: 1 });
    } finally { f.close(); }
    assert.deepEqual(f.pending(), { raf: 0, timers: 0 });
  }
});
