import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, projectParticle } from '../src/model.js';
import { adoptSceneState, resizeScene, setSceneObstacles, stepScene, whalePose } from '../src/motion.js';
import { resetWhaleRig } from '../src/rig.js';

const dt = 1 / 60;
function fixture(count = 1, turn = 0.24) {
  const scene = createScene(count, '鲸', 'humpback', 0.55);
  resizeScene(scene, 2400, 1800);
  stepScene(scene, dt);
  for (const [id, whale] of scene.whales.entries()) {
    Object.assign(whale, { x: 1000 + id * 500, y: 900, heading: 0, turn });
    Object.assign(whale._motion, { targetX: whale.x, targetY: 1500, targetDue: 1e6,
      wander: 0, wanderGoal: 0, wanderDue: 1e6 });
    Object.assign(whale._motion.dive, { startedAt: whale._motion.age, entry: 3, under: 2, exit: 3,
      nextDecision: 1e6, contactStage: 0 });
    resetWhaleRig(whale);
  }
  return scene;
}
function advance(scene, seconds, frame = dt, speed = 1) {
  for (let i = 0; i < Math.round(seconds / frame); i++) stepScene(scene, frame, speed);
}

function checkProjectedClear(scene, obstacles, frame) {
  const poses = scene.whales.map(whale => whalePose(whale, scene.time, scene.width, scene.height, 1));
  const out = {};
  for (const particle of scene.particles) {
    projectParticle(particle, poses[particle.whale], out);
    if (out.visibility < 0.05) continue;
    for (const obstacle of obstacles) {
      if (obstacle.radius) {
        assert.ok(Math.hypot(out.x - obstacle.x, out.y - obstacle.y) >= obstacle.radius,
          `frame ${frame}: visible ${particle.part} entered reef`);
      } else {
        assert.ok(!(out.x > obstacle.x && out.x < obstacle.x + obstacle.width
          && out.y > obstacle.y && out.y < obstacle.y + obstacle.height),
        `frame ${frame}: visible ${particle.part} entered composer`);
      }
    }
  }
}

test('entry brakes residual turn continuously while velocity, head and rendering use the real bearing', () => {
  const scene = fixture(), whale = scene.whales[0], before = whale.turn;
  stepScene(scene, dt);
  assert.ok(whale.turn > 0 && whale.turn < before * 0.9, 'turn decays without snapping to zero');
  for (let frame = 0; frame < 3 * 60 - 1; frame++) {
    const x = whale.x, y = whale.y, heading = whale.heading;
    stepScene(scene, dt);
    assert.ok(Math.abs(whale.x - x - whale.vx * dt) < 1e-9);
    assert.ok(Math.abs(whale.y - y - whale.vy * dt) < 1e-9);
    assert.ok(Math.abs(whale.heading - heading) <= whale._motion.agility * dt + 1e-9);
    assert.ok(whale.speed > 1, 'translation continues');
    const pose = whalePose(whale, scene.time, scene.width, scene.height, 1);
    assert.equal(pose.heading, whale.heading);
    assert.equal(pose.roll, whale.heading);
    assert.ok(Math.abs(whale.rig.nodes[0] - whale.x - Math.cos(whale.heading) * whale.length * 1.04 / 2.24) < 1e-9);
    assert.ok(Math.abs(whale.rig.nodes[1] - whale.y - Math.sin(whale.heading) * whale.length * 1.04 / 2.24) < 1e-9);
  }
});

test('a routine target cannot rotate an entry but a nearby reef or composer still steers safely', () => {
  for (const obstacle of [
    { x: 1240, y: 900, radius: 44 },
    { x: 1210, y: 800, width: 180, height: 200 },
  ]) {
    const scene = fixture(1, 0), whale = scene.whales[0];
    Object.assign(whale._motion, { targetX: 2000, targetY: 900 });
    setSceneObstacles(scene, [obstacle]);
    const start = whale.heading;
    let maxTurn = 0;
    for (let frame = 0; frame < 8 * 60; frame++) {
      stepScene(scene, dt);
      if (frame < 3 * 60) maxTurn = Math.max(maxTurn, Math.abs(whale.heading - start));
      if (frame % 6 === 0) checkProjectedClear(scene, [obstacle], frame);
    }
    assert.ok(maxTurn > 0.02, 'collision avoidance can override the decorative bearing hold');
  }
});

test('neighbor avoidance remains active while two whales are diving head-on', () => {
  const scene = fixture(2, 0), [a, b] = scene.whales;
  Object.assign(a, { x: 900, y: 900, heading: 0, turn: 0, speed: 50, vx: 50, vy: 0 });
  Object.assign(b, { x: 1400, y: 900, heading: Math.PI, turn: 0, speed: 50, vx: -50, vy: 0 });
  Object.assign(a._motion, { targetX: 2000, targetY: 900 });
  Object.assign(b._motion, { targetX: 300, targetY: 900 });
  resetWhaleRig(a); resetWhaleRig(b);
  let closest = Infinity, largestTurn = 0;
  for (let frame = 0; frame < 3 * 60; frame++) {
    stepScene(scene, dt);
    closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    largestTurn = Math.max(largestTurn, Math.abs(a.heading), Math.abs(b.heading - Math.PI));
  }
  assert.ok(largestTurn > 0.02, 'an imminent neighbor can still turn the held course');
  assert.ok(closest > a.bodyRadius + b.bodyRadius, 'the bodies retain space');
});

test('the hold pauses and remains deterministic across frame subdivision and adoption', () => {
  const normal = fixture(), split = fixture();
  advance(normal, 6, dt);
  advance(split, 6, dt / 2);
  assert.deepEqual(normal.whales, split.whales);
  const paused = structuredClone(normal);
  advance(normal, 1, dt, 0);
  assert.deepEqual(normal, paused);
  const next = createScene(1, '鲸', 'humpback', 0.55);
  resizeScene(next, normal.width, normal.height);
  adoptSceneState(normal, next);
  advance(normal, 2.5);
  advance(next, 2.5);
  assert.deepEqual(next.whales, normal.whales);
});
