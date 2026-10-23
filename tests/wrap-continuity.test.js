import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, createDepthGrid, projectParticle, resolveDepthGrid, stampSeaWraps } from '../src/model.js';
import { resizeScene, setSceneObstacles, stepScene, whalePose } from '../src/motion.js';
import { resetWhaleRig } from '../src/rig.js';

const dt = 1 / 60;
const wrapDelta = (a, b, size) => a - b - Math.round((a - b) / size) * size;
function sceneAt(width, height, size, x, y, heading, species = 'humpback') {
  const scene = createScene(1, '鲸', species, size);
  resizeScene(scene, width, height);
  stepScene(scene, dt);
  const whale = scene.whales[0];
  Object.assign(whale, { x, y, heading, turn: 0, speed: 36,
    vx: Math.cos(heading) * 36, vy: Math.sin(heading) * 36 });
  Object.assign(whale._motion, { targetX: x + Math.cos(heading) * width * 3,
    targetY: y + Math.sin(heading) * height * 3, targetDue: 1e6,
    wander: 0, wanderGoal: 0, wanderDue: 1e6, wave: 0, stroke: 0 });
  whale._motion.dive.nextDecision = Infinity;
  resetWhaleRig(whale);
  return scene;
}
function projectedScene(scene) {
  const poses = scene.whales.map(whale => whalePose(whale, scene.time, scene.width, scene.height, 1));
  return scene.particles.map(particle => projectParticle(particle, poses[particle.whale]));
}
function raster(scene, projected = projectedScene(scene)) {
  const grid = createDepthGrid(scene.width, scene.height, 5, { square: true });
  resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
  stampSeaWraps(scene, projected, grid);
  return grid;
}
// Independent oracle: explicitly tile the actual projected triangles and decals,
// then use the normal depth resolver once. Owner ids map back to stable particles.
function tiledRaster(scene, projected) {
  const copies = [], triangles = [], decals = [], count = projected.length;
  const shifts = [[0, 0]];
  for (let iy = -2; iy <= 2; iy++) for (let ix = -2; ix <= 2; ix++) {
    if (ix || iy) shifts.push([ix * scene.width, iy * scene.height]);
  }
  for (const [ox, oy] of shifts) {
    const offset = copies.length;
    for (const p of projected) copies.push({ ...p, x: p.x + ox, y: p.y + oy });
    for (const index of scene.triangles) triangles.push(offset + index);
    for (const index of scene.decals) decals.push(offset + index);
  }
  const grid = createDepthGrid(scene.width, scene.height, 5, { square: true });
  resolveDepthGrid(copies, grid, triangles, decals);
  for (let cell = 0; cell < grid.owners.length; cell++) if (grid.owners[cell] >= 0) grid.owners[cell] %= count;
  return grid;
}
function assertVisibleCopiesClear(scene, obstacles, frame) {
  const projected = projectedScene(scene);
  for (const [index, p] of projected.entries()) {
    if (p.visibility < 0.05) continue;
    const x = ((p.x % scene.width) + scene.width) % scene.width;
    const y = ((p.y % scene.height) + scene.height) % scene.height;
    for (const obstacle of obstacles) {
      const inside = obstacle.radius ? Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.radius
        : x > obstacle.x && x < obstacle.x + obstacle.width && y > obstacle.y && y < obstacle.y + obstacle.height;
      assert.equal(inside, false, `frame${frame}: visible wrapped ${scene.particles[index].part} entered obstacle at${x},${y}`);
    }
  }
}
function summary(grid) {
  let cells = 0, mass = 0;
  for (let i = 0; i < grid.owners.length; i++) if (grid.owners[i] >= 0) {
    cells++;
    mass += grid.coverage[i] * grid.visibility[i];
    assert.ok(Number.isFinite(grid.depths[i]) && grid.depths[i] > 0);
  }
  return { cells, mass };
}
function compareRaster(actual, expected, context) {
  let missing = 0, extra = 0, wrongDepth = 0, wrongVisibility = 0, wrongCoverage = 0, wrongOwner = 0;
  for (let cell = 0; cell < actual.owners.length; cell++) {
    const a = actual.owners[cell] >= 0, e = expected.owners[cell] >= 0;
    if (e && !a) missing++;
    if (a && !e) extra++;
    if (!a || !e) continue;
    if (Math.abs(actual.depths[cell] - expected.depths[cell]) > 1e-6) wrongDepth++;
    if (Math.abs(actual.visibility[cell] - expected.visibility[cell]) > 1e-6) wrongVisibility++;
    if (Math.abs(actual.coverage[cell] - expected.coverage[cell]) > 1e-6) wrongCoverage++;
    if (actual.owners[cell] !== expected.owners[cell]) wrongOwner++;
  }
  assert.deepEqual({ missing, extra, wrongDepth, wrongVisibility, wrongCoverage, wrongOwner },
    { missing: 0, extra: 0, wrongDepth: 0, wrongVisibility: 0, wrongCoverage: 0, wrongOwner: 0 }, context);
}

test('actual mesh coverage, owner depth and partial visibility match a full torus raster at all edges and corners', () => {
  for (const [width, height, size] of [[803, 601, 1], [641, 119, 1.55], [119, 641, 1.55]]) {
    const spots = [[0.01, height / 2, Math.PI], [width - 0.01, height / 2, 0],
      [width / 2, 0.01, -Math.PI / 2], [width / 2, height - 0.01, Math.PI / 2],
      [0.01, 0.01, -Math.PI * 0.75], [width - 0.01, height - 0.01, Math.PI * 0.25],
      [width / 2, height * 0.65, Math.PI / 2], [width / 2, height * 0.35, -Math.PI / 2],
      ...[0.55, 0.6, 0.7, 0.72, 0.75, 0.8, 0.85].map(u => [width / 2, height * u, Math.PI / 2])];
    for (const [x, y, heading] of spots) {
      const scene = sceneAt(width, height, size, x, y, heading), projected = projectedScene(scene);
      // A genuine depth/visibility gradient exercises the surface raster, rather
      // than an opaque point-only stand-in for the animal.
      for (const [i, point] of projected.entries()) point.visibility *= 0.35 + 0.6 * (i % 11) / 10;
      const expected = tiledRaster(scene, projected);
      compareRaster(raster(scene, projected), expected, `${width}x${height} size${size} at${x},${y} angle${heading}`);
      assert.ok(summary(expected).cells > 5);
    }
  }
});

test('four edges and a corner preserve one-tick visible coverage and rigid spine offsets across folding', () => {
  const width = 803, height = 601;
  for (const [x, y, heading] of [[width - 0.1, 300, 0], [0.1, 300, Math.PI],
    [400, height - 0.1, Math.PI / 2], [400, 0.1, -Math.PI / 2],
    [width - 0.1, height - 0.1, Math.PI / 4]]) {
    const scene = sceneAt(width, height, 1.55, x, y, heading), whale = scene.whales[0];
    const before = raster(scene), beforeStats = summary(before);
    const offsets = Array.from(whale.rig.nodes, (value, i) => value - (i % 2 ? whale.y : whale.x));
    stepScene(scene, dt);
    assert.ok(Math.abs(wrapDelta(whale.x, x, width) - whale.vx * dt) < 1e-9);
    assert.ok(Math.abs(wrapDelta(whale.y, y, height) - whale.vy * dt) < 1e-9);
    whale.rig.nodes.forEach((value, i) => assert.ok(Math.abs(value - (i % 2 ? whale.y : whale.x) - offsets[i]) < 1e-8));
    const after = raster(scene), afterStats = summary(after);
    assert.ok(afterStats.mass / beforeStats.mass > 0.85 && afterStats.mass / beforeStats.mass < 1.15,
      `fold ${heading}: raster mass ${beforeStats.mass} -> ${afterStats.mass}`);
    let common = 0;
    for (let cell = 0; cell < before.owners.length; cell++) {
      if (before.owners[cell] >= 0 && after.owners[cell] >= 0) common++;
    }
    assert.ok(common / Math.max(beforeStats.cells, afterStats.cells) > 0.85, 'no whole-body flash or interior teleport');
  }
});

test('folding against the opposite reef or card cannot apply a post-crossing teleport', t => {
  const width = 1200, height = 800;
  let maxTravelError = 0, maxMassChange = 0;
  for (const obstacle of [{ x: 32, y: 400, radius: 38 }, { x: 0, y: 330, width: 70, height: 140 }]) {
    const scene = sceneAt(width, height, 0.55, width - 140, 400, 0);
    setSceneObstacles(scene, [obstacle]);
    const whale = scene.whales[0];
    let distanceTravelled = 0, constrainedFrames = 0;
    for (let frame = 0; frame < 10 * 60; frame++) {
      const x = whale.x, y = whale.y, before = summary(raster(scene));
      stepScene(scene, dt);
      const moved = Math.hypot(wrapDelta(whale.x, x, width), wrapDelta(whale.y, y, height));
      maxTravelError = Math.max(maxTravelError, Math.abs(moved - whale.speed * dt));
      distanceTravelled += moved;
      if (moved < 0.01) constrainedFrames++;
      // The historical spine settles after movement, so an existing contact
      // may add a subpixel correction. One pixel is far below the 8px cell and
      // still catches the reproduced 105.841px fold jump by two orders of magnitude.
      assert.ok(moved <= Math.hypot(whale.vx, whale.vy) * dt + 1,
        `${obstacle.radius ? 'reef' : 'card'} frame${frame}: ${moved.toFixed(3)}px jump, travel${(whale.speed * dt).toFixed(3)}px`);
      const after = summary(raster(scene));
      maxMassChange = Math.max(maxMassChange, Math.abs(after.mass - before.mass));
      if (frame % 6 === 0) assertVisibleCopiesClear(scene, [obstacle], frame);
      if (before.mass > 5 && after.mass > 5) assert.ok(after.mass / before.mass > 0.75 && after.mass / before.mass < 1.34,
        `raster flash near opposite obstacle: ${before.mass}->${after.mass}`);
    }
    assert.ok(distanceTravelled > 50, 'the animal keeps swimming around the seam obstacle');
    assert.ok(constrainedFrames < 60, 'contact handling must not pin the body for most of the scene');
    t.diagnostic(`${obstacle.radius ? 'reef' : 'card'}: travelled ${distanceTravelled.toFixed(3)}px, frames below 0.01px=${constrainedFrames}/600`);
  }
  t.diagnostic(`Observed across 1200 frames: max travel error=${maxTravelError.toExponential(3)}px, max per-tick weighted raster mass change=${maxMassChange.toFixed(3)} cells`);
});

test('a large blue body is visibly clear after obstacle layout, before timed movement begins', () => {
  const scene = sceneAt(1200, 800, 1.55, 1060, 400, 0, 'blue');
  const obstacle = { x: 0, y: 330, width: 70, height: 140 };
  setSceneObstacles(scene, [obstacle]);
  assertVisibleCopiesClear(scene, [obstacle], 0);
  assert.ok(summary(raster(scene)).cells > 5);
  for (let frame = 1; frame <= 60; frame++) {
    stepScene(scene, dt);
    if (frame % 6 === 0) assertVisibleCopiesClear(scene, [obstacle], frame);
  }
});

test('five species and three sizes keep actual drawn seam contacts continuous after layout', t => {
  const results = [];
  for (const species of ['blue', 'humpback', 'sperm', 'fin', 'bowhead']) {
    for (const size of [0.55, 1, 1.55]) for (const kind of ['reef', 'card']) {
      const scene = sceneAt(1200, 800, size, 1060, 400, 0, species);
      const obstacle = kind === 'reef' ? { x: 32, y: 400, radius: 38 }
        : { x: 0, y: 330, width: 70, height: 140 };
      setSceneObstacles(scene, [obstacle]);
      const whale = scene.whales[0];
      let maxError = 0, maxStep = 0, worst = null, travelled = 0, stopped = 0, stopRun = 0, maxStopRun = 0;
      let previousRaster = summary(raster(scene)), maxMassDelta = 0;
      for (let frame = 1; frame <= 600; frame++) {
        const before = { x: whale.x, y: whale.y, heading: whale.heading, speed: whale.speed,
          nodes: Array.from(whale.rig.nodes) };
        stepScene(scene, dt);
        const dx = wrapDelta(whale.x, before.x, scene.width), dy = wrapDelta(whale.y, before.y, scene.height);
        const error = Math.hypot(dx - whale.vx * dt, dy - whale.vy * dt);
        const step = Math.hypot(dx, dy);
        assert.ok(step <= Math.max(before.speed, 36) * dt + 1,
          `${species}/${size}/${kind} frame${frame}: absolute ${step.toFixed(3)}px step exceeds the pre-step speed budget`);
        travelled += step;
        if (step < 0.01) { stopped++; stopRun++; maxStopRun = Math.max(maxStopRun, stopRun); }
        else stopRun = 0;
        maxStep = Math.max(maxStep, step);
        if (error > maxError) {
          maxError = error;
          worst = { frame, before, after: { x: whale.x, y: whale.y, heading: whale.heading,
            speed: whale.speed, vx: whale.vx, vy: whale.vy, nodes: Array.from(whale.rig.nodes) } };
        }
        if (frame % 12 === 0 || error > 1) {
          assertVisibleCopiesClear(scene, [obstacle], frame);
          const drawn = summary(raster(scene));
          maxMassDelta = Math.max(maxMassDelta, Math.abs(drawn.mass - previousRaster.mass));
          previousRaster = drawn;
        }
      }
      assert.ok(maxStep < 1, `${species}/${size}/${kind}: actual maxStep ${maxStep} must stay subpixel`);
      assert.ok(travelled > 30, `${species}/${size}/${kind}: contact cannot freeze the whale`);
      assert.ok(maxStopRun < 60, `${species}/${size}/${kind}: contact cannot stop motion for a full second`);
      results.push({ species, size, kind, maxError, maxStep, travelled, stopped, maxStopRun, maxMassDelta, worst });
    }
  }
  const failures = results.filter(result => result.maxError > 1);
  for (const result of results) t.diagnostic(JSON.stringify({ ...result, worst: result.maxError > 1 ? result.worst : undefined }));
  assert.equal(failures.length, 0, failures.map(result => `${result.species}/${result.size}/${result.kind}: error${result.maxError.toFixed(3)}px frame${result.worst.frame}`).join('; '));
});

test('actual dive depth and visibility remain continuous at wrapped reef contacts for every species', () => {
  for (const species of ['blue', 'humpback', 'sperm', 'fin', 'bowhead']) {
    const scene = sceneAt(1200, 800, 0.55, 1060, 400, 0, species);
    const obstacle = { x: 32, y: 400, radius: 38 };
    setSceneObstacles(scene, [obstacle]);
    const whale = scene.whales[0], state = whale._motion;
    Object.assign(state.dive, { startedAt: state.age, entry: 3, under: 2, exit: 3, contactStage: 0 });
    let hiddenFrames = 0;
    for (let frame = 1; frame <= 9 * 60; frame++) {
      const x = whale.x, y = whale.y, speed = whale.speed;
      stepScene(scene, dt);
      const moved = Math.hypot(wrapDelta(whale.x, x, scene.width), wrapDelta(whale.y, y, scene.height));
      assert.ok(moved <= Math.max(speed, 36) * dt + 1, `${species}: diving contact cannot teleport`);
      if (frame % 12) continue;
      assertVisibleCopiesClear(scene, [obstacle], frame);
      const drawn = summary(raster(scene));
      if (state.submergence === 1 && drawn.cells === 0) hiddenFrames++;
    }
    assert.ok(hiddenFrames > 0, `${species}: the depth gate is exercised while fully underwater`);
    assert.equal(state.dive.splashSerial, 2, `${species}: both actual contact events survive seam avoidance`);
  }
});

test('all visible wrapped particles avoid reefs and a composer in a crowded phone sea', () => {
  const scene = createScene(8, '鲸', 'mixed', 1);
  resizeScene(scene, 390, 844);
  const obstacles = [{ x: 30, y: 300, radius: 26 }, { x: 362, y: 520, radius: 28 },
    { x: 55, y: 700, width: 290, height: 100 }];
  setSceneObstacles(scene, obstacles);
  assertVisibleCopiesClear(scene, obstacles, 0);
  for (let frame = 1; frame <= 30 * 60; frame++) {
    stepScene(scene, dt);
    if (frame % 6 === 0) assertVisibleCopiesClear(scene, obstacles, frame);
  }
});
