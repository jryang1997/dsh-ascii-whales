import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULTS, FIELDS, normalizeConfig, configSignature, createScene, resizeScene,
  whalePose, projectParticle, createDepthGrid, resolveDepthGrid } from '../src/model.js';
import { createInkPalette, glyphInkIndex } from '../src/shading.js';
import { createCellPalette, createWhalePainter } from '../src/surface.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { resetWhaleRig } from '../src/rig.js';

const colors = scene => scene.whales.map(whale => whale.colorIndex);
const rgb = value => {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(value);
  assert.ok(match, `expected opaque RGB: ${value}`);
  const channels = match.slice(1).map(Number);
  assert.ok(channels.every(channel => channel >= 0 && channel <= 255));
  return channels;
};
const luminance = channels => channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;

function schoolFrame(extra = {}) {
  const config = normalizeConfig({ count: 8, color: 'rainbow', text: '鲸海', quietCenter: false, opacity: 0.9, ...extra });
  const scene = createScene(8, config.text, 'mixed', 1, 1592594996);
  resizeScene(scene, 1600, 900);
  const poses = scene.whales.map((whale, index) => {
    Object.assign(whale, { x: 200 + index % 4 * 400, y: index < 4 ? 250 : 650,
      heading: 0, turn: 0, depth: 0.14, length: 270 });
    resetWhaleRig(whale);
    const pose = whalePose(whale, 0, 1600, 900, 0);
    pose.stroke = 0;
    return pose;
  });
  const painter = createWhalePainter(scene, config);
  const grid = createDepthGrid(1600, 900, config.glyphSize, { square: painter.square });
  const projected = scene.particles.map(particle => projectParticle(particle, poses[particle.whale]));
  resolveDepthGrid(projected, grid, scene.triangles, scene.decals);
  return { scene, config, poses, grid, painter };
}

function paint(frame, dark = false) {
  const operations = [];
  const ownerAt = (x, y) => {
    const cell = Math.floor(y / frame.grid.cellHeight) * frame.grid.columns + Math.floor(x / frame.grid.cellWidth);
    return frame.scene.particles[frame.grid.owners[cell]].whale;
  };
  const context = {
    fillStyle: '', globalAlpha: 1,
    fillText(glyph, x, y) {
      operations.push({ kind: 'glyph', whale: ownerAt(x, y), glyph, color: this.fillStyle, alpha: this.globalAlpha, x, y });
    },
    fillRect(x, y, width, height) {
      operations.push({ kind: 'tile', whale: ownerAt(x, y), color: this.fillStyle, alpha: this.globalAlpha, x, y, width, height });
    },
  };
  frame.painter.paint(context, frame.grid, frame.poses, 1600, 900, 1, null, dark);
  assert.equal(context.globalAlpha, 1);
  return operations;
}

test('random per-whale colors survive normalization, saved-config round trips and both locale menus', async () => {
  assert.ok(FIELDS.color.values.includes('rainbow'));
  assert.equal(DEFAULTS.color, 'ocean');
  for (const color of FIELDS.color.values) assert.equal(normalizeConfig({ color }).color, color);
  const config = normalizeConfig({ color: 'rainbow' });
  const saved = JSON.parse(JSON.stringify(config));
  assert.equal(saved.color, 'rainbow');
  assert.equal(configSignature(saved), configSignature(config));
  for (const language of ['en', 'zh']) {
    const locale = JSON.parse(await readFile(new URL(`../locale/${language}.json`, import.meta.url), 'utf8'));
    for (const color of FIELDS.color.values) assert.ok(locale.ui[color], `${language} is missing ${color}`);
  }
});

test('seeded schools assign eight different colors and retain each identity across body and count rebuilds', () => {
  const assignments = new Set();
  for (const seed of [0, 1, 42, 1592594996, 0xffffffff]) {
    const initial = createScene(8, '鲸', 'mixed', 1, seed), expected = colors(initial);
    assert.equal(initial.colorSeed, seed);
    assert.deepEqual([...expected].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7]);
    assignments.add(expected.join(','));
    for (const count of [1, 3, 5, 8]) {
      const rebuilt = createScene(count, '另一种文字🐋', 'humpback', 1.3, initial.colorSeed);
      assert.deepEqual(colors(rebuilt), expected.slice(0, count));
    }
    resizeScene(initial, 700, 500);
    assert.deepEqual(colors(initial), expected);
  }
  assert.ok(assignments.size > 1, 'different scene seeds must produce different color orders');
  assert.deepEqual(createScene(1), createScene(1), 'the unseeded model remains deterministic');
});

test('each whale palette caches a shaded body hue while environment palettes stay ocean', () => {
  const inkMids = new Set(), cellMids = new Set();
  for (let color = 0; color < 8; color++) {
    const ink = createInkPalette('rainbow', color), cells = createCellPalette('rainbow', color);
    assert.strictEqual(ink, createInkPalette('rainbow', color));
    assert.strictEqual(cells, createCellPalette('rainbow', color));
    assert.ok(Object.isFrozen(ink) && Object.isFrozen(cells));
    assert.equal(ink.length, 512);
    assert.equal(cells.length, 2048);
    inkMids.add(ink[glyphInkIndex(0.5, 0.14)]);
    cellMids.add(cells[glyphInkIndex(0.5, 0.14)].background);
    for (let depth = 0; depth < 16; depth++) {
      const row = depth * 32;
      assert.ok(luminance(rgb(ink[row + 31])) > luminance(rgb(ink[row])) + 90, `ink relief for hue ${color}`);
      for (let shade = 1; shade < 32; shade++) {
        assert.ok(luminance(rgb(ink[row + shade])) > luminance(rgb(ink[row + shade - 1])));
      }
      for (let variant = 0; variant < 4; variant++) {
        const offset = variant * 512 + row;
        assert.ok(cells[offset + 31].luminance > cells[offset].luminance + 90);
        for (let shade = 1; shade < 32; shade++) {
          assert.ok(cells[offset + shade].luminance > cells[offset + shade - 1].luminance);
          rgb(cells[offset + shade].background);
        }
      }
    }
    assert.ok(luminance(rgb(ink[480])) > luminance(rgb(ink[0])));
    assert.ok(cells[480].luminance > cells[0].luminance);
  }
  assert.equal(inkMids.size, 8);
  assert.equal(cellMids.size, 8);
  for (const index of [undefined, null, -1, 8, 1.5, NaN, Infinity, '2', {}, Symbol()]) {
    assert.strictEqual(createInkPalette('rainbow', index), createInkPalette('ocean'));
    assert.strictEqual(createCellPalette('rainbow', index), createCellPalette('ocean'));
  }
});

test('all four render modes paint eight stable shaded whale colors on light and dark pages without drawing random numbers', t => {
  t.mock.method(Math, 'random', () => { throw new Error('rendering must not reroll whale colors'); });
  for (const renderStyle of ['glyphs', 'cells']) for (const fillMode of ['custom', 'ascii']) {
    const frame = schoolFrame({ renderStyle, fillMode });
    for (const dark of [false, true]) {
      const operations = paint(frame, dark);
      assert.deepEqual(paint(frame, dark), operations, 'identical frames preserve all colors');
      frame.painter = createWhalePainter(frame.scene, { ...frame.config });
      assert.deepEqual(paint(frame, dark), operations, 'rebuilding a painter preserves whale colors');
      const signatures = new Set();
      for (const whale of frame.scene.whales) {
        const body = operations.filter(op => op.whale === whale.id);
        const colored = body.filter(op => op.kind === (renderStyle === 'cells' ? 'tile' : 'glyph'));
        assert.ok(colored.length > 10, `whale ${whale.id} must be visible`);
        const used = [...new Set(colored.map(op => op.color))].sort();
        assert.ok(used.length > 5, `whale ${whale.id} must retain body shading`);
        const allowed = new Set(renderStyle === 'cells'
          ? createCellPalette('rainbow', whale.colorIndex).map(cell => cell.background)
          : createInkPalette('rainbow', whale.colorIndex));
        assert.ok(used.every(color => allowed.has(color)), `whale ${whale.id} used another whale's palette`);
        signatures.add(used.join('|'));
        const glyphs = body.filter(op => op.kind === 'glyph');
        if (fillMode === 'custom') assert.ok(glyphs.every(op => ['鲸', '海'].includes(op.glyph)));
        if (renderStyle === 'cells') assert.ok(glyphs.some(op => ['#122635', '#f2f6fa'].includes(op.color)));
      }
      assert.equal(signatures.size, 8, 'each visible whale has its own color ramp');
      assert.ok(operations.every(op => Number.isFinite(op.alpha) && op.alpha > 0 && op.alpha <= 1));
    }
  }
});

test('simulation preserves random colors through saves, unrelated settings, resizing and scene reconstruction', () => {
  const initial = normalizeConfig({ color: 'rainbow', count: 3 });
  const simulation = createWhaleSimulation(initial, { seed: 1592594996 });
  const expected = colors(simulation.scene), original = simulation.scene;
  assert.equal(simulation.scene.colorSeed, 1592594996);
  const saved = normalizeConfig(JSON.parse(JSON.stringify(initial)));
  assert.equal(simulation.update(saved), false);
  assert.strictEqual(simulation.scene, original);
  simulation.advance(1 / 30);
  simulation.resize(900, 600);
  assert.deepEqual(colors(simulation.scene), expected);
  const unrelated = { ...saved, speed: 1.2, opacity: 0.75, glassStrength: 0.8 };
  assert.equal(simulation.update(unrelated), false);
  assert.deepEqual(colors(simulation.scene), expected);
  const rebuilt = { ...unrelated, text: '配色不变', whaleSize: 1.3, species: 'humpback', count: 8 };
  assert.equal(simulation.update(rebuilt), true);
  const grown = colors(simulation.scene);
  assert.deepEqual(grown.slice(0, 3), expected);
  assert.equal(new Set(grown).size, 8);
  assert.equal(simulation.scene.colorSeed, original.colorSeed);
  assert.equal(simulation.update({ ...rebuilt, color: 'ocean' }), false);
  assert.equal(simulation.update(rebuilt), false);
  assert.deepEqual(colors(simulation.scene), grown, 'switching away and back does not reroll');
  assert.equal(simulation.update({ ...rebuilt, count: 1 }), true);
  assert.deepEqual(colors(simulation.scene), grown.slice(0, 1));
  assert.equal(simulation.update(rebuilt), true);
  assert.deepEqual(colors(simulation.scene), grown, 'removing and adding whales preserves the color order');
  simulation.dispose();
});
