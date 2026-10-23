import test from 'node:test';
import assert from 'node:assert/strict';
import { divePose, resizeScene, stepScene, whalePose } from '../src/motion.js';
import { projectParticle } from '../src/model.js';
import { deformWhaleParticle } from '../src/rig.js';

const level = { submergence: 0, pitch: 0, noseFirst: false, depth: 0, tailKick: 0, arch: 0 };

function makeScene(count = 3, width = 1200, height = 800) {
  const scene = { whales: Array.from({ length: count }, (_, id) => ({
    id, depth: [0.14, 0.95, 1.35, 0.48][id % 4], phase: id * 1.37,
  })), particles: [], time: 0, accumulator: 0, width: 0, height: 0 };
  return resizeScene(scene, width, height);
}

function advance(scene, seconds, speed = 1, frame = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / frame); i++) stepScene(scene, frame, speed);
}

const overhead = {
  x: 800, y: 450, scale: 220, focal: 900, cameraZ: 400, near: 108,
  cy: 1, sy: 0, cp: 0, sp: 1, cr: 1, sr: 0, wave: 0, stroke: 0, turn: 0,
};

function back(x, y = -0.12) {
  return { x, y, z: 0, nx: 0, ny: -1, nz: 0, seed: 0.4, material: 'skin', part: 'body' };
}

const timing = { entry: 2.4, under: 6, exit: 2.8 };

test('a pure dive action starts level, finishes level and never repeats', () => {
  for (const elapsed of [-1, 0, 11.2, 24.4, 60, NaN, Infinity]) {
    assert.deepEqual(divePose(elapsed, timing), level);
  }
  for (const invalid of [undefined, {}, { ...timing, entry: 0 }, { ...timing, under: NaN },
    { ...timing, exit: Infinity }, { ...timing, under: -1 }]) {
    assert.deepEqual(divePose(1, invalid), level);
  }
  const started = divePose(0.05, timing);
  assert.ok(started.submergence > 0);
  assert.ok(started.pitch > 0);
  assert.equal(started.noseFirst, false);
});

test('entry, underwater leveling and nose-first exit ease with flat endpoints', () => {
  const before = divePose(0.6, timing), mid = divePose(1.2, timing);
  assert.ok(mid.submergence > before.submergence && mid.submergence < 1);
  assert.ok(mid.pitch >= 0.5 && mid.pitch < 0.72);
  assert.equal(mid.noseFirst, false);
  assert.equal(divePose(5, timing).submergence, 1);
  assert.ok(divePose(5, timing).pitch < 0.72);
  const earlyExit = divePose(8.8, timing);
  assert.equal(earlyExit.noseFirst, true);
  assert.ok(earlyExit.submergence < 1 && earlyExit.submergence > 0.2);
  assert.ok(earlyExit.pitch < 0);
  const endpoints = [0, timing.entry, timing.entry + timing.under,
    timing.entry + timing.under + timing.exit * 0.65, 11.2];
  for (const at of endpoints) {
    const a = divePose(at - 0.001, timing), b = divePose(at, timing), c = divePose(at + 0.001, timing);
    const keys = at === timing.entry + timing.under + timing.exit * 0.65
      ? ['submergence'] : ['submergence', 'pitch', 'depth', 'tailKick', 'arch'];
    for (const key of keys) {
      assert.ok(Math.abs(a[key] - b[key]) < 1e-5, `${key} jumps into ${at}`);
      assert.ok(Math.abs(c[key] - b[key]) < 1e-5, `${key} jumps out of ${at}`);
    }
  }
  const nearEnd = divePose(11.19, timing);
  assert.ok(nearEnd.submergence > 0 && nearEnd.submergence < 0.001);
  assert.ok(Math.abs(nearEnd.pitch) < 0.001);
});

test('action timing is a snapshot and changes only the duration of that action', () => {
  const slower = { entry: 4, under: 7, exit: 4 };
  assert.equal(divePose(3, timing).submergence, 1);
  assert.ok(divePose(3, slower).submergence < 1);
  assert.equal(divePose(9, slower).submergence, 1);
  assert.equal(divePose(9, timing).noseFirst, true);
  assert.deepEqual(divePose(16, slower), level);
});

test('dive pitch rotates about the origin and a zero angle stays bit-identical', () => {
  const body = { x: 1, y: 0, z: 0.2, nx: 1, ny: 0, nz: 0, part: 'body' };
  const flat = deformWhaleParticle(body, { wave: 0, stroke: 0, turn: 0 }, {});
  const same = deformWhaleParticle(body, { wave: 0, stroke: 0, turn: 0, divePitch: 0 }, {});
  assert.deepEqual(same, flat);
  const pitched = deformWhaleParticle(body, { wave: 0, stroke: 0, turn: 0, divePitch: 0.22 }, {});
  assert.ok(pitched.y > flat.y);
  assert.equal(pitched.z, flat.z);
  assert.equal(pitched.nz, flat.nz);
  const tail = deformWhaleParticle({ ...body, x: -1, nx: -1 }, { wave: 0, stroke: 0, turn: 0, divePitch: 0.22 }, {});
  assert.ok(tail.y < 0);
});

test('submergence fades a back-facing body from the nose and leaves a surfaced particle alone', () => {
  const particle = back(0.2);
  const omitted = projectParticle(particle, overhead);
  const surfaced = projectParticle(particle, { ...overhead, submergence: 0 });
  assert.equal(omitted.visibility, surfaced.visibility);
  assert.ok(omitted.visibility > 0);
  assert.equal(projectParticle(particle, { ...overhead, submergence: 1 }).visibility, 0);
  assert.equal(projectParticle({ ...particle, ny: 1 }, overhead).visibility, 0);
  assert.equal(projectParticle({ ...particle, ny: 1 }, { ...overhead, submergence: 0.4 }).visibility, 0);
  assert.equal(projectParticle(back(0.2, -8), overhead).visibility, 0);
  const diving = { ...overhead, submergence: 0.5, noseFirst: false };
  const nose = projectParticle(back(1), diving);
  const tail = projectParticle(back(-1), diving);
  assert.ok(nose.visibility < tail.visibility);
  const emerging = { ...overhead, submergence: 0.5, noseFirst: true };
  assert.ok(projectParticle(back(1), emerging).visibility > projectParticle(back(-1), emerging).visibility,
    'the nose appears while the tail remains underwater');
});

test('a dive keeps integrating the sea plane and does not reseed the school', () => {
  const scene = makeScene(4);
  const twin = makeScene(4);
  const seeds = scene.whales.map(whale => whale._motion.seed);
  advance(scene, 4, 1);
  advance(twin, 4, 1);
  for (let i = 0; i < scene.whales.length; i++) {
    assert.equal(scene.whales[i]._motion.submergence, 0);
    assert.equal(scene.whales[i]._motion.pitch, 0);
    assert.equal(scene.whales[i]._motion.noseFirst, false);
    assert.equal(scene.whales[i]._motion.seed, twin.whales[i]._motion.seed);
    assert.notEqual(scene.whales[i]._motion.seed, seeds[i]);
  }
  const diving = makeScene(1);
  const whale = diving.whales[0];
  whale._motion.age = 30;
  const x = whale.x, y = whale.y;
  assert.doesNotThrow(() => stepScene(diving, 1 / 60, 1));
  assert.ok(Math.abs((whale.x - x) - whale.vx / 60) <= 1e-9, `${whale.x - x} vs ${whale.vx / 60}`);
  assert.ok(Math.abs((whale.y - y) - whale.vy / 60) <= 1e-9, `${whale.y - y} vs ${whale.vy / 60}`);
  assert.ok(Number.isFinite(whale._motion.submergence));
  assert.ok(whale._motion.submergence >= 0 && whale._motion.submergence <= 1);
  assert.ok(Number.isFinite(whale.speed));
  const pose = whalePose(whale, diving.time, diving.width, diving.height, 1);
  assert.equal(pose.pitch, Math.PI / 2);
  assert.equal(pose.submergence, whale._motion.submergence);
  assert.equal(pose.divePitch, whale._motion.pitch);
  assert.equal(pose.noseFirst, whale._motion.noseFirst);
  const bare = whalePose({ x: 10, y: 20, heading: 0.2, phase: 0, depth: 0.4, length: 300 }, 0, 800, 600, 1);
  assert.equal(bare.submergence, 0);
  assert.equal(bare.divePitch, 0);
  assert.equal(bare.noseFirst, false);
  assert.equal(bare.pitch, Math.PI / 2);
  const adopted = makeScene(1);
  delete adopted.whales[0]._motion.submergence;
  delete adopted.whales[0]._motion.pitch;
  delete adopted.whales[0]._motion.noseFirst;
  const filled = whalePose(adopted.whales[0], 0, adopted.width, adopted.height, 1);
  assert.equal(filled.submergence, 0);
  assert.equal(filled.divePitch, 0);
  assert.equal(filled.noseFirst, false);
  assert.equal(adopted.whales[0]._motion.submergence, 0);
  assert.equal(adopted.whales[0]._motion.pitch, 0);
  assert.equal(adopted.whales[0]._motion.noseFirst, false);
});
