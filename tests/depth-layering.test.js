import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, resizeScene, stepScene, whalePose, DEFAULTS } from '../src/model.js';
import { adoptSceneState } from '../src/motion.js';
import { createWhalePainter } from '../src/surface.js';

function advance(scene, seconds, frame = 1 / 60) {
  for (let i = 0; i < Math.round(seconds / frame); i++) stepScene(scene, frame, 1);
}

test('one through eight whales start on distinct reproducible depth planes', () => {
  for (let count = 1; count <= 8; count++) {
    const assignments = new Set();
    for (const seed of [0, 19, 7821, 987654]) {
      const depths = createScene(count, '鲸', 'blue', 1, seed).whales.map(w => w.depth);
      assert.equal(new Set(depths).size, count);
      assert.ok(depths.every(d => d >= 0.16 && d <= 1.05 + 1e-12));
      assert.deepEqual(depths, createScene(count, '鲸', 'blue', 1, seed).whales.map(w => w.depth));
      assignments.add(depths.join(','));
    }
    if (count > 1) assert.ok(assignments.size > 1);
  }
});

test('independent depth cruises stay smooth and bounded while body and camera follow together', () => {
  const scene = createScene(3, '鲸', 'blue', 1, 19);
  const initial = scene.whales.map(w => ({ depth: w.depth, length: w.length }));
  const ranges = initial.map(w => ({ min: w.length, max: w.length }));
  const previous = initial.map(w => w.depth);
  for (let frame = 0; frame < 140 * 60; frame++) {
    stepScene(scene, 1 / 60, 1);
    scene.whales.forEach((w, i) => {
      assert.ok(w.depth >= 0.10 - 1e-12 && Math.abs(w.depth - initial[i].depth) <= 0.24 + 1e-12);
      assert.ok(Math.abs(w.depth - previous[i]) < 0.0007, 'no jumps at a new depth target');
      const expected = initial[i].length * (1 + initial[i].depth * 0.48) / (1 + w.depth * 0.48);
      assert.ok(Math.abs(w.length - expected) < 1e-8, 'collision length follows the depth in this tick');
      const pose = whalePose(w, scene.time, scene.width, scene.height, 1);
      assert.ok(Math.abs(pose.cameraZ / pose.focal - w.depth) < 1e-12);
      assert.equal(pose.length, w.length);
      const nodes = w.rig.nodes, segment = w.length / (nodes.length / 2 - 1);
      for (let j = 2; j < nodes.length; j += 2) {
        assert.ok(Math.abs(Math.hypot(nodes[j] - nodes[j - 2], nodes[j + 1] - nodes[j - 1]) - segment) < 1e-7);
      }
      ranges[i].min = Math.min(ranges[i].min, w.length);
      ranges[i].max = Math.max(ranges[i].max, w.length);
      previous[i] = w.depth;
    });
  }
  assert.ok(ranges.every(r => r.max / r.min > 1.05), 'all whales visibly change size over a cruise');
  assert.ok(new Set(scene.whales.map(w => w._motion.depthDuration)).size > 1, 'whales have independent timing');
});

test('depth cruises survive resize, scene adoption, and a paused clock without a first-frame jump', () => {
  const scene = createScene(3, '鲸', 'blue', 1, 19);
  advance(scene, 41);
  const depths = scene.whales.map(w => w.depth);
  resizeScene(scene, 1200, 800);
  assert.deepEqual(scene.whales.map(w => w.depth), depths);
  const replacement = createScene(5, '海', 'humpback', 1.3, 19);
  resizeScene(replacement, 1200, 800);
  adoptSceneState(scene, replacement);
  for (let i = 0; i < 3; i++) {
    assert.equal(replacement.whales[i].depth, scene.whales[i].depth);
    assert.equal(replacement.whales[i]._motion.depthTarget, scene.whales[i]._motion.depthTarget);
  }
  const geometry = replacement.whales.slice(0, 3).map(w => w.length);
  const paused = structuredClone(replacement);
  stepScene(replacement, 0.25, 0);
  assert.deepEqual(replacement, paused);
  stepScene(replacement, 1 / 60, 1);
  replacement.whales.slice(0, 3).forEach((w, i) => assert.ok(Math.abs(w.length / geometry[i] - 1) < 0.001));
});

test('depth progression is identical under frame subdivision', () => {
  const a = createScene(3), b = createScene(3);
  advance(a, 47, 1 / 60);
  advance(b, 47, 1 / 30);
  assert.deepEqual(a.whales, b.whales);
});

test('actual Canvas commands attenuate distant whales in both render styles and themes', () => {
  const scene = createScene(1);
  // Hold the resolved cell field fixed to isolate depth from coverage and lighting.
  const grid = { owners: [0], centersX: [500], centersY: [300], coverage: [1], lights: [0.5],
    visibility: [1], sampleOwners: [0], cellWidth: 16, cellHeight: 16 };
  for (const renderStyle of ['glyphs', 'cells']) for (const dark of [false, true]) {
    const painter = createWhalePainter(scene, { ...DEFAULTS, opacity: 0.6, quietCenter: false, renderStyle });
    const draw = depth => {
      const calls = [];
      const ctx = { globalAlpha: 1, fillText() { calls.push(this.globalAlpha); }, fillRect() { calls.push(this.globalAlpha); } };
      painter.paint(ctx, grid, [{ focal: 1000, cameraZ: depth * 1000 }], 1000, 600, 1, null, dark);
      assert.equal(ctx.globalAlpha, 1);
      return calls;
    };
    const near = draw(0.14), middle = draw(0.75), far = draw(1.35);
    assert.equal(near.length, far.length);
    far.forEach((alpha, i) => {
      assert.ok(alpha < middle[i] && middle[i] < near[i]);
      assert.ok(Math.abs(alpha / near[i] - 0.62) < 1e-12);
    });
  }
});
