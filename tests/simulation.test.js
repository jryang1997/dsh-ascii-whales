import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, whalePose } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';

const config = extra => normalizeConfig({ count: 1, species: 'blue', speed: 1, ...extra });
const pose = simulation => whalePose(simulation.scene.whales[0], simulation.scene.time,
  simulation.scene.width, simulation.scene.height, 1);

test('scene replacement preserves an actual independent dive through the simulation interface', () => {
  const initial = config();
  const simulation = createWhaleSimulation(initial, { seed: 1592594996 });
  simulation.resize(1400, 850);
  for (let i = 0; i < 120 * 60 && pose(simulation).submergence === 0; i++) simulation.advance(1 / 60);
  for (let i = 0; i < 30; i++) simulation.advance(1 / 60);
  const before = pose(simulation);
  assert.ok(before.submergence > 0);
  const previous = simulation.scene;
  assert.equal(simulation.update(config({ text: '继续', species: 'humpback', whaleSize: 1.2 })), true);
  assert.notEqual(simulation.scene, previous);
  const after = pose(simulation);
  for (const key of ['x', 'y', 'heading', 'submergence', 'divePitch', 'diveDepth', 'diveKick', 'diveArch']) {
    assert.equal(after[key], before[key], key);
  }
  assert.equal(simulation.scene.width, 1400);
  assert.equal(simulation.scene.height, 850);
  assert.equal(simulation.water.ripples.length, 0);
});

test('simulation uses elapsed fixed ticks for water and weather and pauses both', () => {
  const initial = config();
  const a = createWhaleSimulation(initial, { seed: 42 }), b = createWhaleSimulation(initial, { seed: 42 });
  a.resize(800, 600); b.resize(800, 600);
  for (let i = 0; i < 120; i++) a.advance(1 / 60);
  for (let i = 0; i < 60; i++) b.advance(1 / 30);
  assert.deepEqual(pose(a), pose(b));
  assert.equal(a.atmosphere.time, b.atmosphere.time);
  const before = structuredClone({ pose: pose(a), water: a.water, atmosphere: a.atmosphere });
  a.update({ ...initial, speed: 0 });
  assert.equal(a.advance(0.1), 0);
  assert.deepEqual({ pose: pose(a), water: a.water, atmosphere: a.atmosphere }, before);
});

test('surface toggles reset history without replacing the whale and do not replay old contacts', () => {
  const initial = config(), simulation = createWhaleSimulation(initial, { seed: 42 });
  simulation.resize(800, 600);
  for (let i = 0; i < 12 * 60; i++) simulation.advance(1 / 60);
  const scene = simulation.scene;
  assert.equal(simulation.update({ ...initial, ripples: false }), false);
  assert.equal(simulation.scene, scene);
  assert.equal(simulation.water.ripples.length, 0);
  simulation.advance(1 / 60);
  simulation.update(initial);
  simulation.advance(1 / 60);
  assert.equal(simulation.water.ripples.length, 0);
  simulation.dispose();
  assert.equal(simulation.water.ripples.length, 0);
  assert.equal(simulation.scene, null);
  assert.equal(simulation.advance(1), 0);
  assert.equal(simulation.update(initial), false);
  simulation.resize(800, 600);
  simulation.setObstacles([]);
  simulation.dispose();
});
