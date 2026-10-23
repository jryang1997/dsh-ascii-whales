import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtmosphereField, resizeAtmosphereField, stepAtmosphere, drawAtmosphere,
  atmosphereCloudAt, shadeAtmosphere } from '../src/atmosphere.js';
import { createDepthGrid, DEFAULTS } from '../src/model.js';
import { createWhalePainter } from '../src/surface.js';

function target() {
  const calls = [], images = [], layers = [];
  const snapshot = canvas => ({ width: canvas.width, height: canvas.height,
    rects: structuredClone(canvas.getContext('2d').rects),
    images: structuredClone(canvas.getContext('2d').images) });
  const ownerDocument = { createElement(type) {
    assert.equal(type, 'canvas');
    const context = { rects: [], images: [], clears: 0, globalAlpha: 1,
      globalCompositeOperation: 'source-over', fillStyle: '',
      clearRect() { this.rects = []; this.images = []; this.clears++; },
      fillRect(x, y, width, height) { this.rects.push({ x, y, width, height,
        alpha: this.globalAlpha, fill: this.fillStyle }); },
      drawImage(source, ...args) { this.images.push({ source: snapshot(source), args,
        composite: this.globalCompositeOperation, smoothing: this.imageSmoothingEnabled }); } };
    const canvas = { width: 1, height: 1, getContext: () => context };
    layers.push({ canvas, context });
    return canvas;
  } };
  const ink = { canvas: { ownerDocument }, font: '', textAlign: '', textBaseline: '', fillStyle: '',
    globalAlpha: 1, imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
    fillText(glyph, x, y) { calls.push({ glyph, x, y, alpha: this.globalAlpha, fill: this.fillStyle }); },
    drawImage(source, ...args) { images.push({ source: snapshot(source), args, alpha: this.globalAlpha,
      smoothing: this.imageSmoothingEnabled }); } };
  return { ink, calls, images, layers };
}
function shadowSamples(source) {
  const samples = new Float32Array(source.width * source.height);
  for (const rect of source.rects) samples[rect.y * source.width + rect.x] = rect.alpha;
  return samples;
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
  assert.ok(first.calls.length > 20, 'wind glyphs actually render');
  assert.equal(first.images.length, 1, 'the continuous cloud image actually renders');
  assert.deepEqual(first.calls, second.calls);
  assert.deepEqual(first.images, second.images);
  assert.notDeepEqual(first.calls, third.calls);
  assert.notDeepEqual(first.images, third.images);
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

test('wind and cloud switches act independently and fade masks both drawing branches', () => {
  const weather = field(23);
  const wind = target(), clouds = target(), off = target(), masked = target();
  const a = drawAtmosphere(wind.ink, weather, { ...options, clouds: false });
  const b = drawAtmosphere(clouds.ink, weather, { ...options, wind: false });
  drawAtmosphere(off.ink, weather, { ...options, wind: false, clouds: false });
  drawAtmosphere(masked.ink, weather, { ...options, fade: () => 0 });
  assert.ok(a.wind > 0 && a.clouds === 0);
  assert.ok(b.clouds > 0 && b.wind === 0);
  assert.equal(wind.images.length, 0);
  assert.equal(clouds.calls.length, 0, 'clouds are continuous ink rather than stippled characters');
  assert.equal(clouds.images.length, 1);
  assert.equal(off.calls.length + off.images.length + off.layers.length, 0);
  assert.equal(masked.calls.length + masked.images.length, 0);
  const partial = target();
  drawAtmosphere(partial.ink, weather, { ...options, fade: (x, y) => x < 451.25 && y < 403.75 ? 1 : 0 });
  assert.ok(partial.calls.length > 0);
  assert.ok(partial.calls.every(p => p.x < 451.25 && p.y < 403.75));
  assert.equal(partial.images.length, 1);
  const mask = partial.images[0].source;
  assert.ok(mask.rects.length > 0);
  assert.ok(mask.rects.every(rect => rect.x + rect.width <= 451.25 && rect.y + rect.height <= 403.75),
    'conservative footprint sampling holds the entire composite out of the reading area');
  assert.equal(mask.images[0].composite, 'source-in');
  assert.equal(mask.images[0].smoothing, true, 'the cloud field itself remains smooth');
  assert.equal(partial.images[0].smoothing, false, 'a final upscale never interpolates mask alpha into text');
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

test('weather bounds wind glyphs, cloud samples, mask pixels and sampling work at every viewport size', () => {
  for (const size of [[390, 844], [960, 600], [3840, 2160], [16000, 1000], [1, 16000]]) {
    const weather = createAtmosphereField({ width: size[0], height: size[1], seed: 23 });
    const view = target();
    let probes = 0;
    const result = drawAtmosphere(view.ink, weather,
      { ...options, width: size[0], height: size[1], ratio: 2, fade: () => { probes++; return 1; } });
    assert.ok(result.wind <= 192 && result.clouds === 1);
    assert.equal(result.wind, view.calls.length);
    assert.equal(result.clouds, view.images.length);
    const mask = view.images[0].source, cloud = mask.images[0].source;
    assert.ok(cloud.width * cloud.height <= 8192 && cloud.rects.length <= 8192);
    assert.ok(mask.width * mask.height <= 2097152 && mask.rects.length <= 6144);
    assert.ok(probes <= 6144 * 9 + result.wind);
    assert.equal(view.ink.globalAlpha, 1);
    assert.equal(view.ink.imageSmoothingEnabled, false);
    assert.equal(view.ink.imageSmoothingQuality, 'low');
    assert.ok(view.calls.every(p => p.x >= 0 && p.x < size[0] && p.y >= 0 && p.y < size[1]));
    assert.ok(view.calls.every(p => p.alpha > 0 && p.alpha <= options.opacity * 0.24 + 1e-9));
    assert.ok(view.calls.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(view.calls.every(p => ['-', '~'].includes(p.glyph)));
    assert.ok(mask.rects.every(p => p.x >= 0 && p.y >= 0 && p.x + p.width <= mask.width
      && p.y + p.height <= mask.height && p.alpha > 0 && p.alpha <= 1));
  }
});

test('painted cloud samples form broad soft cores with clear water and continuous frame changes', () => {
  const weather = field(23), view = target();
  drawAtmosphere(view.ink, weather, { ...options, wind: false });
  const image = view.images[0], source = image.source, before = shadowSamples(source);
  assert.ok(source.rects.every(rect => rect.width === 1 && rect.height === 1));
  assert.ok(before.some(alpha => alpha > 0.4));
  assert.ok(before.some(alpha => alpha === 0), 'the cloud image retains transparent sunlit gaps');
  let longest = 0, maxSlope = 0;
  for (let row = 0; row < source.height; row++) {
    let run = 0;
    for (let col = 0; col < source.width; col++) {
      const index = row * source.width + col;
      run = before[index] > 0.2 ? run + 1 : 0;
      longest = Math.max(longest, run);
      if (col) maxSlope = Math.max(maxSlope, Math.abs(before[index] - before[index - 1]));
    }
  }
  assert.ok(longest >= 12, 'shadow cores cover consecutive cells, rather than scattered points');
  assert.ok(maxSlope < 0.12, `adjacent cloud samples changed by ${maxSlope}`);
  assert.equal(image.smoothing, true);
  assert.ok(image.alpha * Math.max(...before) > 0.1, 'daytime cores have useful broad-area contrast');
  stepAtmosphere(weather, 1 / 60);
  drawAtmosphere(view.ink, weather, { ...options, wind: false });
  const after = shadowSamples(view.images[1].source);
  assert.ok(after.every((alpha, index) => Math.abs(alpha - before[index]) < 0.01));
});

test('cloud cache reuses the same field and Canvas objects until time, size or ink changes', () => {
  const weather = field(23), view = target();
  drawAtmosphere(view.ink, weather, { ...options, wind: false });
  const { canvas, context } = view.layers[0], first = view.images[0];
  drawAtmosphere(view.ink, weather, { ...options, wind: false });
  assert.equal(view.layers.length, 1);
  assert.equal(context.clears, 1, 'paused or repeated same-time paints reuse the sampled field');
  assert.deepEqual(view.images[1], first);
  stepAtmosphere(weather, 1);
  drawAtmosphere(view.ink, weather, { ...options, wind: false });
  assert.equal(context.clears, 2);
  assert.notDeepEqual(view.images[2], first);
  drawAtmosphere(view.ink, weather, { ...options, wind: false, dark: true });
  assert.equal(context.clears, 3);
  assert.ok(context.rects.every(rect => rect.fill === 'rgb(2, 8, 16)'));
  assert.ok(view.images[3].alpha > view.images[2].alpha, 'night has a stronger dark projection');
  resizeAtmosphereField(weather, 480, 300);
  drawAtmosphere(view.ink, weather, { ...options, width: 480, height: 300, wind: false });
  assert.equal(context.clears, 4);
  assert.equal(view.layers[0].canvas, canvas);
  assert.equal(view.layers.length, 1);
  const palette = Array(512).fill('rgb(17, 31, 48)');
  drawAtmosphere(view.ink, weather, { ...options, width: 480, height: 300, wind: false, palette });
  assert.ok(context.rects.every(rect => rect.fill === palette[0]), 'daytime shadow ink follows the selected palette');
});

test('mask runs survive time advances and resample only when the fade reference or viewport changes', () => {
  const weather = field(23), view = target();
  let probes = 0;
  const fade = x => { probes++; return x < 451.25 ? 1 : 0; };
  const paint = extra => drawAtmosphere(view.ink, weather, { ...options, wind: false, fade, ...extra });
  paint();
  const firstProbes = probes, first = view.images[0].source;
  assert.ok(firstProbes > 0);
  stepAtmosphere(weather, 20);
  paint();
  assert.equal(probes, firstProbes, 'advancing the cloud field does not sample the stable reading mask');
  assert.deepEqual(view.images[1].source.rects, first.rects, 'the same conservative mask runs are replayed');
  assert.notDeepEqual(view.images[1].source.images[0].source, first.images[0].source,
    'the cloud field still moves inside the cached mask');
  const replacement = x => fade(x);
  paint({ fade: replacement });
  assert.ok(probes > firstProbes, 'a replacement fade function invalidates the mask even with equal values');
  const afterFade = probes;
  paint({ fade: replacement, width: 961 });
  assert.ok(probes > afterFade, 'changing CSS width invalidates the mask even when raster dimensions are similar');
  const afterWidth = probes;
  paint({ fade: replacement, width: 961, height: 601 });
  assert.ok(probes > afterWidth, 'changing CSS height also invalidates the mask');
  const afterSize = probes;
  stepAtmosphere(weather, 1);
  paint({ fade: replacement, width: 961, height: 601 });
  assert.equal(probes, afterSize);
  assert.equal(view.layers.length, 2, 'mask caching does not allocate another Canvas');
});

test('the separate fade mask clamps invalid values and keeps partial alpha and moving reading boundaries current', () => {
  const weather = field(23), view = target();
  for (const value of [0, -1, NaN, Infinity]) {
    assert.equal(drawAtmosphere(view.ink, weather, { ...options, wind: false, fade: () => value }).clouds, 0);
  }
  assert.equal(view.images.length, 0);
  drawAtmosphere(view.ink, weather, { ...options, wind: false, fade: () => 0.47 });
  assert.ok(view.images[0].source.rects.every(rect => rect.alpha <= 0.47 && rect.alpha >= 0.43));
  const canvases = view.layers.length;
  drawAtmosphere(view.ink, weather, { ...options, wind: false, fade: x => x < 301.25 ? 1 : 0 });
  assert.ok(view.images[1].source.rects.every(rect => rect.x + rect.width <= 301.25));
  assert.equal(view.layers.length, canvases, 'layout changes reuse both buffers');
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
