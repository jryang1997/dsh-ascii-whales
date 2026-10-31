import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeConfig } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { createWorkMetrics } from '../src/work-metrics.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const activity = kind => ({ scope: 'main', entities: [{ key: 'job:build', type: 'job', label: 'build', kind }] });

test('switching mode and rebuilding mid-result preserve identity, colors, positions and the remaining six second deadline', () => {
  const config = { ...DEFAULTS, speed: 0.3 };
  const simulation = createWhaleSimulation(config, { seed: 42 });
  simulation.resize(800, 600);
  simulation.setActivity(activity('running'));
  simulation.setActivity(activity('completed'));
  for (let i = 0; i < 120; i++) simulation.advance(1 / 60);
  const before = structuredClone(simulation.scene);
  simulation.update({ ...config, resourceMode: 'economy' });
  assert.deepEqual(simulation.scene, before, 'mode changes only runtime policy');
  simulation.update({ ...config, resourceMode: 'economy', text: '接续', count: 4 });
  close(simulation.scene.time, 2);
  for (let i = 0; i < 3; i++) for (const key of ['x', 'y', 'heading', 'colorIndex']) {
    assert.equal(simulation.scene.whales[i][key], before.whales[i][key], key);
  }
  simulation.update({ ...config, resourceMode: 'economy', text: '接续', count: 4, speed: 0 });
  for (let i = 0; i < 100; i++) simulation.advance(0.1);
  assert.equal(simulation.scene.whales[0].activity.kind, 'completed');
  close(simulation.scene.time, 2);
  simulation.update({ ...config, resourceMode: 'economy', text: '接续', count: 4 });
  for (let i = 0; i < 59; i++) simulation.advance(1 / 15);
  assert.equal(simulation.scene.whales[0].activity.kind, 'completed');
  simulation.advance(1 / 15);
  assert.ok(simulation.scene.whales.every(w => w.activity?.kind !== 'completed'));
  simulation.setActivity({ scope: 'other', entities: [] });
  assert.ok(simulation.scene.whales.every(w => !w.activity));
  simulation.dispose();
});

test('economy executes fewer physical and rain steps while clocks and minimum speed stay independent', () => {
  const metrics = createWorkMetrics();
  const saved = normalizeConfig({ ...DEFAULTS, speed: 0.3, resourceMode: 'economy', rain: true });
  const simulation = createWhaleSimulation(saved, { seed: 42, metrics });
  simulation.resize(800, 600);
  simulation.setActivity(activity('running'));
  simulation.setActivity(activity('completed'));
  for (let i = 0; i < 75; i++) simulation.advance(1 / 15);
  close(simulation.scene.time, 5);
  close(simulation.scene.whales[0]._motion.age, 1.125);
  assert.equal(saved.speed, 0.3);
  assert.equal(simulation.scene.whales[0].activity.kind, 'completed');
  assert.equal(metrics.snapshot().counters.motionStep.count, 150);
  assert.ok(metrics.snapshot().counters.rainStep.count <= 150);
  for (let i = 0; i < 16; i++) simulation.advance(1 / 15);
  assert.ok(simulation.scene.whales.every(w => w.activity?.kind !== 'completed'));
  simulation.dispose();
});
