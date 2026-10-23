import test from 'node:test';
import assert from 'node:assert/strict';
import { WHALE_SPECIES, SPECIES_IDS } from '../src/species.js';
import { createScene, normalizeConfig, whalePose, transformParticle, projectParticle, createDepthGrid, resolveDepthGrid, stepScene } from '../src/model.js';

const point = (x, z = 0, part = 'body') => ({ x, y: 0, z, part, nx: 0, ny: -1, nz: 0, seed: 0.5, material: 'skin' });
const neutral = (species, wave) => ({ x: 0, y: 0, scale: 1, focal: 800, cameraZ: 0, near: 80,
  cy: 1, sy: 0, cp: 1, sp: 0, cr: 1, sr: 0, turn: 0, wave, stroke: 1, anatomy: WHALE_SPECIES[species] });
const span = (points, key) => Math.max(...points.map(p => p[key])) - Math.min(...points.map(p => p[key]));

test('old settings select a mixed group, and explicit species populate every whale consistently', () => {
  assert.equal(normalizeConfig({ text: '保留文字', opacity: 0.7 }).species, 'mixed');
  assert.equal(normalizeConfig({ species: 'shark' }).species, 'mixed');
  assert.deepEqual(createScene(5).whales.map(w => w.species), SPECIES_IDS);
  for (const species of SPECIES_IDS) {
    assert.equal(normalizeConfig({ species }).species, species);
    assert.ok(createScene(8, '鲸', species).whales.every(w => w.species === species));
  }
});

test('silhouettes distinguish long humpback flippers, a blunt sperm head and a dorsal-free bowhead', () => {
  const samples = Object.fromEntries(SPECIES_IDS.map(species => [species, createScene(1, '鲸', species).particles]));
  const finSpan = species => span(samples[species].filter(p => p.part === 'fin'), 'z');
  assert.ok(finSpan('humpback') > finSpan('blue') * 1.8);
  assert.ok(finSpan('humpback') > finSpan('sperm') * 1.8);
  const frontWidth = species => span(samples[species].filter(p => p.part === 'body' && p.x > 0.9), 'z');
  assert.ok(frontWidth('sperm') > frontWidth('blue') * 1.8);
  assert.ok(frontWidth('blue') > frontWidth('fin') * 1.5);
  assert.ok(!samples.bowhead.some(p => p.part === 'dorsal'));
  assert.ok(samples.sperm.some(p => p.part === 'dorsal'));
  assert.ok(!samples.sperm.some(p => p.material === 'pleat'));
  const { root, tip } = WHALE_SPECIES.humpback.flipper;
  const flipperLength = Math.hypot(...tip.map((value, i) => value - root[i])) / 2.24;
  assert.ok(flipperLength > 0.3 && flipperLength < 0.36, `humpback flipper drawing ratio ${flipperLength}`);
});

test('straight swimming drives tail strokes vertically without a lateral travelling wave', () => {
  for (const species of SPECIES_IDS) {
    const phases = Array.from({ length: 32 }, (_, i) => i * Math.PI / 16);
    const tail = phases.map(wave => transformParticle(point(-0.96), neutral(species, wave)));
    const chest = phases.map(wave => transformParticle(point(0.35), neutral(species, wave)));
    const torso = phases.map(wave => transformParticle(point(0), neutral(species, wave)));
    assert.ok(span(tail, 'y') > 0.17, `${species}: no vertical tail stroke`);
    assert.ok(span(tail, 'z') < 1e-9, `${species}: shark-like sideways tail stroke`);
    assert.ok(span(torso, 'y') > 0.01 && span(torso, 'y') < span(tail, 'y') * 0.25);
    assert.ok(span(chest, 'y') < span(tail, 'y') * 0.02, `${species}: head and shoulders bob too much`);
    for (const wave of phases) {
      const pose = neutral(species, wave), z = WHALE_SPECIES[species].fluke.span * 0.8;
      const left = transformParticle(point(-1.1, -z, 'fluke'), pose);
      const right = transformParticle(point(-1.1, z, 'fluke'), pose);
      assert.ok(Math.abs(left.y - right.y) < 1e-10, `${species}: fluke lobes flap opposite ways`);
    }
  }
});

test('each species keeps fin roots attached and surface normals finite during a stroke and turn', () => {
  for (const species of SPECIES_IDS) for (const wave of [0, 0.8, 2, 4.5]) {
    const pose = { ...neutral(species, wave), turn: 0.2 };
    const [x, y, z] = WHALE_SPECIES[species].flipper.root;
    const root = { ...point(x, z, 'fin'), y }, skin = { ...root, part: 'body' };
    const a = transformParticle(root, pose), b = transformParticle(skin, pose);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-9, `${species}: detached fin root`);
    for (const particle of createScene(1, '鲸', species).particles) {
      const p = transformParticle(particle, pose);
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(p.nx, p.ny, p.nz) - 1) < 1e-8);
    }
  }
});

test('both fluke lobes and body are visible overhead for every species at the actual text-grid resolution', () => {
  for (const species of SPECIES_IDS) {
    const scene = createScene(1, '探索未至之境', species), whale = scene.whales[0];
    const pose = whalePose(whale, 0, 1600, 900, 0.65);
    pose.stroke = 0; pose.turn = 0;
    const projected = scene.particles.map(p => projectParticle(p, pose));
    for (const side of [-1, 1]) {
      const upper = scene.particles.filter(p => p.part === 'fluke' && p.z * side > 0.05 && p.y < 0.005);
      assert.ok(upper.length > 10);
      assert.ok(upper.every(p => p.ny < 0), `${species}: upper fluke normals point into the foil`);
      const visibleUpper = upper.filter(p => projected[p.id].visibility > 0.7);
      assert.ok(visibleUpper.length > upper.length * 0.85, `${species}: overhead camera selects the underside of the fluke`);
      const visible = scene.particles.filter((p, i) => p.part === 'fluke' && p.z * side > 0.05 && projected[i].visibility > 0.7);
      assert.ok(visible.length > 12, `${species}: fluke side ${side} is back-facing`);
    }
    const grid = createDepthGrid(1600, 900, 11);
    resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
    assert.ok(Array.from(grid.owners).filter(owner => owner >= 0).length > 65, `${species}: silhouette disappeared into the glyph grid`);
  }
});

test('crowded groups retain the full dorsal fin section within the mesh budget', () => {
  for (const species of SPECIES_IDS) for (const count of [6, 7, 8]) {
    const scene = createScene(count, '鲸', species);
    assert.ok(scene.particles.length <= 8000);
    for (const whale of scene.whales) {
      const dorsal = scene.particles.filter(p => p.whale === whale.id && p.part === 'dorsal');
      if (WHALE_SPECIES[species].dorsal) {
        assert.ok(dorsal.length >= 24);
        assert.ok(span(dorsal, 'z') > 0.025, `${species}, count ${count}: dorsal section collapsed`);
      } else assert.equal(dorsal.length, 0);
    }
  }
});

test('calm cruising includes true glides while translation continues and turning stays bounded', () => {
  for (const species of SPECIES_IDS) {
    const scene = createScene(1, '鲸', species), whale = scene.whales[0];
    let minStroke = 1, maxStroke = 0, movingGlide = false;
    for (let tick = 0; tick < 60 * 55; tick++) {
      stepScene(scene, 1 / 60, 0.65);
      minStroke = Math.min(minStroke, whale._motion.stroke); maxStroke = Math.max(maxStroke, whale._motion.stroke);
      if (whale._motion.stroke < 0.03 && whale.speed > 3) movingGlide = true;
      assert.ok(Math.abs(whale.turn) < 0.23, `${species}: rapid turn`);
      assert.ok(whale.speed < 32, `${species}: cruise too fast`);
    }
    assert.ok(minStroke < 0.03 && maxStroke > 0.95 && movingGlide, `${species}: strokes never settle into a moving glide`);
  }
});
