import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeConfig, createScene, resizeScene, whalePose, projectParticle, createDepthGrid, resolveDepthGrid } from '../src/model.js';
import { createWhalePainter, surfaceGlyph, createCellPalette, ASCII_RAMP } from '../src/surface.js';
import { resetWhaleRig } from '../src/rig.js';

function frame(config = {}) {
  config = { ...DEFAULTS, ...config, quietCenter: false };
  const scene = createScene(1, config.text, 'blue'), whale = scene.whales[0];
  resizeScene(scene, 1000, 600);
  Object.assign(whale, { x: 500, y: 300, heading: 0, turn: 0, length: 580 });
  resetWhaleRig(whale);
  const pose = whalePose(whale, 0, 1000, 600, 0); pose.stroke = 0;
  const painter = createWhalePainter(scene, config);
  const grid = createDepthGrid(1000, 600, config.glyphSize, { square: painter.square });
  resolveDepthGrid(scene.particles.map(p => projectParticle(p, pose)), grid, scene.triangles, scene.decals);
  return { scene, config, grid, poses: [pose], painter };
}

function recordPaint(sample, fade = null, dark = false, ratio = 1) {
  const operations = [];
  const context = {
    fillStyle: '', globalAlpha: 1,
    fillText(glyph, x, y, maxWidth) { operations.push({ kind: 'glyph', glyph, x, y, maxWidth, color: this.fillStyle, alpha: this.globalAlpha }); },
    fillRect(x, y, width, height) { operations.push({ kind: 'tile', x, y, width, height, color: this.fillStyle, alpha: this.globalAlpha }); },
  };
  sample.painter.paint(context, sample.grid, sample.poses, 1000, 600, ratio, fade, dark);
  assert.equal(context.globalAlpha, 1);
  return operations;
}

test('old settings retain their text, palette and pure-glyph appearance; the two options normalize independently', () => {
  const saved = { text: '原有文字🐋', opacity: 0.7, color: 'indigo', glass: true, glassStrength: 0.8 };
  const config = normalizeConfig(saved);
  assert.equal(config.renderStyle, 'glyphs'); assert.equal(config.fillMode, 'custom');
  for (const key of Object.keys(saved)) assert.equal(config[key], saved[key]);
  assert.equal(normalizeConfig({ renderStyle: 'unknown', fillMode: 'unknown' }).renderStyle, 'glyphs');
  for (const renderStyle of ['glyphs', 'cells']) for (const fillMode of ['custom', 'ascii']) {
    const value = normalizeConfig({ ...saved, renderStyle, fillMode });
    assert.equal(value.renderStyle, renderStyle); assert.equal(value.fillMode, fillMode); assert.equal(value.text, saved.text);
  }
});

test('the renderer implements all four combinations, with custom glyphs preserved and ASCII selected at draw time', () => {
  for (const renderStyle of ['glyphs', 'cells']) for (const fillMode of ['custom', 'ascii']) {
    const sample = frame({ renderStyle, fillMode, text: '鲸海🐋' });
    const operations = recordPaint(sample), glyphs = operations.filter(op => op.kind === 'glyph'), tiles = operations.filter(op => op.kind === 'tile');
    assert.ok(glyphs.length > 80);
    if (renderStyle === 'cells') {
      assert.ok(tiles.length > 60);
      assert.ok(new Set(tiles.map(op => op.color)).size > 12, 'colored cells have no relief or color variation');
    } else assert.equal(tiles.length, 0);
    const alphabet = fillMode === 'ascii' ? Array.from(ASCII_RAMP) : ['鲸', '海', '🐋'];
    assert.ok(glyphs.every(op => alphabet.includes(op.glyph)));
    assert.ok(sample.scene.particles.every(p => ['鲸', '海', '🐋'].includes(p.glyph)), 'ASCII overwrote the saved body text');
  }
});

test('ASCII density follows the darker raised surface and does not depend on time or random state', () => {
  const particle = { x: 0.3, y: -0.2, z: 0.1, whale: 0, part: 'body', glyph: '鲸' };
  const dark = surfaceGlyph(particle, 0.15, 1, 'ascii'), light = surfaceGlyph(particle, 0.85, 1, 'ascii');
  assert.ok(ASCII_RAMP.indexOf(dark) > ASCII_RAMP.indexOf(light));
  for (let call = 0; call < 20; call++) assert.equal(surfaceGlyph(particle, 0.15, 1, 'ascii'), dark);
  assert.equal(surfaceGlyph(particle, 0.15, 0.2, 'ascii'), '.');
  assert.equal(surfaceGlyph(particle, 0.15, 0.4, 'ascii'), ':');
  assert.equal(surfaceGlyph(particle, 0.15, 0.2, 'custom'), '鲸');
});

test('square cells accommodate wide or tall custom glyphs without changing the old text-only grid', () => {
  const measured = { width: 29.8, height: 18.6, square: true };
  const grid = createDepthGrid(800, 600, 11, measured);
  assert.equal(grid.cellWidth, grid.cellHeight);
  assert.ok(grid.cellWidth >= measured.width + 2 && grid.cellHeight >= measured.height + 2);
  const legacy = createDepthGrid(800, 600, 11);
  assert.equal(legacy.cellWidth, 13); assert.equal(legacy.cellHeight, 16);
});

test('cell palettes cache colors and preserve shading and depth order in every hue variant', () => {
  for (const name of ['ocean', 'azure', 'indigo']) {
    const palette = createCellPalette(name);
    assert.equal(palette, createCellPalette(name)); assert.ok(Object.isFrozen(palette));
    assert.equal(palette.length, 2048);
    for (let variant = 0; variant < 4; variant++) {
      const start = variant * 512;
      assert.ok(palette[start].luminance < palette[start + 31].luminance - 120);
      assert.ok(palette[start].luminance < palette[start + 480].luminance - 30, 'deep water must be paler');
      for (let shade = 1; shade < 32; shade++) assert.ok(palette[start + shade].luminance >= palette[start + shade - 1].luminance);
    }
  }
  assert.equal(createCellPalette('invalid'), createCellPalette('ocean'));
});

test('partial silhouette cells stay glyph-only and the reading-pane fade removes tiles together with letters', () => {
  const sample = frame({ renderStyle: 'cells', fillMode: 'ascii' });
  const operations = recordPaint(sample);
  const tileCells = new Set(operations.filter(op => op.kind === 'tile').map(op => `${Math.floor(op.x / sample.grid.cellWidth)},${Math.floor(op.y / sample.grid.cellHeight)}`));
  for (let cell = 0; cell < sample.grid.owners.length; cell++) {
    if (sample.grid.owners[cell] < 0 || sample.grid.coverage[cell] >= 0.6) continue;
    const key = `${cell % sample.grid.columns},${Math.floor(cell / sample.grid.columns)}`;
    assert.ok(!tileCells.has(key), 'a partially covered cell expanded into a solid block');
  }
  assert.deepEqual(recordPaint(sample, () => 0), []);
  const faded = recordPaint(sample, x => x < 500 ? 0 : 1);
  assert.ok(faded.length > 0);
  assert.ok(faded.filter(op => op.kind === 'glyph').every(op => op.x >= 500));
});

test('tile and character contrast accounts for actual opacity and page theme', () => {
  const high = frame({ renderStyle: 'cells', fillMode: 'ascii', opacity: 0.9 });
  const lightPage = recordPaint(high), darkPage = recordPaint(high, null, true);
  assert.ok(lightPage.some(op => op.kind === 'glyph' && op.color === '#f2f6fa'));
  assert.ok(lightPage.some(op => op.kind === 'glyph' && op.color === '#122635'));
  assert.ok(darkPage.some(op => op.kind === 'glyph' && op.color === '#f2f6fa'));
  const faint = recordPaint(frame({ renderStyle: 'cells', fillMode: 'ascii', opacity: 0.1 }));
  assert.ok(faint.filter(op => op.kind === 'glyph' && ['#f2f6fa', '#122635'].includes(op.color)).every(op => op.color === '#122635'));
});

test('subpixel device scales leave positive square tile bounds with a one-pixel seam', () => {
  const sample = frame({ renderStyle: 'cells', fillMode: 'ascii' });
  for (const ratio of [1, 1.25, 1.5, 2]) {
    const tiles = recordPaint(sample, null, false, ratio).filter(op => op.kind === 'tile');
    assert.ok(tiles.every(op => op.width > 0 && op.height > 0));
    assert.ok(tiles.every(op => op.width <= sample.grid.cellWidth && op.height <= sample.grid.cellHeight));
  }
});
