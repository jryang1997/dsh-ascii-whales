import test from 'node:test';
import assert from 'node:assert/strict';
import { setSceneObstacles, resizeScene, stepScene } from './motion.js';
import { DEFAULTS, createScene } from './model.js';

// The glass side of this feature lives in content-glass.test.js; this file owns
// the avoidance half: the input card as an obstacle the school has to swim around.
const obstacle = Object.freeze({ x: 450, y: 650, width: 700, height: 150 });
// The same five spine stations the avoidance clamps against (nose to fluke),
// plus the glyph-cell gap the motion code keeps around them.
const BODY_CLEARANCE = 12;
const bodySampleOffsets = Object.freeze([-0.5357142857142857, -0.2857142857142857,
  -0.0357142857142857, 0.2142857142857143, 0.4642857142857143]);
/** The five body samples under test, in canvas pixels. */
function bodySamples(whale) {
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  return bodySampleOffsets.map(offset => ({
    x: whale.x + c * whale.length * offset,
    y: whale.y + s * whale.length * offset,
  }));
}
const pointInside = (rect, x, y, margin = 0) => x > rect.x - margin && x < rect.x + rect.width + margin
  && y > rect.y - margin && y < rect.y + rect.height + margin;
/** True when every body sample stays outside the obstacle plus its clearance. */
const bodyClear = (whale, rect) => bodySamples(whale).every(point => !pointInside(rect, point.x, point.y, BODY_CLEARANCE));
/** Smallest signed clearance of a body sample to the obstacle (negative = inside). */
function bodyClearance(whale, rect) {
  let smallest = Infinity;
  for (const point of bodySamples(whale)) {
    const distance = Math.hypot(Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width)),
      Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height)));
    smallest = Math.min(smallest, distance - BODY_CLEARANCE);
  }
  return smallest;
}

function school(count = 3) {
  const scene = createScene(count);
  resizeScene(scene, 1600, 900);
  return scene;
}

test('an obstacle clears every body sample immediately and the school keeps them out while swimming', () => {
  const scene = school(3);
  // The third whale starts lying across the card area, so this is the immediate case.
  assert.ok(bodySamples(scene.whales[2]).some(point => pointInside(obstacle, point.x, point.y)),
    'the initial layout really puts body samples in the card area');
  const applied = setSceneObstacles(scene, [obstacle]);
  assert.equal(applied.length, 1);
  assert.equal(scene.obstacles.length, 1);
  // Reduced motion / static frames: no step has run, the body must already be clear.
  for (const whale of scene.whales) {
    assert.ok(bodyClear(whale, obstacle), `whale ${whale.id} was left with body samples inside the card`);
    assert.ok(whale.x >= 0 && whale.x <= 1600 && whale.y >= 0 && whale.y <= 900, 'the body never leaves the canvas');
    const target = whale._motion;
    const above = obstacle.y - Math.max(8, whale.length * 0.08);
    const insideTarget = target.targetX > obstacle.x && target.targetX < obstacle.x + obstacle.width
      && target.targetY > obstacle.y && target.targetY < obstacle.y + obstacle.height;
    if (insideTarget) assert.ok(target.targetY <= above + 1e-9 || target.targetY >= obstacle.y + obstacle.height, 'a route target inside the card is moved out');
  }
  let minimum = { clearance: Infinity };
  for (let frame = 0; frame < 60 * 60; frame++) {
    stepScene(scene, 1 / 60, 1);
    for (const whale of scene.whales) {
      const clearance = bodyClearance(whale, obstacle);
      if (clearance < minimum.clearance) minimum = { clearance, frame, id: whale.id };
      assert.ok(bodyClear(whale, obstacle), `whale ${whale.id} had a body sample in the card at frame ${frame}`);
      assert.ok([whale.x, whale.y, whale.vx, whale.vy, whale.heading, whale.length].every(Number.isFinite), `frame ${frame}`);
      // Normal steering may graze the canvas edge (the school is not fenced in);
      // what the clamp must never do is throw a body far outside the window.
      assert.ok(whale.x >= -whale.length && whale.x <= 1600 + whale.length, `frame ${frame}: x ${whale.x}`);
      assert.ok(whale.y >= -whale.length && whale.y <= 900 + whale.length, `frame ${frame}: y ${whale.y}`);
    }
  }
  assert.ok(minimum.clearance >= -1e-9, `closest body sample ${minimum.clearance} at frame ${minimum.frame}`);
});

test('body-aware avoidance also holds for the smallest and largest whale sizes', () => {
  for (const whaleSize of [0.55, 1, 1.55]) {
    const scene = createScene(3, DEFAULTS.text, DEFAULTS.species, whaleSize);
    resizeScene(scene, 1600, 900);
    setSceneObstacles(scene, [obstacle]);
    // The static (reduced motion) frame has to be correct before any stepping.
    for (const whale of scene.whales) assert.ok(bodyClear(whale, obstacle), `size ${whaleSize}: static frame`);
    for (let frame = 0; frame < 20 * 60; frame++) {
      stepScene(scene, 1 / 60, 1);
      for (const whale of scene.whales) {
        assert.ok(bodyClear(whale, obstacle), `size ${whaleSize}: whale ${whale.id} body sample in the card at frame ${frame}`);
        assert.ok(Number.isFinite(whale.x) && Number.isFinite(whale.y));
        assert.ok(whale.x >= 0 && whale.x <= 1600 && whale.y >= 0 && whale.y <= 900);
      }
    }
  }
});

test('an obstacle follows a canvas resize and a cleared obstacle restores the old steering', () => {
  const scene = school(3);
  setSceneObstacles(scene, [obstacle]);
  resizeScene(scene, 800, 450);
  const scaled = scene.obstacles[0];
  assert.equal(scaled.x, 225);
  assert.equal(scaled.y, 325);
  assert.equal(scaled.width, 350);
  assert.equal(scaled.height, 75);
  for (const whale of scene.whales) assert.ok(bodyClear(whale, scaled));

  // Clearing the list is exactly the pre-0.10 behaviour: an untouched twin stays in step.
  const touched = school(3), untouched = school(3);
  setSceneObstacles(touched, []);
  assert.deepEqual(touched.obstacles, []);
  for (let frame = 0; frame < 20 * 60; frame++) {
    stepScene(touched, 1 / 60, 1);
    stepScene(untouched, 1 / 60, 1);
  }
  assert.deepEqual(touched.whales, untouched.whales);
  assert.equal(touched.time, untouched.time);
});

test('broken obstacle values are dropped instead of steering whales to NaN', () => {
  const scene = school(2);
  const before = scene.whales.map(whale => ({ x: whale.x, y: whale.y }));
  assert.deepEqual(setSceneObstacles(scene, [null, { x: NaN, y: 0, width: 10, height: 10 },
    { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -1 }, 'nope']), []);
  assert.deepEqual(scene.whales.map(whale => ({ x: whale.x, y: whale.y })), before);
  assert.deepEqual(setSceneObstacles(scene, undefined), []);
  stepScene(scene, 1 / 60, 1);
  for (const whale of scene.whales) assert.ok(Number.isFinite(whale.x) && Number.isFinite(whale.y));
});
