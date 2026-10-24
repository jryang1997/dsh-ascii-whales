import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, projectParticle } from '../src/model.js';
import { adoptSceneState, resizeScene, setSceneObstacles, stepScene, whalePose } from '../src/motion.js';
import { resetWhaleRig } from '../src/rig.js';
import { SPECIES_IDS } from '../src/species.js';
import { createWhaleSimulation } from '../src/simulation.js';

const dt = 1 / 60;
const poseKeys = ['submergence', 'pitch', 'depth', 'tailKick', 'arch'];

function fixture(kind, species = 'blue', count = 1) {
  const scene = createScene(count, '鲸', species, 0.55);
  scene.diveSeed = 0x5eed1234;
  resizeScene(scene, 2400, 1800);
  stepScene(scene, dt);
  for (const [id, whale] of scene.whales.entries()) {
    if (kind) whale.activity = { key: `task-${id}`, kind, label: '任务', type: 'task' };
    Object.assign(whale, { x: 900 + id * 500, y: 900, heading: 0, turn: 0 });
    Object.assign(whale._motion, { targetX: 2200, targetY: 900, targetDue: Infinity,
      wander: 0, wanderGoal: 0, wanderDue: Infinity });
    whale._motion.dive.nextDecision = Infinity;
    resetWhaleRig(whale);
  }
  return scene;
}

function advance(scene, seconds, frame = dt, speed = 1) {
  for (let i = 0; i < Math.round(seconds / frame); i++) stepScene(scene, frame, speed);
}

function startDive(scene, elapsed = 0) {
  const state = scene.whales[0]._motion;
  Object.assign(state.dive, { startedAt: state.age, entry: 3, under: 4, exit: 3,
    nextDecision: Infinity, contactStage: 0 });
  advance(scene, elapsed);
}

function projectedSamples(scene) {
  const pose = whalePose(scene.whales[0], scene.time, scene.width, scene.height, 1);
  return scene.particles.filter((_, i) => i % 31 === 0).map(particle => projectParticle(particle, pose));
}

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);
}

test('absent, unknown, completed and failed activities preserve decorative swimming and random dives', () => {
  const scenes = [undefined, 'unknown', 'completed', 'failed'].map(kind => fixture(kind));
  for (const scene of scenes) {
    scene.whales[0]._motion.dive.nextDecision = scene.whales[0]._motion.age + 1;
    scene.whales[0]._motion.dive.activity = 1;
    advance(scene, 30);
  }
  assert.ok(scenes[0].whales[0]._motion.dive.dives > 0);
  for (const scene of scenes.slice(1)) {
    const whale = structuredClone(scene.whales[0]);
    delete whale.activity;
    assert.deepEqual(whale, scenes[0].whales[0]);
    assert.equal(scene.time, scenes[0].time);
  }
});

test('activity changes retarget speed and strokes smoothly without replacing the physical controller', () => {
  const scenes = [undefined, 'running', 'idle', 'waiting'].map(kind => fixture(kind));
  const base = scenes[0].whales[0].speed;
  for (const scene of scenes) {
    const whale = scene.whales[0], state = whale._motion, rig = whale.rig;
    const x = whale.x, y = whale.y;
    stepScene(scene, dt);
    assert.equal(whale._motion, state);
    assert.equal(whale.rig, rig);
    assert.ok(Math.abs(whale.speed - base) < base * 0.02, 'no instantaneous speed change');
    near(whale.x - x, whale.vx * dt);
    near(whale.y - y, whale.vy * dt);
    advance(scene, 5);
  }
  const [decorative, running, idle, waiting] = scenes.map(scene => scene.whales[0]);
  assert.ok(running.speed > decorative.speed * 1.3, 'running swims more strongly');
  assert.ok(idle.speed > decorative.speed * 0.6 && idle.speed < decorative.speed * 0.7);
  assert.ok(waiting.speed > decorative.speed * 0.3 && waiting.speed < decorative.speed * 0.4);
  assert.ok(running._motion.stroke > idle._motion.stroke);
  assert.ok(idle._motion.stroke > waiting._motion.stroke);
  for (const scene of scenes.slice(1)) {
    assert.equal(scene.time, scenes[0].time);
    assert.equal(scene.whales[0]._motion.age, decorative._motion.age);
  }
  running.activity.kind = 'waiting';
  const speed = running.speed;
  stepScene(scenes[1], dt);
  assert.ok(running.speed < speed && running.speed > speed * 0.98, 'an interruption retargets current velocity');
});

test('waiting stays on the surface and releasing an overdue dive begins at its entry', () => {
  const scene = fixture('waiting'), whale = scene.whales[0], dive = whale._motion.dive;
  dive.activity = 1;
  dive.nextDecision = whale._motion.age;
  const startX = whale.x;
  advance(scene, 60);
  assert.equal(dive.dives, 0);
  assert.equal(dive.decisions, 0);
  assert.equal(whale._motion.submergence, 0);
  assert.ok(whale.x > startX + 100, 'waiting still glides');
  whale.activity.kind = 'running';
  stepScene(scene, dt);
  assert.equal(dive.dives, 1);
  assert.ok(whale._motion.age - dive.startedAt <= dt + 1e-9, 'the missed opportunity is not backdated');
  assert.ok(whale._motion.submergence < 0.001, 'no jump to an underwater pose');
});

test('waiting continuously returns every species from entry, underwater and exit poses', () => {
  for (const species of SPECIES_IDS) for (const elapsed of [0.9, 2.4, 4.5, 7.75, 9.7]) {
    const scene = fixture(undefined, species), whale = scene.whales[0], state = whale._motion;
    startDive(scene, elapsed);
    const before = Object.fromEntries(poseKeys.map(key => [key, state[key]]));
    const samples = projectedSamples(scene), noseFirst = state.noseFirst;
    const rig = whale.rig, motion = whale._motion, dive = state.dive, starts = dive.dives;
    whale.activity = { kind: 'waiting' };
    stepScene(scene, dt);
    for (const key of poseKeys) near(state[key], before[key], 0.001);
    assert.equal(state.noseFirst, noseFirst, 'the visibility direction does not flip');
    const after = projectedSamples(scene);
    for (let i = 0; i < samples.length; i++) {
      assert.ok(Math.hypot(samples[i].x - after[i].x, samples[i].y - after[i].y) < 3,
        `${species} at ${elapsed}: projected body jumped`);
      assert.ok(Math.abs(samples[i].visibility - after[i].visibility) < 0.05,
        `${species} at ${elapsed}: visibility jumped`);
    }
    for (let frame = 0; frame < 4 * 60; frame++) {
      const previous = state.submergence, x = whale.x, y = whale.y, heading = whale.heading;
      stepScene(scene, dt);
      assert.ok(state.submergence <= previous + 1e-12, 'waiting never descends again');
      assert.ok(previous - state.submergence < 0.02, 'surfacing has no abrupt pose step');
      near(whale.x - x, whale.vx * dt);
      near(whale.y - y, whale.vy * dt);
      assert.ok(Math.abs(whale.heading - heading) <= state.agility * dt + 1e-9);
    }
    assert.equal(whale._motion, motion);
    assert.equal(whale.rig, rig);
    assert.equal(state.dive, dive);
    assert.equal(dive.startedAt, null);
    assert.equal(dive.dives, starts);
    for (const key of poseKeys) assert.equal(state[key], 0, key);
    assert.equal(state.noseFirst, false);
  }
});

test('a waiting return keeps its pose through further status changes and scene adoption', () => {
  const scene = fixture();
  startDive(scene, 4.5);
  const whale = scene.whales[0];
  whale.activity = { key: 'task', kind: 'waiting' };
  advance(scene, 0.5);
  const returnStartedAt = whale._motion.dive.returnStartedAt;
  whale.activity.kind = 'running';
  const next = fixture('running');
  assert.equal(adoptSceneState(scene, next), 1);
  assert.notEqual(next.whales[0]._motion.dive, whale._motion.dive);
  const snapshot = structuredClone(whale._motion);
  advance(next, 0.5);
  assert.deepEqual(whale._motion, snapshot, 'adopted recovery does not mutate the old scene');
  advance(scene, 0.5);
  assert.deepEqual(next.whales[0]._motion, whale._motion);
  assert.equal(whale._motion.dive.returnStartedAt, returnStartedAt, 'recovery is not restarted by running');
  advance(scene, 3);
  assert.equal(whale._motion.submergence, 0);
  whale._motion.dive.activity = 1;
  whale._motion.dive.nextDecision = whale._motion.age;
  stepScene(scene, dt);
  assert.notEqual(whale._motion.dive.startedAt, null, 'ordinary random dives resume after recovery');
});

test('waiting recovery emits a single actual surface contact and no new tail drive', () => {
  const scene = fixture();
  startDive(scene, 4.5);
  const whale = scene.whales[0], dive = whale._motion.dive;
  const serial = dive.splashSerial;
  whale.activity = { kind: 'waiting' };
  advance(scene, 4);
  assert.equal(dive.splashSerial, serial + 1);
  assert.equal(dive.splashKind, 'surface');
  advance(scene, 4);
  assert.equal(dive.splashSerial, serial + 1, 'the contact is not replayed');
  const early = fixture();
  startDive(early, 0.05);
  const earlyDive = early.whales[0]._motion.dive, earlySerial = earlyDive.splashSerial;
  early.whales[0].activity = { kind: 'waiting' };
  advance(early, 4);
  assert.equal(earlyDive.splashSerial, earlySerial, 'an already exposed nose does not create a surface impact');
});

test('activity, recovery and global clocks retain fixed-step and zero-speed contracts', () => {
  const normal = fixture('running'), split = fixture('running');
  for (const scene of [normal, split]) {
    startDive(scene, 2.4);
    scene.whales[0].activity.kind = 'waiting';
  }
  advance(normal, 1, dt);
  advance(split, 1, dt / 2);
  assert.deepEqual(normal, split);
  const paused = structuredClone(normal);
  advance(normal, 5, dt, 0);
  assert.deepEqual(normal, paused);
  const pose = whalePose(normal.whales[0], 1e6, normal.width, normal.height, 1);
  assert.equal(pose.submergence, paused.whales[0]._motion.submergence, 'projection alone never advances recovery');
  const changed = fixture(), control = fixture();
  changed.whales[0].activity = { kind: 'waiting' };
  advance(changed, 2, dt, 0.3);
  advance(control, 2, dt, 0.3);
  assert.equal(changed.time, control.time);
  assert.equal(changed.whales[0]._motion.age, control.whales[0]._motion.age);
});

test('activity leaves the shared water and atmosphere clocks advancing at their original pace', () => {
  const config = { count: 1, text: '鲸', species: 'blue', whaleSize: 0.55, speed: 1, ripples: true };
  const simulations = [createWhaleSimulation(config), createWhaleSimulation(config)];
  for (const simulation of simulations) {
    simulation.resize(1600, 900);
    simulation.water.ripples.push({ x: 100, y: 100, age: 0, life: 10 });
  }
  simulations[1].scene.whales[0].activity = { kind: 'waiting' };
  for (let frame = 0; frame < 2 * 60; frame++) {
    const elapsed = simulations.map(simulation => simulation.advance(dt));
    assert.equal(elapsed[0], elapsed[1]);
  }
  assert.equal(simulations[0].scene.time, simulations[1].scene.time);
  near(simulations[0].water.ripples[0].age, 2);
  assert.equal(simulations[0].water.ripples[0].age, simulations[1].water.ripples[0].age);
  assert.deepEqual(simulations[0].atmosphere, simulations[1].atmosphere);
  for (const simulation of simulations) simulation.dispose();
});

test('running and waiting whales keep reef and composer avoidance active while returning', () => {
  for (const kind of ['running', 'waiting']) for (const obstacle of [
    { x: 1240, y: 900, radius: 44 },
    { x: 1210, y: 800, width: 180, height: 200 },
  ]) {
    const scene = fixture(undefined, 'humpback'), whale = scene.whales[0];
    startDive(scene, 1);
    whale.activity = { kind };
    setSceneObstacles(scene, [obstacle]);
    const start = whale.heading;
    let maxTurn = 0;
    for (let frame = 0; frame < 8 * 60; frame++) {
      stepScene(scene, dt);
      maxTurn = Math.max(maxTurn, Math.abs(whale.heading - start));
      if (frame % 12) continue;
      const pose = whalePose(whale, scene.time, scene.width, scene.height, 1);
      for (const particle of scene.particles) {
        const out = projectParticle(particle, pose);
        if (out.visibility < 0.05) continue;
        if (obstacle.radius) assert.ok(Math.hypot(out.x - obstacle.x, out.y - obstacle.y) >= obstacle.radius);
        else assert.ok(!(out.x > obstacle.x && out.x < obstacle.x + obstacle.width
          && out.y > obstacle.y && out.y < obstacle.y + obstacle.height));
      }
    }
    assert.ok(maxTurn > 0.02, `${kind}: avoidance can override the dive bearing hold`);
  }
});

test('a running whale and a returning waiting whale retain reciprocal neighbor avoidance', () => {
  const scene = fixture(undefined, 'humpback', 2), [a, b] = scene.whales;
  Object.assign(a, { x: 900, y: 900, heading: 0, turn: 0, speed: 50, vx: 50, vy: 0 });
  Object.assign(b, { x: 1400, y: 900, heading: Math.PI, turn: 0, speed: 50, vx: -50, vy: 0 });
  Object.assign(a._motion, { targetX: 2200, targetY: 900 });
  Object.assign(b._motion, { targetX: 300, targetY: 900 });
  a.activity = { kind: 'running' };
  b.activity = { kind: 'waiting' };
  for (const whale of [a, b]) {
    Object.assign(whale._motion.dive, { startedAt: whale._motion.age, entry: 3, under: 4, exit: 3 });
    resetWhaleRig(whale);
  }
  let closest = Infinity, maxTurn = 0;
  for (let frame = 0; frame < 8 * 60; frame++) {
    stepScene(scene, dt);
    closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    maxTurn = Math.max(maxTurn, Math.abs(a.heading), Math.abs(b.heading - Math.PI));
  }
  assert.ok(maxTurn > 0.02);
  assert.ok(closest > a.bodyRadius + b.bodyRadius);
});
