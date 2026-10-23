import test from 'node:test';
import assert from 'node:assert/strict';
import { whaleSpecies } from '../src/species.js';
import { createScene, resizeScene, stepScene, whalePose, transformParticle, projectParticle, createDepthGrid, resolveDepthGrid } from '../src/model.js';

const vertex = (x, extra = {}) => ({ x, y: 0, z: 0, nx: 0, ny: -1, nz: 0, part: 'body', ...extra });
const neutral = wave => ({ x: 0, y: 0, scale: 200, focal: 800, cameraZ: 0, near: 80,
  cy: 1, sy: 0, cp: 1, sp: 0, cr: 1, sr: 0, wave, turn: 0 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('turning retains body history instead of rotating the whole whale as one rigid shape', () => {
  const scene = createScene(1);
  resizeScene(scene, 1200, 800);
  const whale = scene.whales[0];
  whale._motion.targetX = whale.x;
  whale._motion.targetY = whale.y + 450;
  whale._motion.targetDue = 100;
  for (let frame = 0; frame < 360; frame++) stepScene(scene, 1 / 60, 1);
  const withoutHistory = structuredClone(whale);
  delete withoutHistory.rig;
  const actual = whalePose(whale, scene.time, 1200, 800, 1);
  const straight = whalePose(withoutHistory, scene.time, 1200, 800, 1);
  const tail = vertex(-1.05);
  const displacement = distance(transformParticle(tail, actual), transformParticle(tail, straight)) / (actual.scale / (1 + actual.cameraZ / actual.focal));
  assert.ok(displacement > 0.04 && displacement < 0.4, `tail follow-through is ${displacement.toFixed(4)} model units`);
});

test('the travelling stroke moves vertically and leaves the head steadier than the tail', () => {
  const phases = Array.from({ length: 16 }, (_, i) => i * Math.PI / 8);
  const points = phases.map(phase => transformParticle(vertex(0), neutral(phase)));
  const span = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  assert.ok(span > 1 && span < 8, `middle of whale moves ${span.toFixed(2)}px over a full stroke`);
});

test('pectoral fins articulate around their roots instead of remaining glued to the torso', () => {
  const tip = vertex(0.01, { part: 'fin', y: 0.115, z: 0.39 });
  const points = Array.from({ length: 24 }, (_, i) => transformParticle(tip, neutral(i * Math.PI / 12)));
  const span = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
  assert.ok(span > 0.5 && span < 6, `fin tip should trim subtly, got ${span.toFixed(2)}px`);
});

test('turning preserves spine lengths and keeps individual joints from folding', () => {
  const scene = createScene(3);
  for (let frame = 0; frame < 1800; frame++) {
    stepScene(scene, 1 / 60, frame < 900 ? 0.65 : 2);
    if (frame % 30) continue;
    for (const whale of scene.whales) {
      const nodes = whale.rig.nodes, expected = whale.length / (nodes.length / 2 - 1);
      let previous = whale.heading;
      for (let i = 2; i < nodes.length; i += 2) {
        const dx = nodes[i - 2] - nodes[i], dy = nodes[i - 1] - nodes[i + 1];
        assert.ok(Math.abs(Math.hypot(dx, dy) - expected) < 1e-7);
        const heading = Math.atan2(dy, dx);
        const angle = Math.atan2(Math.sin(heading - previous), Math.cos(heading - previous));
        assert.ok(Math.abs(angle) <= 0.130001, `joint bent ${angle} radians`);
        previous = heading;
      }
    }
  }
});

test('flipper roots stay attached while the tips move and bank asymmetrically', () => {
  const [x, y, z] = whaleSpecies('blue').flipper.root;
  const root = vertex(x, { part: 'fin', y, z });
  const skin = { ...root, part: 'body' };
  for (let i = 0; i < 24; i++) {
    const pose = { ...neutral(i * Math.PI / 12), turn: Math.sin(i) * 0.7 };
    assert.ok(distance(transformParticle(root, pose), transformParticle(skin, pose)) < 1e-9);
  }
  const right = vertex(0.01, { part: 'fin', y: 0.115, z: 0.39 });
  const left = { ...right, z: -right.z };
  const pose = { ...neutral(0), turn: 0.7 };
  assert.ok(Math.abs(transformParticle(right, pose).y - transformParticle(left, pose).y) > 5);
});

test('curved body projection keeps unit normals, literal glyphs, and surface coverage', () => {
  const scene = createScene(3), poses = scene.whales.map(() => ({}));
  const projected = scene.particles.map(() => ({}));
  const grid = createDepthGrid(1600, 900, 11);
  for (const frames of [90, 120, 150]) {
    for (let i = 0; i < frames; i++) stepScene(scene, 1 / 60, 1);
    for (const w of scene.whales) {
      const pose = whalePose(w, scene.time, 1600, 900, 1, poses[w.id]);
      const buffer = pose.spine;
      whalePose(w, scene.time, 1600, 900, 1, pose);
      assert.equal(pose.spine, buffer, 'reuses each whale render spine');
    }
    for (let i = 0; i < scene.particles.length; i++) {
      const p = scene.particles[i], pose = poses[p.whale];
      const world = transformParticle(p, pose);
      assert.ok(Object.values(world).every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(world.nx, world.ny, world.nz) - 1) < 1e-9);
      projectParticle(p, pose, projected[i]);
      assert.ok('探索未至之境'.includes(p.glyph));
    }
    resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
    const cells = scene.whales.map(() => 0);
    for (const owner of grid.owners) if (owner >= 0) cells[scene.particles[owner].whale]++;
    assert.ok(cells.every(count => count >= 30), `body disappeared while bending: ${cells}`);
  }
});
