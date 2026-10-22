import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeScene, stepScene, whalePose } from './motion.js';

function makeScene(count = 3, width = 1200, height = 800) {
  const scene = { whales: Array.from({ length: count }, (_, id) => ({
    id, depth: [0.14, 0.95, 1.35, 0.48][id % 4], phase: id * 1.37,
  })), particles: [], time: 0, accumulator: 0, width: 0, height: 0 };
  return resizeScene(scene, width, height);
}

function advance(scene, seconds, speed = 1, frame = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / frame); i++) stepScene(scene, frame, speed);
}

function near(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} differs from ${expected}`);
}

test('initial placement separates bodies and sizes foreground and distant whales in pixels', () => {
  const scene = makeScene(3, 1600, 900);
  const [foreground, middle, distant] = scene.whales;
  assert.ok(foreground.length >= 380 && foreground.length <= 520);
  assert.ok(middle.length >= 200 && middle.length <= 350);
  assert.ok(distant.length >= 200 && distant.length <= 350);
  for (let i = 0; i < scene.whales.length; i++) {
    const a = scene.whales[i];
    assert.ok(a.length < 600);
    for (const b of scene.whales.slice(i + 1)) {
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > (a.length + b.length) * 0.55);
      assert.ok(Math.abs(a.heading - b.heading) > 0.5);
    }
  }
  const crowded = makeScene(8, 360, 240);
  assert.ok(crowded.whales.every(whale => whale.length < foreground.length * 0.3));
});

test('a lone whale explores at least three quadrants and a broad area over two minutes', () => {
  const scene = makeScene(1), whale = scene.whales[0], quadrants = new Set();
  let minX = whale.x, maxX = whale.x, minY = whale.y, maxY = whale.y;
  for (let i = 0; i < 120 * 60; i++) {
    stepScene(scene, 1 / 60);
    minX = Math.min(minX, whale.x); maxX = Math.max(maxX, whale.x);
    minY = Math.min(minY, whale.y); maxY = Math.max(maxY, whale.y);
    quadrants.add(`${whale.x >= 600}:${whale.y >= 400}`);
  }
  assert.ok(quadrants.size >= 3, `visited ${quadrants.size} quadrants`);
  assert.ok(maxX - minX > 600, `horizontal span ${maxX - minX}`);
  assert.ok(maxY - minY > 300, `vertical span ${maxY - minY}`);
  assert.ok(whale._motion.targetDue > 100, 'destinations continue changing');
});

test('one through eight whales remain finite and within a padded scene at different sizes and speeds', () => {
  for (const [width, height, speed] of [[1200, 800, 1], [360, 240, 2], [1800, 1000, 0.3]]) {
    for (let count = 1; count <= 8; count++) {
      const scene = makeScene(count, width, height);
      for (let frame = 0; frame < 45 * 60; frame++) {
        stepScene(scene, 1 / 60, speed);
        if (frame % 30) continue;
        for (const whale of scene.whales) {
          const padding = Math.max(24, whale.length * 0.55);
          const context = `${count} whales, ${width}x${height}, speed ${speed}, frame ${frame}`;
          assert.ok([whale.x, whale.y, whale.heading, whale.turn, whale.vx, whale.vy, whale.speed]
            .every(Number.isFinite), context);
          assert.ok(whale.x >= -padding && whale.x <= width + padding, `x ${whale.x}, ${context}`);
          assert.ok(whale.y >= -padding && whale.y <= height + padding, `y ${whale.y}, ${context}`);
        }
      }
    }
  }
});

test('head-on whole-body avoidance turns before an unsteered collision', () => {
  const scene = makeScene(2, 1400, 900), [a, b] = scene.whales;
  Object.assign(a, { x: 450, y: 450, heading: 0, turn: 0, speed: 60, vx: 60, vy: 0 });
  Object.assign(b, { x: 950, y: 450, heading: Math.PI, turn: 0, speed: 60, vx: -60, vy: 0 });
  Object.assign(a._motion, { targetX: 1250, targetY: 450, targetDue: 100 });
  Object.assign(b._motion, { targetX: 150, targetY: 450, targetDue: 100 });
  let closest = Infinity;
  for (let frame = 0; frame < 12 * 60; frame++) {
    stepScene(scene, 1 / 60);
    closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
  }
  const unsteeredDistance = Math.max(0, 500 - (a._motion.cruise + b._motion.cruise) * 12);
  assert.ok(closest > unsteeredDistance + 120, `closest steered approach ${closest}`);
  assert.ok(Math.abs(a.y - b.y) > 80, 'the bodies choose different passing sides');
  assert.ok(Math.abs(a.heading) > 0.15 && Math.abs(b.heading - Math.PI) > 0.15);
});

test('a resize preserves objects, fractional positions, heading, route state and time', () => {
  const scene = makeScene();
  advance(scene, 7);
  stepScene(scene, 1 / 120);
  const whale = scene.whales[0], state = whale._motion;
  const before = { x: whale.x / scene.width, y: whale.y / scene.height,
    targetX: state.targetX / scene.width, targetY: state.targetY / scene.height,
    heading: whale.heading, time: scene.time, accumulator: scene.accumulator,
    age: state.age, seed: state.seed, length: whale.length };
  resizeScene(scene, 900, 500);
  assert.equal(scene.whales[0], whale);
  assert.equal(whale._motion, state);
  near(whale.x / 900, before.x); near(whale.y / 500, before.y);
  near(state.targetX / 900, before.targetX); near(state.targetY / 500, before.targetY);
  assert.equal(whale.heading, before.heading);
  assert.equal(scene.time, before.time);
  assert.equal(scene.accumulator, before.accumulator);
  assert.equal(state.age, before.age); assert.equal(state.seed, before.seed);
  assert.ok(whale.length < before.length);
});

test('default-size initialization immediately adopts a small canvas swimming pace', () => {
  for (let count = 1; count <= 8; count++) {
    const scene = makeScene(count, 1600, 900);
    const before = scene.whales.map(whale => ({ speed: whale.speed, heading: whale.heading }));
    resizeScene(scene, 360, 240);
    for (let i = 0; i < count; i++) {
      near(scene.whales[i].speed, before[i].speed * 240 / 650);
      assert.equal(scene.whales[i].heading, before[i].heading);
    }
    for (let frame = 0; frame < 20 * 60; frame++) {
      stepScene(scene, 1 / 60, 2);
      if (frame % 60) continue;
      for (const whale of scene.whales) {
        const padding = Math.max(24, whale.length * 0.55);
        assert.ok(whale.x >= -padding && whale.x <= 360 + padding);
        assert.ok(whale.y >= -padding && whale.y <= 240 + padding);
      }
    }
  }
});

test('zero, negative and nonfinite frame times and a stopped speed are safe no-ops', () => {
  const scene = makeScene(), before = structuredClone(scene);
  for (const dt of [0, -1, NaN, Infinity]) stepScene(scene, dt);
  stepScene(scene, 1 / 60, 0);
  assert.deepEqual(scene, before);
});

test('frame subdivision produces exactly the same fixed-step state', () => {
  const scenes = [makeScene(5), makeScene(5), makeScene(5)];
  advance(scenes[0], 18, 1, 1 / 60);
  advance(scenes[1], 18, 1, 1 / 30);
  advance(scenes[2], 18, 1, 1 / 120);
  for (const scene of scenes.slice(1)) {
    assert.equal(scene.time, scenes[0].time);
    near(scene.accumulator, scenes[0].accumulator);
    assert.deepEqual(scene.whales, scenes[0].whales);
  }
});

test('long incoming frames are capped instead of advancing through a suspension', () => {
  const capped = makeScene(), ordinary = makeScene();
  stepScene(capped, 10);
  stepScene(ordinary, 0.25);
  assert.deepEqual(capped, ordinary);
  near(capped.time, 0.25);
});

test('turning and boundary recovery are continuous without wrapping or positional clamps', () => {
  const scene = makeScene(1), whale = scene.whales[0];
  Object.assign(whale, { x: scene.width - 8, y: 400, heading: 0, turn: 0,
    speed: 60, vx: 60, vy: 0 });
  let maximumTurn = 0;
  for (let frame = 0; frame < 24 * 60; frame++) {
    const { x, y, heading } = whale;
    stepScene(scene, 1 / 60);
    const turn = Math.abs(whale.heading - heading);
    maximumTurn = Math.max(maximumTurn, turn);
    assert.ok(turn <= 1.1 / 60 + 1e-10);
    assert.ok(Math.hypot(whale.x - x, whale.y - y) <= 75 / 60 + 1e-10);
    near(whale.x - x, whale.vx / 60);
    near(whale.y - y, whale.vy / 60);
  }
  assert.ok(maximumTurn > 0.002);
  assert.ok(whale.x < scene.width - 80, 'an outward-facing whale swims back into the scene');
});

test('pose reuses output and projects the state with a realistic silhouette length', () => {
  const scene = makeScene(3, 1600, 900), out = {};
  for (const whale of scene.whales) {
    const pose = whalePose(whale, 300, scene.width, scene.height, 1, out);
    assert.equal(pose, out);
    for (const key of ['x', 'y', 'scale', 'focal', 'cameraZ', 'near', 'yaw', 'pitch', 'roll',
      'heading', 'length', 'wave', 'cy', 'sy', 'cp', 'sp', 'cr', 'sr', 'turn']) {
      assert.ok(Number.isFinite(pose[key]), key);
    }
    assert.equal(pose.x, whale.x); assert.equal(pose.y, whale.y);
    assert.equal(pose.heading, whale.heading);
    const projectAxis = x => {
      const rx = pose.cy * x, ry = pose.sp * pose.sy * x;
      const z = -pose.cp * pose.sy * x * pose.scale;
      const perspective = pose.focal / (pose.focal + pose.cameraZ + z);
      return [(pose.cr * rx - pose.sr * ry) * pose.scale * perspective,
        (pose.sr * rx + pose.cr * ry) * pose.scale * perspective];
    };
    const tail = projectAxis(-1.2), head = projectAxis(1.04);
    const actualLength = Math.hypot(head[0] - tail[0], head[1] - tail[1]);
    assert.ok(Math.abs(actualLength / pose.length - 1) < 0.08, `${actualLength} vs ${pose.length}`);
    const later = whalePose(whale, 1e6, scene.width, scene.height, 2);
    assert.equal(later.x, pose.x); assert.equal(later.y, pose.y);
    assert.equal(later.heading, pose.heading);
  }
});
