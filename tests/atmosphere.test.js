import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtmosphereField, resizeAtmosphereField, stepAtmosphere, drawAtmosphere,
  atmosphereCloudAt, shadeAtmosphere } from '../src/atmosphere.js';
import { createDepthGrid, DEFAULTS } from '../src/model.js';
import { createWhalePainter } from '../src/surface.js';

function target() {
  const calls = [];
  const ink = { font: '', textAlign: '', textBaseline: '', fillStyle: '', globalAlpha: 1,
    fillText(glyph, x, y) { calls.push({ glyph, x, y, alpha: this.globalAlpha, fill: this.fillStyle }); } };
  return { ink, calls };
}
const options = { width: 960, height: 600, cellWidth: 11, cellHeight: 13,
  opacity: 0.6, wind: true, clouds: true, ratio: 1 };
const field = seed => createAtmosphereField({ width: 960, height: 600, seed });

test('one seed and time reproduce the same sea weather without consulting global randomness', () => {
  const a = field(23), b = field(23), c = field(24);
  stepAtmosphere(a, 12); stepAtmosphere(b, 12); stepAtmosphere(c, 12);
  const first = target(), second = target(), third = target();
  drawAtmosphere(first.ink, a, options);
  drawAtmosphere(second.ink, b, options);
  drawAtmosphere(third.ink, c, options);
  assert.ok(first.calls.length > 20, 'both weather layers actually render');
  assert.deepEqual(first.calls, second.calls);
  assert.notDeepEqual(first.calls, third.calls);
});

test('cloud shadows translate coherently rather than being rerolled each frame', () => {
  const weather = field(23);
  const samples = [];
  for (let y = 0; y < 600; y += 30) for (let x = 0; x < 960; x += 30) {
    samples.push({ x, y, before: atmosphereCloudAt(weather, x, y) });
  }
  assert.ok(samples.some(p => p.before > 0.4), 'the scene has a broad shadow core');
  assert.ok(samples.some(p => p.before < 0.02), 'sunlit open water is preserved');
  stepAtmosphere(weather, 1 / 60);
  let maxChange = 0;
  for (const p of samples) maxChange = Math.max(maxChange,
    Math.abs(atmosphereCloudAt(weather, p.x, p.y) - p.before));
  assert.ok(maxChange < 0.01, `a single frame changed the shadow by ${maxChange}`);
  stepAtmosphere(weather, 45);
  assert.ok(samples.some(p => Math.abs(atmosphereCloudAt(weather, p.x, p.y) - p.before) > 0.08));
});

test('wind and cloud switches act independently and the existing fade masks every weather glyph', () => {
  const weather = field(23);
  const wind = target(), clouds = target(), off = target(), masked = target();
  const a = drawAtmosphere(wind.ink, weather, { ...options, clouds: false });
  const b = drawAtmosphere(clouds.ink, weather, { ...options, wind: false });
  drawAtmosphere(off.ink, weather, { ...options, wind: false, clouds: false });
  drawAtmosphere(masked.ink, weather, { ...options, fade: () => 0 });
  assert.ok(a.wind > 0 && a.clouds === 0);
  assert.ok(b.clouds > 0 && b.wind === 0);
  assert.equal(off.calls.length, 0);
  assert.equal(masked.calls.length, 0);
  const partial = target();
  drawAtmosphere(partial.ink, weather, { ...options, fade: (x, y) => x < 450 && y < 400 ? 1 : 0 });
  assert.ok(partial.calls.length > 0);
  assert.ok(partial.calls.every(p => p.x < 450 && p.y < 400));
});

test('pause keeps a static atmosphere and resizing preserves the same weather objects', () => {
  const weather = field(23), snapshot = structuredClone(weather);
  for (const dt of [0, -1, NaN, Infinity]) stepAtmosphere(weather, dt);
  assert.deepEqual(weather, snapshot);
  const clouds = weather.clouds, gusts = weather.gusts;
  resizeAtmosphereField(weather, 480, 300);
  assert.equal(weather.clouds, clouds);
  assert.equal(weather.gusts, gusts);
  assert.equal(weather.time, snapshot.time);
  for (const p of [[100, 200], [400, 500], [700, 200]]) {
    assert.ok(Math.abs(atmosphereCloudAt(weather, p[0] / 2, p[1] / 2)
      - atmosphereCloudAt(snapshot, p[0], p[1])) < 1e-10);
  }
});

test('weather has a strict glyph budget and leaves the drawing context alpha restored', () => {
  for (const size of [[390, 844], [960, 600], [3840, 2160]]) {
    const weather = createAtmosphereField({ width: size[0], height: size[1], seed: 23 });
    const view = target();
    const result = drawAtmosphere(view.ink, weather,
      { ...options, width: size[0], height: size[1], ratio: 2 });
    assert.ok(result.wind <= 192 && result.clouds <= 1100);
    assert.equal(result.wind + result.clouds, view.calls.length);
    assert.equal(view.ink.globalAlpha, 1);
    assert.ok(view.calls.every(p => p.x >= 0 && p.x < size[0] && p.y >= 0 && p.y < size[1]));
    assert.ok(view.calls.every(p => p.alpha > 0 && p.alpha <= options.opacity * 0.24 + 1e-9));
    assert.ok(view.calls.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(view.calls.every(p => ['.', "'", ':', '-', '~'].includes(p.glyph)));
  }
});

test('passing cloud cover slightly darkens whale ink without changing shape, coverage or opacity', () => {
  const weather = field(23), grid = createDepthGrid(960, 600, 11);
  grid.owners.fill(0); grid.lights.fill(0.6); grid.visibility.fill(0.8); grid.coverage.fill(1);
  const owners = grid.owners.slice(), visibility = grid.visibility.slice(), coverage = grid.coverage.slice();
  shadeAtmosphere(weather, grid, { clouds: false });
  assert.ok(grid.lights.every(light => Math.abs(light - 0.6) < 1e-6));
  const originalLights = grid.lights.slice();
  shadeAtmosphere(weather, grid, { clouds: true });
  assert.ok(grid.atmosphereLights.some(light => light < 0.55));
  assert.ok(grid.atmosphereLights.every(light => light <= 0.6 + 1e-6 && light >= 0.46 - 1e-6));
  assert.deepEqual(grid.lights, originalLights, 'cloud tint does not affect the ASCII density ramp');
  assert.deepEqual(grid.owners, owners);
  assert.deepEqual(grid.visibility, visibility);
  assert.deepEqual(grid.coverage, coverage);
  const tinted = grid.atmosphereLights.slice();
  shadeAtmosphere(weather, grid, { clouds: true });
  assert.deepEqual(grid.atmosphereLights, tinted, 'two paints do not accumulate cloud darkness');
  shadeAtmosphere(weather, grid, { clouds: false });
  assert.deepEqual(grid.atmosphereLights, originalLights, 'a live toggle restores normal ink');
});

test('cloud cover changes actual painted ink while the ASCII characters remain identical', () => {
  const weather = field(23), grid = createDepthGrid(960, 600, 11);
  grid.owners.fill(0); grid.lights.fill(0.6); grid.visibility.fill(0.8); grid.coverage.fill(1);
  const painter = createWhalePainter({ particles: [{ glyph: '鲸', seed: 0.5, part: 'body', whale: 0 }] },
    { ...DEFAULTS, fillMode: 'ascii', renderStyle: 'glyphs', quietCenter: false });
  const poses = [{ cameraZ: 400, focal: 900 }], before = target(), after = target();
  painter.paint(before.ink, grid, poses, 960, 600);
  shadeAtmosphere(weather, grid, { clouds: true });
  painter.paint(after.ink, grid, poses, 960, 600);
  assert.deepEqual(after.calls.map(({ glyph, x, y, alpha }) => ({ glyph, x, y, alpha })),
    before.calls.map(({ glyph, x, y, alpha }) => ({ glyph, x, y, alpha })));
  assert.ok(after.calls.some((call, i) => call.fill !== before.calls[i].fill));
});
