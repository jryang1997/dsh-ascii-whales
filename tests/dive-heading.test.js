import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, resizeScene, stepScene, whalePose, projectParticle } from '../src/model.js';
import { resetWhaleRig } from '../src/rig.js';

const dt = 1 / 60;
const deg = radians => radians * 180 / Math.PI;
function fixture(turn = 0) {
  const scene = createScene(1, '鲸', 'humpback', 0.55);
  resizeScene(scene, 2400, 1800);
  stepScene(scene, dt, 1);
  const w = scene.whales[0], state = w._motion;
  Object.assign(w, { x: 1200, y: 900, heading: 0, turn });
  Object.assign(state, { targetX: 1200, targetY: 1450, targetDue: 1e6,
    wander: 0, wanderGoal: 0, wanderDue: 1e6 });
  resetWhaleRig(w);
  Object.assign(state.dive, { startedAt: state.age, entry: 3, under: 2, exit: 3,
    nextDecision: 1e6, contactStage: 0 });
  return { scene, w, state };
}
function sample(scene, w, seconds) {
  const start = { x: w.x, y: w.y, heading: w.heading };
  let drift = 0;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    stepScene(scene, dt, 1);
    drift = Math.max(drift, Math.abs(w.heading - start.heading));
  }
  return { degrees: deg(drift), travel: Math.hypot(w.x - start.x, w.y - start.y) };
}

test('visible entry and exit keep their bearing while a cruise target asks for a turn', () => {
  const { scene, w } = fixture();
  const entry = sample(scene, w, 3);
  const under = sample(scene, w, 2);
  const exit = sample(scene, w, 3);
  assert.ok(entry.degrees < 2, `entry rotated ${entry.degrees.toFixed(3)} degrees`);
  assert.ok(exit.degrees < 1, `exit rotated ${exit.degrees.toFixed(3)} degrees`);
  assert.ok(under.degrees > 5, 'the hidden whale may still find a new course');
  for (const stage of [entry, under, exit]) assert.ok(stage.travel > 1, 'translation must continue');
});

test('a whale already turning settles for entry and regains steering after surfacing', () => {
  const { scene, w, state } = fixture(0.24);
  const entry = sample(scene, w, 3);
  assert.ok(entry.degrees < 2, `residual turn spun the dive by ${entry.degrees.toFixed(3)} degrees`);
  sample(scene, w, 5);
  state.targetX = w.x - 600;
  state.targetY = w.y;
  const cruise = sample(scene, w, 3);
  assert.ok(cruise.degrees > 5, 'the action must release its bearing after surfacing');
});

test('pitching a curved historical spine does not rotate its projected course', () => {
  const scene = createScene(1, '鲸', 'humpback', 0.8), w = scene.whales[0];
  Object.assign(w, { x: 800, y: 450, heading: 0, turn: 0 });
  Object.assign(w._motion, { wave: 0, stroke: 0, depth: 0, tailKick: 0, arch: 0 });
  resetWhaleRig(w);
  const nodes = w.rig.nodes, segment = w.length / (nodes.length / 2 - 1);
  for (let i = 1; i < nodes.length / 2; i++) {
    const angle = 0.5 * i / (nodes.length / 2 - 1);
    nodes[i * 2] = nodes[i * 2 - 2] - Math.cos(angle) * segment;
    nodes[i * 2 + 1] = nodes[i * 2 - 1] - Math.sin(angle) * segment;
  }
  const probe = x => ({ x, y: -0.08, z: 0, nx: 0, ny: -1, nz: 0,
    seed: 0.5, part: 'body' });
  const projectedCourse = pitch => {
    Object.assign(w._motion, { pitch, submergence: pitch ? 0.7 : 0 });
    const pose = whalePose(w, 0, 1600, 900, 1);
    const head = projectParticle(probe(0.9), pose), tail = projectParticle(probe(-0.9), pose);
    return deg(Math.atan2(head.y - tail.y, head.x - tail.x));
  };
  const original = projectedCourse(0);
  for (const pitch of [0.36, 0.72, -0.5]) {
    const drift = Math.abs(projectedCourse(pitch) - original);
    assert.ok(drift < 1, `pitch ${pitch} made the curved body yaw ${drift.toFixed(3)} degrees`);
  }
});
