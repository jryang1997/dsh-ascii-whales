import test from 'node:test';
import assert from 'node:assert/strict';
import { createReefField, resizeReefField, reefObstacles, drawReefs } from './reef.js';
import { createInkPalette } from './shading.js';

const WIDTH = 1280;
const HEIGHT = 800;
const createField = (seed = 42, count = 3) => createReefField({ width: WIDTH, height: HEIGHT, seed, count });
const allowedGlyphs = new Set(['@', '%', '#', '*', '+', ':', '.', '·']);

/**
 * Stand-in for a 2D context: records every call and the state it was drawn with.
 * drawReefs may only touch font, fillStyle, globalAlpha, textAlign, textBaseline
 * and fillText, so anything else it might try would fail loudly here.
 */
function fakeTarget() {
  return {
    font: '',
    fillStyle: '',
    globalAlpha: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
    calls: [],
    fillText(text, x, y, maxWidth) {
      this.calls.push({ text, x, y, maxWidth, font: this.font,
        fillStyle: this.fillStyle, alpha: this.globalAlpha,
        textAlign: this.textAlign, textBaseline: this.textBaseline });
    },
  };
}

function drawOptions(palette, overrides = {}) {
  return { width: WIDTH, height: HEIGHT, cellWidth: 11, cellHeight: 13, ratio: 2,
    font: '600 11px "Cascadia Mono", monospace', palette, opacity: 0.6,
    fade: () => 1, ...overrides };
}

function assertFiniteReef(reef) {
  assert.ok(Number.isFinite(reef.x) && Number.isFinite(reef.y), 'reef centre is finite');
  assert.ok(Number.isFinite(reef.radius) && reef.radius > 0, 'reef radius is a finite positive number');
  assert.ok((reef.seed >>> 0) === reef.seed, 'reef seed is an unsigned integer');
  assert.ok(reef.lobes.length === 2 || reef.lobes.length === 3, 'one main stone plus one or two satellites');
  for (const lobe of reef.lobes) {
    assert.ok(Number.isFinite(lobe.dx) && Number.isFinite(lobe.dy), 'lobe offset is finite');
    assert.ok(Number.isFinite(lobe.r) && lobe.r > 0, 'lobe radius is finite and positive');
  }
}

test('the same seed and size always produce the same field', () => {
  const first = createField(1234, 3);
  const second = createField(1234, 3);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.reefs, second.reefs, 'each call returns its own objects');
  assert.equal(first.seed, 1234);
  assert.equal(first.width, WIDTH);
  assert.equal(first.height, HEIGHT);
});

test('a different seed produces a different layout', () => {
  const first = createField(1, 3);
  const second = createField(2, 3);
  assert.notDeepEqual(first.reefs, second.reefs);
  assert.notDeepEqual(first.reefs.map(reef => [reef.x, reef.y, reef.radius]),
    second.reefs.map(reef => [reef.x, reef.y, reef.radius]));
});

test('rocks alternate between the outer bands and stay on the canvas', () => {
  const field = createField(77, 4);
  assert.equal(field.reefs.length, 4);
  const minSide = Math.min(WIDTH, HEIGHT);
  field.reefs.forEach((reef, index) => {
    assertFiniteReef(reef);
    const nx = reef.x / WIDTH, ny = reef.y / HEIGHT;
    if (index % 2 === 0) assert.ok(nx >= 0.02 && nx <= 0.10, `left band, got nx=${nx}`);
    else assert.ok(nx >= 0.90 && nx <= 0.98, `right band, got nx=${nx}`);
    assert.ok(ny >= 0.16 && ny <= 0.78, `vertical band, got ny=${ny}`);
    // The radius follows the short side but never leaves the pixel clamp.
    assert.ok(reef.radius >= minSide * 0.05 - 1e-9);
    assert.ok(reef.radius <= minSide * 0.07 + 1e-9);
    assert.ok(reef.radius >= 26 - 1e-9 && reef.radius <= 72 + 1e-9);
    assert.ok(reef.x - reef.radius >= -1e-9, 'whole circumcircle is inside the left edge');
    assert.ok(reef.x + reef.radius <= WIDTH + 1e-9, 'whole circumcircle is inside the right edge');
    assert.ok(reef.y - reef.radius >= -1e-9, 'whole circumcircle is inside the top edge');
    assert.ok(reef.y + reef.radius <= HEIGHT + 1e-9, 'whole circumcircle is inside the bottom edge');
    // `radius` is documented as the cluster's outer radius.
    const bound = Math.max(...reef.lobes.map(lobe => Math.hypot(lobe.dx, lobe.dy) + lobe.r));
    assert.ok(Math.abs(bound - reef.radius) < 1e-9, `bounding radius ${bound} vs ${reef.radius}`);
    const main = reef.lobes[0];
    for (const lobe of reef.lobes.slice(1)) assert.ok(main.r > lobe.r, 'first lobe is the main stone');
  });
});

test('rock groups never overlap and keep the 14px gap', () => {
  for (const state of [{ seed: 3, count: 3 }, { seed: 8, count: 8 }, { seed: 130, count: 6 }]) {
    const field = createReefField({ width: WIDTH, height: HEIGHT, ...state });
    assert.equal(field.reefs.length, state.count);
    for (let first = 0; first < field.reefs.length; first++) {
      for (let second = first + 1; second < field.reefs.length; second++) {
        const a = field.reefs[first], b = field.reefs[second];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
        assert.ok(gap >= 14 - 1e-9, `gap ${gap} for rocks ${first}/${second}`);
      }
    }
  }
});

test('the central reading column between the bands stays clear', () => {
  for (const count of [3, 4, 6]) {
    const field = createField(5, count);
    for (const reef of field.reefs) {
      const clearsLeft = reef.x + reef.radius <= WIDTH * 0.30;
      const clearsRight = reef.x - reef.radius >= WIDTH * 0.70;
      assert.ok(clearsLeft || clearsRight, `reef at ${reef.x} enters the reading column`);
    }
  }
});

test('count defaults to three and is clamped to a safe range', () => {
  assert.equal(createReefField({ width: WIDTH, height: HEIGHT, seed: 9 }).reefs.length, 3);
  assert.equal(createReefField({ width: WIDTH, height: HEIGHT, seed: 9, count: 0 }).reefs.length, 1);
  assert.equal(createReefField({ width: WIDTH, height: HEIGHT, seed: 9, count: 99 }).reefs.length, 8);
});

test('resizing rescales the same rocks without rerolling them', () => {
  const field = createField(7, 4);
  const before = field.reefs.map(reef => ({
    nx: reef.x / WIDTH, ny: reef.y / HEIGHT, radius: reef.radius, seed: reef.seed,
    lobeRatios: reef.lobes.map(lobe => [lobe.dx / reef.radius, lobe.dy / reef.radius, lobe.r / reef.radius]),
  }));
  const enlarged = resizeReefField(field, 1920, 1200);
  assert.strictEqual(enlarged, field, 'resize mutates the field in place');
  assert.equal(field.width, 1920);
  assert.equal(field.height, 1200);
  assert.equal(field.reefs.length, before.length);
  const xScale = 1920 / WIDTH, yScale = 1200 / HEIGHT, rockScale = Math.min(xScale, yScale);
  field.reefs.forEach((reef, index) => {
    assert.ok(Math.abs(reef.x / 1920 - before[index].nx) < 1e-12, 'normalized x is preserved');
    assert.ok(Math.abs(reef.y / 1200 - before[index].ny) < 1e-12, 'normalized y is preserved');
    assert.equal(reef.seed, before[index].seed, 'no new random seed');
    assert.ok(Math.abs(reef.radius - before[index].radius * rockScale) < 1e-9);
    reef.lobes.forEach((lobe, lobeIndex) => {
      const ratios = before[index].lobeRatios[lobeIndex];
      assert.ok(Math.abs(lobe.dx / reef.radius - ratios[0]) < 1e-12);
      assert.ok(Math.abs(lobe.dy / reef.radius - ratios[1]) < 1e-12);
      assert.ok(Math.abs(lobe.r / reef.radius - ratios[2]) < 1e-12);
    });
  });
  // Scaling back restores the original normalized geometry.
  resizeReefField(field, WIDTH, HEIGHT);
  field.reefs.forEach((reef, index) => {
    assert.ok(Math.abs(reef.x - before[index].nx * WIDTH) < 1e-9);
    assert.ok(Math.abs(reef.y - before[index].ny * HEIGHT) < 1e-9);
  });
});

test('resizing to the same size changes nothing', () => {
  const field = createField(31, 3);
  const snapshot = structuredClone(field);
  resizeReefField(field, WIDTH, HEIGHT);
  assert.deepEqual(field, snapshot);
});

test('reefObstacles reports one finite circle per rock', () => {
  const field = createField(99, 4);
  const obstacles = reefObstacles(field);
  assert.equal(obstacles.length, field.reefs.length);
  obstacles.forEach((obstacle, index) => {
    const reef = field.reefs[index];
    assert.equal(obstacle.x, reef.x);
    assert.equal(obstacle.y, reef.y);
    assert.equal(obstacle.radius, reef.radius);
    assert.ok(Number.isFinite(obstacle.x) && Number.isFinite(obstacle.y));
    assert.ok(Number.isFinite(obstacle.radius) && obstacle.radius > 0);
  });
  assert.deepEqual(reefObstacles(null), []);
  assert.deepEqual(reefObstacles({}), []);
});

test('drawReefs paints ASCII cells with bounded alpha and palette ink', () => {
  const field = createField(11, 3);
  const palette = createInkPalette('ocean');
  const target = fakeTarget();
  const font = '600 11px "Cascadia Mono", monospace';
  const drawn = drawReefs(target, field, drawOptions(palette, { font }));

  assert.ok(drawn > 0, 'the field should draw at least one glyph');
  assert.equal(target.calls.length, drawn);
  assert.equal(target.font, font);
  assert.equal(target.textAlign, 'center');
  assert.equal(target.textBaseline, 'middle');
  for (const call of target.calls) {
    assert.ok(call.alpha > 0 && call.alpha <= 0.6 * 0.85 + 1e-9, `alpha ${call.alpha} outside (0, opacity*0.85]`);
    assert.ok(call.alpha <= 1);
    assert.ok(allowedGlyphs.has(call.text), `unexpected glyph ${JSON.stringify(call.text)}`);
    assert.ok(palette.includes(call.fillStyle), `fill ${call.fillStyle} is not from the ink palette`);
    assert.ok(Number.isFinite(call.x) && Number.isFinite(call.y));
    assert.ok(call.x >= 0 && call.x <= WIDTH && call.y >= 0 && call.y <= HEIGHT);
    assert.ok(Number.isFinite(call.maxWidth) && call.maxWidth > 0);
    assert.equal(call.font, font);
  }
  // A stone is shaded, not flat: several density glyphs and the shallow-water
  // speckle must all be present for this fixed seed.
  const glyphs = new Set(target.calls.map(call => call.text));
  assert.ok(glyphs.size >= 3, `expected a density gradient, got ${[...glyphs].join('')}`);
  assert.ok(glyphs.has('·'), 'the edge should carry shallow-water specks');
  assert.ok([...'@%#*+:'].some(glyph => glyphs.has(glyph)));
});

test('drawReefs respects a per-point fade', () => {
  const field = createField(21, 3);
  const palette = createInkPalette('ocean');
  const target = fakeTarget();
  const fade = (x) => x < WIDTH / 2 ? 0 : 0.5;
  const drawn = drawReefs(target, field, drawOptions(palette, { fade }));
  assert.ok(drawn > 0);
  for (const call of target.calls) {
    assert.ok(call.x >= WIDTH / 2, 'the half-faded side must not draw');
    assert.ok(call.alpha <= 0.6 * 0.85 * 0.5 + 1e-9, 'the fade scales alpha');
    assert.ok(call.alpha > 0);
  }
});

test('a zero fade means no glyph at all', () => {
  const field = createField(21, 3);
  const target = fakeTarget();
  const drawn = drawReefs(target, field, drawOptions(createInkPalette('ocean'), { fade: () => 0 }));
  assert.equal(drawn, 0);
  assert.equal(target.calls.length, 0);
  assert.equal(target.globalAlpha, 1, 'drawing leaves no leftover alpha');
});

test('invalid numbers never throw or leak NaN', () => {
  let field;
  assert.doesNotThrow(() => {
    field = createReefField({ width: NaN, height: undefined, seed: NaN, count: NaN });
  });
  assert.equal(field.reefs.length, 3);
  for (const reef of field.reefs) assertFiniteReef(reef);

  const palette = createInkPalette('ocean');
  const target = fakeTarget();
  assert.doesNotThrow(() => drawReefs(target, field, {
    width: NaN, height: NaN, cellWidth: NaN, cellHeight: NaN, ratio: NaN,
    font: undefined, palette: null, opacity: NaN, fade: () => NaN,
  }));
  assert.equal(target.calls.length, 0, 'a NaN fade suppresses drawing instead of producing NaN alpha');

  assert.doesNotThrow(() => drawReefs(target, field, drawOptions(palette, { width: NaN, height: NaN, cellWidth: NaN })));
  assert.ok(target.calls.length > 0);
  for (const call of target.calls) {
    assert.ok(Number.isFinite(call.x) && Number.isFinite(call.y));
    assert.ok(Number.isFinite(call.alpha) && call.alpha > 0 && call.alpha <= 1);
    assert.ok(Number.isFinite(call.maxWidth) && call.maxWidth > 0);
  }

  assert.doesNotThrow(() => resizeReefField(field, NaN, NaN));
  for (const reef of field.reefs) assertFiniteReef(reef);
  assert.doesNotThrow(() => reefObstacles(field));
  assert.doesNotThrow(() => drawReefs(null, field, {}));
  assert.doesNotThrow(() => drawReefs(target, null, {}));
  assert.doesNotThrow(() => resizeReefField(null, 100, 100));
  assert.doesNotThrow(() => createReefField());
});
