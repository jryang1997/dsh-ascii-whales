import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene } from './model.js';
import { resizeScene, stepScene, setSceneObstacles } from './motion.js';

// Same spine stations motion.js keeps clear of every obstacle (tail to nose).
const BODY_SAMPLE_U = [-0.5357142857142857, -0.2857142857142857,
  -0.0357142857142857, 0.2142857142857143, 0.4642857142857143];
const CELL_CLEARANCE = 12;

function makeScene(count = 1, width = 1200, height = 800) {
  const scene = createScene(count, '探索未至之境', 'mixed', 1);
  return resizeScene(scene, width, height);
}

function moveWhale(whale, x, y, heading = 0) {
  Object.assign(whale, { x, y, heading, turn: 0 });
}

/** Distance from the reef centre at each spine station, in canvas pixels. */
function stationDistances(whale, reef) {
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  return BODY_SAMPLE_U.map(u => Math.hypot(
    whale.x + c * whale.length * u - reef.x,
    whale.y + s * whale.length * u - reef.y));
}

test('a circle obstacle is accepted and a whale sitting on it is pushed clear', () => {
  const scene = makeScene(1);
  const whale = scene.whales[0], reef = { x: 600, y: 400, radius: 46 };
  moveWhale(whale, reef.x, reef.y);
  const normalized = setSceneObstacles(scene, [reef]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].circle, true);
  assert.equal(normalized[0].radius, 46);
  for (const distance of stationDistances(whale, reef)) {
    assert.ok(distance >= reef.radius + CELL_CLEARANCE - 1e-6, `station ${distance} inside the rock`);
  }
});

test('unusable circle entries are dropped instead of poisoning the scene', () => {
  const scene = makeScene(1);
  const normalized = setSceneObstacles(scene, [
    null, {}, { x: NaN, y: 300, radius: 40 }, { x: 300, y: 300, radius: 0 },
    { x: 300, y: 300, radius: -5 }, { x: 300, y: 'far', radius: 40 },
  ]);
  assert.deepEqual(normalized, []);
  assert.deepEqual(scene.obstacles, []);
  assert.ok(scene.whales.every(whale => Number.isFinite(whale.x) && Number.isFinite(whale.y)));
});

test('a route target that lands inside a reef is moved outside it', () => {
  const scene = makeScene(1);
  const whale = scene.whales[0], reef = { x: 500, y: 400, radius: 50 };
  whale.x = 820; whale.y = 400; whale.heading = Math.PI; whale.turn = 0;
  whale._motion.targetX = reef.x; whale._motion.targetY = reef.y;
  setSceneObstacles(scene, [reef]);
  assert.ok(Math.hypot(whale._motion.targetX - reef.x, whale._motion.targetY - reef.y) >= reef.radius);
});

test('a reef radius follows the canvas when the scene is resized', () => {
  const scene = makeScene(1, 1200, 800);
  const reef = { x: 900, y: 300, radius: 40 };
  setSceneObstacles(scene, [reef]);
  resizeScene(scene, 600, 400);
  assert.equal(scene.obstacles[0].x, 450);
  assert.equal(scene.obstacles[0].y, 150);
  assert.equal(scene.obstacles[0].radius, 20);
  assert.equal(scene.obstacles[0].circle, true);
});

test('the school keeps its body stations out of three reefs for a full minute', () => {
  const scene = makeScene(3, 1200, 800);
  const reefs = [
    { x: 140, y: 250, radius: 38 },
    { x: 1040, y: 300, radius: 44 },
    { x: 180, y: 620, radius: 34 },
  ];
  setSceneObstacles(scene, reefs);
  const start = scene.whales.map(whale => ({ x: whale.x, y: whale.y }));
  let distanceTravelled = 0;
  for (let frame = 0; frame < 60 * 60; frame++) {
    stepScene(scene, 1 / 60, 1);
    for (const whale of scene.whales) {
      assert.ok([whale.x, whale.y, whale.heading, whale.turn, whale.speed].every(Number.isFinite));
      for (const reef of reefs) {
        for (const distance of stationDistances(whale, reef)) {
          assert.ok(distance >= reef.radius + CELL_CLEARANCE - 1e-6,
            `frame ${frame}: station ${distance.toFixed(2)} inside reef ${reef.x},${reef.y}`);
        }
      }
    }
    if (frame % 30 === 0) {
      for (let i = 0; i < scene.whales.length; i++) {
        distanceTravelled += Math.hypot(scene.whales[i].x - start[i].x, scene.whales[i].y - start[i].y);
      }
    }
  }
  assert.ok(distanceTravelled > 600, `whales hardly moved (${distanceTravelled.toFixed(1)}px)`);
});

test('rectangles and circles can be installed together without changing either contract', () => {
  const scene = makeScene(2, 1000, 800);
  const composer = { x: 200, y: 560, width: 700, height: 120 };
  const reefs = [{ x: 100, y: 220, radius: 36 }, { x: 900, y: 260, radius: 36 }];
  const normalized = setSceneObstacles(scene, [composer, ...reefs]);
  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].circle, undefined);
  assert.equal(normalized[1].circle, true);
  assert.equal(normalized[2].circle, true);
  for (let frame = 0; frame < 20 * 60; frame++) stepScene(scene, 1 / 60, 1);
  for (const whale of scene.whales) {
    assert.ok(Number.isFinite(whale.x) && Number.isFinite(whale.y));
  }
});

test('a crowded phone-sized sea still keeps eight whales clear of two reefs', () => {
  const scene = makeScene(8, 390, 844);
  const reefs = [{ x: 30, y: 300, radius: 26 }, { x: 362, y: 520, radius: 28 }];
  setSceneObstacles(scene, reefs);
  for (let frame = 0; frame < 45 * 60; frame++) {
    stepScene(scene, 1 / 60, 1);
    if (frame % 20) continue;
    for (const whale of scene.whales) {
      assert.ok([whale.x, whale.y, whale.heading, whale.turn, whale.speed].every(Number.isFinite));
      for (const reef of reefs) {
        for (const distance of stationDistances(whale, reef)) {
          assert.ok(distance >= reef.radius + CELL_CLEARANCE - 1e-6,
            `frame ${frame}: station ${distance.toFixed(2)} inside reef ${reef.x},${reef.y}`);
        }
      }
    }
  }
});
