import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhaleSimulation } from '../src/simulation.js';
import { DEFAULTS } from '../src/model.js';
import { createWorkMetrics } from '../src/work-metrics.js';

test('observed simulation counts executed internal ticks without changing scene or effects', () => {
  const metrics = createWorkMetrics();
  const observed = createWhaleSimulation(DEFAULTS, { seed: 42, metrics });
  const control = createWhaleSimulation(DEFAULTS, { seed: 42 });
  for (const simulation of [observed, control]) simulation.resize(800, 600);
  for (const delta of [1 / 120, 1 / 120, 0.1]) {
    observed.advance(delta);
    control.advance(delta);
  }
  const sample = metrics.snapshot();
  assert.equal(sample.counters.advance.count, 3);
  assert.equal(sample.counters.motionStep.count, 7);
  assert.equal(sample.counters.waterUpdate.count, 3);
  assert.equal(sample.counters.atmosphereUpdate.count, 2);
  assert.equal(sample.counters.rainUpdate.count, 2);
  assert.ok(sample.counters.rainStep.count >= 7);
  assert.deepEqual(observed.scene, control.scene);
  for (const key of ['water', 'atmosphere', 'rain']) assert.deepEqual(observed[key], control[key]);
  observed.update({ ...DEFAULTS, speed: 0 });
  observed.advance(1);
  assert.equal(metrics.snapshot().counters.motionStep.count, 7, 'paused clock must not invent internal work');
  observed.dispose();
  observed.advance(1);
  assert.equal(metrics.snapshot().counters.advance.count, 4);
  assert.equal(sample.counters.advance.count, 3, 'snapshots do not mutate after collection');
  assert.ok(Object.isFrozen(sample.counters.advance));
});

test('bounded observation retains totals, marks truncation and rejects invalid metrics', () => {
  let clock = 0;
  const metrics = createWorkMetrics({ limit: 1, now: () => clock++ });
  metrics.end('draw', metrics.begin(), 'animation');
  const first = metrics.snapshot();
  metrics.end('draw', metrics.begin(), 'activity');
  const second = metrics.snapshot();
  assert.equal(second.counters.draw.count, 2);
  assert.equal(second.timeline.length, 1);
  assert.equal(second.dropped, 1);
  assert.equal(first.counters.draw.count, 1);
  assert.throws(() => metrics.end('invented', 0), /Invalid/);
  metrics.reset();
  assert.equal(metrics.snapshot().counters.draw.count, 0);
  assert.equal(metrics.snapshot().dropped, 0);
});
