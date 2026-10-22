import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { FIELDS, DEFAULTS, normalizeConfig, glyphSequence, createScene, whalePose, transformParticle, projectParticle,
  createDepthGrid, resolveDepthGrid, fitCanvas, attenuation } from './model.js';
import * as engine from './engine.js';
import { whaleSpecies } from './species.js';
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
const scene = createScene(3);
const unrotated = () => ({ x: 400, y: 300, scale: 100, focal: 800, cameraZ: 0, near: 80,
  cy: 1, sy: 0, cp: 1, sp: 0, cr: 1, sr: 0, wave: 0 });
const surfacePoint = (value = {}) => ({ x: 0.6, y: 0, z: 0, nx: 0, ny: 0, nz: -1, seed: 0.5, material: 'skin', ...value });

test('configuration preserves saved text and sizes, with readable new defaults and numeric bounds', () => {
  assert.deepEqual(normalizeConfig(), DEFAULTS);
  assert.equal(DEFAULTS.glyphSize, 11);
  assert.equal(DEFAULTS.opacity, 0.6);
  assert.equal(DEFAULTS.count, 3);
  assert.equal(DEFAULTS.text, '探索未至之境');
  assert.equal(DEFAULTS.whaleSize, 1);
  assert.equal(DEFAULTS.composerGlass, false);
  assert.equal(DEFAULTS.composerAvoid, false);
  assert.deepEqual(Object.keys(FIELDS), ['enabled', 'count', 'species', 'renderStyle', 'fillMode', 'text', 'speed', 'opacity', 'glyphSize', 'whaleSize', 'color', 'quietCenter', 'leftInset', 'glass', 'glassStrength', 'composerGlass', 'composerAvoid', 'spout', 'reefs', 'ripples']);
  // `glass` is now the frosted-content-box option and is on by default; the old
  // separate input-box switch survives only as a hidden compatibility field.
  assert.equal(DEFAULTS.glass, true);
  assert.equal(FIELDS.composerGlass.hidden, true);
  assert.deepEqual(Object.entries(FIELDS).filter(([, field]) => field.hidden).map(([key]) => key), ['composerGlass']);
  // A 0.10.0 profile that only switched the input-box glass on must keep an
  // effect after upgrading: normalization folds it into the content glass.
  const legacy = normalizeConfig({ composerGlass: true });
  assert.equal(legacy.glass, true);
  assert.equal(legacy.composerGlass, false);
  assert.equal(normalizeConfig({ glass: true, composerGlass: false }).composerGlass, false);
  // The content glass and the input-box avoidance are alternatives; glass wins.
  assert.equal(normalizeConfig({ glass: true, composerAvoid: true }).composerAvoid, false);
  const avoidOnly = normalizeConfig({ glass: false, composerAvoid: true });
  assert.equal(avoidOnly.glass, false);
  assert.equal(avoidOnly.composerAvoid, true);
  for (let glyphSize = 7; glyphSize <= 16; glyphSize++) {
    const saved = { ...DEFAULTS, glyphSize, opacity: 0.18, text: '原有文字 Whale 🐋', leftInset: 320 };
    assert.deepEqual(normalizeConfig(saved), saved);
  }
  assert.deepEqual(normalizeConfig({ count: -2, speed: 0, opacity: 0, glyphSize: 99, leftInset: -1 }),
    { ...DEFAULTS, count: 1, speed: 0.3, opacity: 0.04, glyphSize: 16, leftInset: 0 });
  assert.deepEqual(normalizeConfig({ count: 99, speed: 99, opacity: 99, glyphSize: 0, leftInset: 999 }),
    { ...DEFAULTS, count: 8, speed: 2, opacity: 0.9, glyphSize: 4, leftInset: 500 });
  assert.deepEqual(normalizeConfig({ count: 1.6, speed: NaN, opacity: Infinity, glyphSize: 5.6, leftInset: 123.5, color: 'red' }),
    { ...DEFAULTS, count: 2, glyphSize: 6, leftInset: 124 });
  assert.equal(normalizeConfig({ text: '鲸'.repeat(100) }).text.length, 40);
  assert.equal(normalizeConfig({ text: '鲸'.repeat(39) + '🐋' }).text, '鲸'.repeat(39));
  assert.equal(normalizeConfig({ text: '鲸'.repeat(38) + '🐋' }).text, '鲸'.repeat(38) + '🐋');
});

test('default body glyphs are the six literal Chinese characters, including blank text fallback', () => {
  const expected = ['探', '索', '未', '至', '之', '境'];
  assert.deepEqual(glyphSequence(), expected);
  for (const text of ['', ' ', '\t\n\r\u3000\u00a0']) {
    assert.deepEqual(glyphSequence(text), expected);
    assert.deepEqual(createScene(1, text), createScene(1));
  }
  assert.deepEqual(new Set(scene.particles.map(p => p.glyph)), new Set(expected));
});

test('every anatomical part uses the deterministic custom glyph sequence for one to eight whales', () => {
  for (const [text, expected] of [
    ['深 海 蓝 鲸', ['深', '海', '蓝', '鲸']],
    ['Whale Ocean', ['W', 'h', 'a', 'l', 'e', 'O', 'c', 'e', 'a', 'n']],
    ['鲸 🐋 🧭', ['鲸', '🐋', '🧭']],
  ]) {
    assert.deepEqual(glyphSequence(text), expected);
    for (let count = 1; count <= 8; count++) {
      const population = createScene(count, text);
      assert.deepEqual(population, createScene(count, text));
      for (const [index, p] of population.particles.entries()) {
        assert.equal(p.glyph, expected[index % expected.length]);
        assert.doesNotMatch(p.glyph, /[\uD800-\uDFFF]/u, 'no isolated surrogate halves');
      }
      for (const whale of population.whales) {
        const particles = population.particles.filter(p => p.whale === whale.id);
        for (const part of ['body', 'fin', 'fluke', 'eye', 'mouth', ...(whaleSpecies(whale.species).dorsal ? ['dorsal'] : [])]) {
          const members = particles.filter(p => p.part === part);
          assert.ok(members.length > 0, `${count} whales missing ${part}`);
          assert.ok(members.every(p => expected.includes(p.glyph)), `${part} uses only user glyphs`);
        }
        assert.equal(particles.some(p => p.material === 'pleat' && expected.includes(p.glyph)), whaleSpecies(whale.species).pleats);
      }
    }
  }
});

test('emoji sequences and combining characters remain whole glyphs', () => {
  const expected = ['👩🏽‍🚀', 'e\u0301', '🐋'];
  assert.deepEqual(glyphSequence('👩🏽‍🚀 e\u0301 🐋'), expected);
  const population = createScene(2, '👩🏽‍🚀 e\u0301 🐋');
  assert.ok(population.particles.every(p => expected.includes(p.glyph)));
});

test('one to eight whales retain solid surface anatomy and stable particle identities within budget', () => {
  for (let count = 1; count <= 8; count++) {
    const population = createScene(count);
    assert.equal(population.whales.length, count);
    assert.ok(population.particles.length >= 2000 && population.particles.length <= 8000);
    assert.deepEqual(population.particles.map(p => p.id), Array.from({ length: population.particles.length }, (_, i) => i));
    for (const whale of population.whales) {
      const particles = population.particles.filter(p => p.whale === whale.id);
      const body = particles.filter(p => p.part === 'body');
      assert.ok(body.length > particles.length * 0.65);
      const anatomy = whaleSpecies(whale.species);
      assert.ok(body.some(p => p.x > 0.7 && Math.abs(p.z) > 0.06), 'head has lateral volume');
      assert.equal(body.some(p => p.material === 'pleat'), anatomy.pleats);
      for (const side of [-1, 1]) {
        assert.ok(particles.some(p => p.part === 'fin' && p.z * side > anatomy.flipper.tip[2] * 0.9));
        assert.ok(particles.some(p => p.part === 'fluke' && p.z * side > anatomy.fluke.span * 0.9 && Math.abs(p.y) < 0.05));
      }
      assert.equal(particles.some(p => p.part === 'dorsal'), !!anatomy.dorsal);
      for (const p of particles) {
        assert.ok(['探', '索', '未', '至', '之', '境'].includes(p.glyph));
        assert.ok([p.x, p.y, p.z, p.nx, p.ny, p.nz].every(Number.isFinite));
        close(Math.hypot(p.nx, p.ny, p.nz), 1);
        if (p.part === 'body') assert.ok(p.ny * p.y + p.nz * p.z > 0, 'body normals face outward');
      }
    }
  }
  assert.ok(scene.particles.length / 3 >= 1500);
  assert.deepEqual(createScene(3), scene);
});

test('perspective makes a raised surface larger and safely clips at the overhead camera near bound', () => {
  const pose = { ...unrotated(), cp: 0, sp: 1 };
  const sample = y => surfacePoint({ y, ny: -1, nz: 0 });
  const near = projectParticle(sample(-1), pose);
  const far = projectParticle(sample(1), pose);
  assert.ok(near.x - pose.x > far.x - pose.x);
  assert.ok(near.perspective > far.perspective);
  assert.ok(near.z < far.z);
  assert.ok(near.visibility > 0.95, 'dorsal normal faces the overhead camera');
  assert.equal(projectParticle({ ...sample(0), ny: 1 }, pose).visibility, 0);
  for (const y of [-100, -8, -7.2, -7.19, 0, 100]) {
    const projected = projectParticle(sample(y), pose);
    assert.ok(Object.values(projected).every(Number.isFinite));
    assert.ok(projected.z >= pose.near);
    assert.ok(projected.perspective <= pose.focal / pose.near);
    if (y <= -7.2) assert.equal(projected.visibility, 0);
  }
});

test('yaw and pitch rotate a volume, and material and directional lighting distinguish anatomy', () => {
  const pose = unrotated(), p = surfacePoint({ x: 0.7, y: 0.15, z: 0.16 });
  const original = transformParticle(p, pose);
  const yawed = transformParticle(p, { ...pose, cy: Math.cos(0.8), sy: Math.sin(0.8) });
  const pitched = transformParticle(p, { ...pose, cp: Math.cos(0.6), sp: Math.sin(0.6) });
  assert.ok(Math.abs(original.z - yawed.z) > 30);
  assert.ok(Math.abs(original.x - yawed.x) > 5);
  assert.ok(Math.abs(original.y - pitched.y) > 5);
  assert.ok(Math.abs(original.z - pitched.z) > 5);
  const overhead = { ...pose, cp: 0, sp: 1 };
  const back = projectParticle(surfacePoint({ y: -0.2, ny: -0.7, nz: -0.7 }), overhead);
  const belly = projectParticle(surfacePoint({ y: 0.2, ny: 0.7, nz: -0.7 }), overhead);
  assert.ok(back.light < belly.light - 0.25);
  const skin = projectParticle(surfacePoint(), overhead);
  const eye = projectParticle(surfacePoint({ material: 'eye' }), overhead);
  const pleat = projectParticle(surfacePoint({ material: 'pleat' }), overhead);
  assert.ok(eye.light < pleat.light && pleat.light < skin.light);
  const head = surfacePoint({ x: 0.8 }), tail = surfacePoint({ x: -1 });
  const phases = Array.from({ length: 16 }, (_, i) => i * Math.PI / 8);
  const stroke = point => {
    const values = phases.map(wave => transformParticle(point, { ...pose, wave }).y);
    return Math.max(...values) - Math.min(...values);
  };
  assert.ok(stroke(head) < stroke(tail) * 0.25, 'stroke grows towards the tail while the head stays comparatively steady');
  assert.ok(stroke(tail) > 1);
});

test('complete surface triangles fill covered character cells between sparse vertices', () => {
  const grid = createDepthGrid(120, 120, 9);
  const points = [[0, 0], [110, 0], [0, 110], [110, 110]].map(([x, y]) => ({ x, y, z: 200, visibility: 1, light: 0.75 }));
  resolveDepthGrid(points, grid, new Uint16Array([0, 1, 2, 1, 3, 2]));
  const occupied = Array.from(grid.owners).filter(owner => owner >= 0);
  assert.ok(occupied.length >= 70, `full face should fill the interior, only ${occupied.length} cells filled`);
  const center = Math.floor(55 / grid.cellHeight) * grid.columns + Math.floor(55 / grid.cellWidth);
  assert.equal(grid.coverage[center], 1);
  assert.ok(grid.owners[center] >= 0, 'interior is rendered even though no mesh vertex lies there');
  const nearPoints = points.concat(points.map(p => ({ ...p, z: 100, light: 0.3 })));
  resolveDepthGrid(nearPoints, grid, new Uint16Array([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]));
  assert.ok(grid.owners[center] >= 4, 'nearer whole surface covers the farther one');
});

test('full-width glyph cells keep the nearest surface without reordering particle identities', () => {
  const grid = createDepthGrid(160, 100, 9);
  assert.ok(grid.cellWidth >= 11 && grid.cellWidth <= 12);
  assert.ok(grid.cellHeight >= 13 && grid.cellHeight <= 14);
  const projected = [
    { particleIndex: 20, x: 40, y: 40, z: 800, visibility: 1 },
    { particleIndex: 21, x: 40.1, y: 40.1, z: 400, visibility: 0.9 },
    { particleIndex: 22, x: 40, y: 40, z: 200, visibility: 0 },
    { particleIndex: 23, x: -1, y: 40, z: 900, visibility: 1 },
  ];
  resolveDepthGrid(projected, grid);
  projected.forEach((p, index) => close(p.surfaceVisibility, [0, 0.9, 0, 0][index], 1e-6));
  const owners = grid.owners;
  const order = projected.map((_, i) => i).sort((a, b) => projected[b].z - projected[a].z);
  assert.deepEqual(order.map(i => projected[i].particleIndex), [23, 20, 21, 22]);
  assert.deepEqual(projected.map(p => p.particleIndex), [20, 21, 22, 23]);
  projected[1].x = 100;
  resolveDepthGrid(projected, grid);
  assert.equal(grid.owners, owners, 'grid reuses its buffers');
  close(projected[0].surfaceVisibility, 1);
  const actual = scene.particles.map((p, particleIndex) => projectParticle(p,
    whalePose(scene.whales[p.whale], 0, 1600, 900, 0.65), { particleIndex }));
  resolveDepthGrid(actual, createDepthGrid(1600, 900, 13));
  assert.ok(actual.filter(p => p.surfaceVisibility > 0).length > 200, '3D surface remains populated after occlusion');
  assert.deepEqual(scene.particles.map(p => p.id), actual.map(p => p.particleIndex));
});

test('canvas allocations respect DPR and pixel caps, and reading and input areas remain protected', () => {
  for (const [w, h] of [[0, 0], [800, 600], [3840, 2160], [10000, 10000]]) {
    const pixels = fitCanvas(w, h, 3);
    assert.ok(pixels.width * pixels.height <= 12000000);
    assert.ok(pixels.ratio <= 2);
  }
  close(attenuation(400, 580, 800, 600, true), 0);
  close(attenuation(-1, 100, 800, 600, true), 0);
  close(attenuation(801, 100, 800, 600, true), 0);
  assert.ok(attenuation(400, 300, 800, 600, true) < attenuation(400, 300, 800, 600, false));
});

test('manifest ships the glyph-whale runtime and matching configuration locales without install scripts', async () => {
  const root = new URL('./', import.meta.url), read = name => readFile(new URL(name, root), 'utf8');
  const manifest = JSON.parse(await read('package.json'));
  assert.equal(manifest.name, '@local/dsh-ascii-ocean');
  assert.equal(manifest.version, '0.13.0');
  assert.equal(manifest.dependencies['@deepseek-ai/schemastery'], '3.18.5');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.deepEqual(Object.keys(manifest.scripts).sort(), ['build', 'check', 'test']);
  assert.deepEqual(Object.keys(engine), ['createWhaleLayer', 'diffWhaleConfig', 'mountWhales']);
  for (const name of manifest.files.filter(name => !name.includes('*'))) assert.ok((await stat(new URL(name, root))).isFile());
  // Every module the shipped runtime imports must itself ship, or the installed
  // plugin fails at load time while the workspace copy keeps working.
  for (const name of ['index.js', 'client.js', 'engine.js', 'settings.js', 'model.js', 'surface.js', 'glass.js']) {
    const source = await read(name);
    for (const [, specifier] of source.matchAll(/from '\.\/([\w.-]+\.js)'/g)) {
      assert.ok(manifest.files.includes(specifier), `${name} imports ${specifier}, which package.json does not ship`);
    }
  }
  const en = JSON.parse(await read('locale/en.json')), zh = JSON.parse(await read('locale/zh.json'));
  assert.deepEqual(Object.keys(en.ui).sort(), Object.keys(zh.ui).sort());
  const settingKeys = Object.keys(en.ui).filter(key => key.endsWith('Hint')).map(key => key.slice(0, -4)).sort();
  assert.deepEqual(settingKeys, Object.keys(FIELDS).sort());
  for (const key of Object.keys(FIELDS)) assert.ok(en.ui[key] && zh.ui[`${key}Hint`]);
  assert.equal(en.meta.title, 'Glyph whales');
  assert.equal(zh.meta.title, '文字蓝鲸');
  assert.equal(en.ui.title, en.meta.title);
  assert.equal(zh.ui.title, zh.meta.title);
  assert.equal(zh.ui.text, '鱼身文字');
  for (const locale of [en, zh]) assert.ok(locale.meta.description);
  const icon = await read('icon.svg');
  // The artwork has been redrawn at different square sizes; the contract is a
  // self-contained square SVG icon, not one fixed viewBox number.
  const viewBox = /<svg[^>]+viewBox="0 0 (\d+) \1"/.exec(icon);
  assert.ok(viewBox, 'icon.svg must declare a square viewBox');
  assert.ok(Number(viewBox[1]) >= 16 && Number(viewBox[1]) <= 512, 'icon viewBox size out of range');
  assert.ok(Buffer.byteLength(icon) < 256 * 1024);
  assert.doesNotMatch(icon, /(?:<script|<image|href=)/);
  const client = await read('client.js');
  assert.match(client, /id: '@local\/dsh-ascii-ocean'/);
  assert.doesNotMatch(client, /^import |^export |require\(['"]@deepseek-ai\//m);
  const host = await read('index.js'), settings = await read('settings.js'), patch = await read('cordis.patch.yml');
  assert.match(host, /Object\.entries\(FIELDS\)/);
  assert.match(settings, /configForms\.get\('ascii-whale-background'\)/);
  assert.match(patch, /ascii-whale-background/);
});

