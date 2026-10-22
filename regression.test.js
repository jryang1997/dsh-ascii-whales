import test from 'node:test';
import assert from 'node:assert/strict';
import * as model from './model.js';

test('CJK glyphs on adjacent cell edges have non-overlapping painted bounds', () => {
  const grid = model.createDepthGrid(160, 100, 13);
  const points = [
    { x: grid.cellWidth - 0.2, y: 32, z: 500, visibility: 1 },
    { x: grid.cellWidth + 0.2, y: 32, z: 500, visibility: 1 },
  ];
  model.resolveDepthGrid(points, grid);
  const drawn = points.filter(p => p.surfaceVisibility > 0);
  assert.equal(drawn.length, 2);
  const distance = Math.abs((drawn[0].drawX ?? drawn[0].x) - (drawn[1].drawX ?? drawn[1].x));
  assert.ok(distance >= 9, `9px Chinese glyph centers are only ${distance.toFixed(2)}px apart`);
});

test('default glyph ink stays visible through the reading-area attenuation', () => {
  const alpha = model.glyphOpacity
    ? model.glyphOpacity(model.DEFAULTS.opacity, 0.5, 1, model.attenuation(800, 360, 1600, 900, true))
    : model.DEFAULTS.opacity * 0.5 * 1 * 1 * model.attenuation(800, 360, 1600, 900, true);
  assert.ok(alpha >= 0.12, `default central glyph alpha is ${alpha.toFixed(3)}`);
});

test('a whale freely changes its horizontal and vertical travel directions', () => {
  assert.equal(typeof model.stepScene, 'function', 'the renderer has no evolving steering state; the route is a fixed x-driven diagonal');
  const scene = model.createScene(1);
  model.resizeScene(scene, 1200, 800);
  const headings = new Set();
  let last = { x: scene.whales[0].x, y: scene.whales[0].y };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let frame = 0; frame < 60 * 120; frame++) {
    model.stepScene(scene, 1 / 60, 1);
    const whale = scene.whales[0];
    const dx = whale.x - last.x, dy = whale.y - last.y;
    if (Math.hypot(dx, dy) > 0.01) headings.add(`${Math.sign(dx)},${Math.sign(dy)}`);
    minX = Math.min(minX, whale.x); maxX = Math.max(maxX, whale.x);
    minY = Math.min(minY, whale.y); maxY = Math.max(maxY, whale.y);
    last = { x: whale.x, y: whale.y };
  }
  assert.ok(headings.size >= 3, `visited only ${headings.size} direction quadrants`);
  assert.ok(maxX - minX > 600 && maxY - minY > 300, 'whale did not explore the available area');
});
