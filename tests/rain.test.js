import test from 'node:test';
import assert from 'node:assert/strict';
import { createRainField, resizeRainField, stepRain, drawRain, resetRainField } from '../src/rain.js';
import { createAtmosphereField } from '../src/atmosphere.js';

const settings = { enabled: true, intensity: 0.75, wind: false };
const makeField = (seed = 23, extra = {}) => createRainField({ width: 960, height: 600, seed, ...extra });
function run(field, seconds, options = settings, dt = 1 / 60) {
  const frames = Math.ceil(seconds / dt);
  for (let i = 0; i < frames; i++) stepRain(field, seconds / frames, options);
  return field;
}
function target() {
  const strokes = [];
  let path = [];
  const ink = { globalAlpha: 0.37, strokeStyle: '#123456', lineWidth: 2.3, lineCap: 'square', lineJoin: 'bevel',
    beginPath() { path = []; },
    moveTo(x, y) { path.push(['move', x, y]); },
    lineTo(x, y) { path.push(['line', x, y]); },
    stroke() { strokes.push({ path, alpha: this.globalAlpha, ink: this.strokeStyle, width: this.lineWidth }); } };
  return { ink, strokes };
}
function inkState(ink) {
  return { alpha: ink.globalAlpha, stroke: ink.strokeStyle, width: ink.lineWidth, cap: ink.lineCap, join: ink.lineJoin };
}
function close(actual, expected, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);
}

test('seeded rain reproduces trajectories and draw commands without global randomness', () => {
  const original = Math.random;
  Math.random = () => { throw new Error('rain must use event hashes'); };
  try {
    const a = run(makeField(), 3), b = run(makeField(), 3), c = run(makeField(24), 3);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a.drops, c.drops);
    assert.ok(a.drops.length > 20 && a.impacts.length > 20);
    const first = target(), second = target();
    assert.deepEqual(drawRain(first.ink, a), drawRain(second.ink, b));
    assert.deepEqual(first.strokes, second.strokes);
  } finally { Math.random = original; }
});

test('intensity eases in, retargets from its current value and preserves live rain', () => {
  const field = makeField();
  stepRain(field, 1 / 60, { enabled: true, intensity: 1 });
  assert.ok(field.intensity > 0 && field.intensity < 0.1);
  assert.ok(field.drops.length < 2, 'the first frame never fills the screen');
  run(field, 1, { enabled: true, intensity: 1 });
  assert.ok(field.intensity > 0.97);
  const references = new Map(field.drops.map(drop => [drop.id, drop]));
  const before = field.intensity;
  stepRain(field, 1 / 60, { enabled: true, intensity: 0.15 });
  assert.ok(field.intensity < before && field.intensity > 0.8);
  assert.ok(field.drops.filter(drop => references.get(drop.id) === drop).length > references.size * 0.8);
  run(field, 1, { enabled: true, intensity: 0.15 });
  close(field.intensity, 0.15, 0.02);
});

test('strong rain changes density and impact energy while keeping gentle depth variation', () => {
  const light = run(makeField(), 5, { ...settings, intensity: 0.2 });
  const heavy = run(makeField(), 5, { ...settings, intensity: 1 });
  assert.ok(heavy.drops.length > light.drops.length * 3);
  const average = (field, key) => field.impacts.reduce((sum, impact) => sum + impact[key], 0) / field.impacts.length;
  assert.ok(average(heavy, 'energy') > average(light, 'energy') * 1.7);
  assert.ok(average(heavy, 'radius') > average(light, 'radius'));
  const scales = heavy.drops.map(drop => drop.scale), speeds = heavy.drops.map(drop => drop.speed);
  assert.ok(Math.max(...scales) / Math.min(...scales) < 1.8);
  assert.ok(Math.max(...speeds) > Math.min(...speeds) * 1.3);
});

test('off and zero intensity drain live drops and water feedback without replacing arrays', () => {
  for (const options of [{ enabled: false }, { enabled: true, intensity: 0 }]) {
    const field = run(makeField(), 3), drops = field.drops, impacts = field.impacts;
    const oldImpact = field.impacts[0], age = oldImpact.age;
    stepRain(field, 1 / 60, options);
    assert.ok(field.intensity > 0 && field.drops.length > 0 && field.impacts.length > 0);
    assert.ok(oldImpact.age > age);
    run(field, 4, options);
    assert.equal(field.intensity, 0);
    assert.equal(field.drops.length + field.impacts.length, 0);
    assert.equal(field.drops, drops); assert.equal(field.impacts, impacts);
    stepRain(field, 1000, options);
    assert.equal(field.drops.length + field.impacts.length, 0);
  }
});

test('invalid delta and an absent viewport never advance clocks, intensity or histories', () => {
  const field = run(makeField(), 2), snapshot = structuredClone(field);
  for (const delta of [0, -1, NaN, Infinity, -Infinity]) stepRain(field, delta, { enabled: false });
  assert.deepEqual(field, snapshot);
  resizeRainField(field, 0, 0);
  const hidden = structuredClone(field);
  stepRain(field, 2, { enabled: false });
  assert.deepEqual(field, hidden);
  const empty = createRainField();
  stepRain(empty, 1, settings);
  assert.equal(empty.time, 0); assert.equal(empty.intensity, 0);
});

test('wind samples the shared breeze for slant while speed, density and energy remain independent', () => {
  const atmosphere = createAtmosphereField({ seed: 7, width: 960, height: 600 });
  const still = run(makeField(), 0.3, { ...settings, wind: false, atmosphere });
  const windy = run(makeField(), 0.3, { ...settings, wind: true, atmosphere });
  assert.equal(still.drops.length, windy.drops.length);
  assert.ok(still.drops.every(drop => drop.vx === 0));
  assert.ok(windy.drops.every(drop => drop.vx > 0));
  for (let i = 0; i < still.drops.length; i++) {
    close(still.drops[i].energy, windy.drops[i].energy);
    close(Math.hypot(still.drops[i].vx, still.drops[i].vy), Math.hypot(windy.drops[i].vx, windy.drops[i].vy));
  }
  const selected = windy.drops[windy.drops.length - 1], id = selected.id, x = selected.x, vx = selected.vx;
  stepRain(windy, 1 / 60, { ...settings, wind: false, atmosphere });
  const after = windy.drops.find(drop => drop.id === id);
  assert.equal(after, selected);
  assert.ok(after.vx > vx * 0.9 && after.vx < vx, 'switching wind never snaps existing strokes upright');
  assert.ok(after.x > x);
  close(Math.hypot(after.vx, after.vy), after.speed);
  run(windy, 1, { ...settings, wind: false, atmosphere });
  assert.ok(windy.drops.every(drop => Math.abs(drop.vx) < 0.01), 'within a second the new rainfall is vertical');
  const enabledDrop = still.drops[still.drops.length - 1], enabledId = enabledDrop.id;
  stepRain(still, 1 / 60, { ...settings, wind: true, atmosphere });
  const turning = still.drops.find(drop => drop.id === enabledId);
  assert.equal(turning, enabledDrop);
  assert.ok(turning.vx > 0 && turning.vx < vx * 0.15, 'turning wind on also steers gradually');
  const noAtmosphere = run(makeField(), 0.3, { ...settings, wind: true });
  assert.ok(noAtmosphere.drops.every(drop => drop.vx === 0));
});

test('each impact starts at its own drop crossing and expires within its recorded lifetime', () => {
  const field = run(makeField(), 0.35);
  assert.equal(field.impacts.length, 0, 'water feedback is never born ahead of a landing');
  const chosen = field.drops[0];
  const id = chosen.id, x = chosen.x, y = chosen.landY, energy = chosen.energy;
  const untilLanding = (chosen.landY - chosen.y) / chosen.speed;
  stepRain(field, untilLanding + 0.002, settings);
  const impact = field.impacts.find(item => item.dropId === id);
  assert.ok(impact);
  close(impact.x, x); close(impact.y, y); close(impact.energy, energy); close(impact.age, 0.002);
  assert.ok(!field.drops.some(drop => drop.id === id));
  const lifetime = impact.life;
  run(field, lifetime, { enabled: false });
  assert.ok(!field.impacts.some(item => item.dropId === id));
});

test('rainfall count is stable across frame subdivisions', () => {
  const a = run(makeField(), 5, settings, 1 / 60), b = run(makeField(), 5, settings, 1 / 120);
  close(a.intensity, b.intensity);
  assert.ok(Math.abs(a.drops.length - b.drops.length) <= 1);
  assert.ok(Math.abs(a.impacts.length - b.impacts.length) <= 1);
  const first = a.drops[0], corresponding = b.drops.find(drop => drop.id === first.id);
  assert.ok(corresponding); close(first.x, corresponding.x); close(first.y, corresponding.y, 0.15);
});

test('resizing scales histories and retains particle identities through a zero viewport', () => {
  const field = run(makeField(), 3), drop = field.drops[0], impact = field.impacts[0];
  const snapshot = structuredClone(field), drops = field.drops, impacts = field.impacts;
  resizeRainField(field, 480, 300);
  assert.equal(field.drops, drops); assert.equal(field.impacts, impacts);
  assert.equal(field.drops[0], drop); assert.equal(field.impacts[0], impact);
  close(drop.x, snapshot.drops[0].x / 2); close(drop.y, snapshot.drops[0].y / 2);
  close(drop.landY, snapshot.drops[0].landY / 2); close(impact.x, snapshot.impacts[0].x / 2);
  close(impact.y, snapshot.impacts[0].y / 2); close(field.time, snapshot.time);
  resizeRainField(field, 0, 0); resizeRainField(field, 960, 600);
  close(drop.x, snapshot.drops[0].x); close(drop.y, snapshot.drops[0].y);
  close(impact.x, snapshot.impacts[0].x); close(impact.y, snapshot.impacts[0].y);
  stepRain(field, 0.1, settings);
  assert.ok(field.drops.every(item => Number.isFinite(item.x) && Number.isFinite(item.y)));
});

test('long high-intensity runs, huge deltas and extreme sizes obey fixed pool and command budgets', () => {
  for (const [width, height] of [[390, 844], [960, 600], [3840, 2160], [16000, 1], [1, 16000], [1e300, 1e300]]) {
    const field = makeField(23, { width, height }), drops = new Set(), impacts = new Set();
    for (let i = 0; i < 240; i++) {
      stepRain(field, 0.25, { enabled: true, intensity: 1 });
      assert.ok(field.drops.length <= 320 && field.impacts.length <= 160);
      field.drops.forEach(drop => drops.add(drop)); field.impacts.forEach(impact => impacts.add(impact));
    }
    stepRain(field, 1e8, { enabled: true, intensity: 1 });
    assert.ok(field.drops.length <= 320 && field.impacts.length <= 160);
    assert.ok(drops.size <= 320 && impacts.size <= 160, 'births reuse their fixed object pools');
    for (const item of [...field.drops, ...field.impacts]) {
      assert.ok(Object.values(item).every(value => Number.isFinite(value)));
    }
    const view = target(); let probes = 0;
    const counts = drawRain(view.ink, field, { ratio: 2, fade: () => { probes++; return 1; } });
    assert.equal(view.strokes.length, counts.drops + counts.impacts);
    assert.ok(view.strokes.length <= 480);
    assert.ok(probes <= 160 * 8 * 33 * 3 + 320 * 33 * 3);
    assert.ok(view.strokes.every(stroke => stroke.path.length <= 16 && stroke.alpha > 0 && stroke.alpha <= 0.6));
  }
});

test('surface and fall draw separate coherent output and restore every changed stroke setting', () => {
  const field = run(makeField(), 3), snapshot = structuredClone(field);
  for (const phase of ['surface', 'fall', undefined]) {
    const view = target(), state = inkState(view.ink);
    const counts = drawRain(view.ink, field, { phase, opacity: 0.5, dark: true, palette: Array(512).fill('#789abc') });
    assert.deepEqual(inkState(view.ink), state); assert.deepEqual(field, snapshot);
    assert.equal(counts.glyphs, 0); assert.equal(view.strokes.length, counts.drops + counts.impacts);
    if (phase === 'surface') { assert.equal(counts.drops, 0); assert.ok(counts.impacts > 20); }
    if (phase === 'fall') { assert.equal(counts.impacts, 0); assert.ok(counts.drops > 20); }
    assert.ok(view.strokes.every(stroke => stroke.ink === '#789abc'));
    assert.ok(view.strokes.every(stroke => stroke.path.every(point => point.slice(1).every(Number.isFinite))));
  }
  const view = target(), state = inkState(view.ink);
  assert.throws(() => drawRain(view.ink, field, { fade() { throw new Error('mask failed'); } }), /mask failed/);
  assert.deepEqual(inkState(view.ink), state);
});

test('fade zero suppresses both phases and footprint masking excludes tails, crests and stroke edges', () => {
  const field = run(makeField(), 3);
  for (const phase of ['surface', 'fall']) {
    const zero = target();
    assert.deepEqual(drawRain(zero.ink, field, { phase, fade: () => 0 }), { drops: 0, impacts: 0, glyphs: 0 });
    assert.equal(zero.strokes.length, 0);
    const view = target();
    const boundary = phase === 'surface' ? 470 : 300;
    const fade = (x, y) => phase === 'surface' ? Number(x < boundary) : Number(y > boundary);
    const counts = drawRain(view.ink, field, { phase, fade });
    assert.ok(counts.drops + counts.impacts > 0);
    for (const stroke of view.strokes) for (const point of stroke.path) {
      assert.equal(fade(point[1], point[2]), 1);
      if (phase === 'surface') assert.ok(point[1] + stroke.width / 2 < boundary);
      else assert.ok(point[2] - stroke.width / 2 > boundary);
    }
  }
});

test('reduced motion renders a stable sparse subset without creating particles or advancing time', () => {
  const empty = makeField(), emptyView = target();
  drawRain(emptyView.ink, empty, { reduced: true });
  assert.equal(emptyView.strokes.length, 0);
  const field = run(makeField(), 3), snapshot = structuredClone(field);
  const full = target(), first = target(), second = target();
  drawRain(full.ink, field);
  const a = drawRain(first.ink, field, { reduced: true }), b = drawRain(second.ink, field, { reduced: true });
  assert.ok(a.drops > 0 && a.impacts > 0 && first.strokes.length < full.strokes.length / 2);
  assert.deepEqual(a, b); assert.deepEqual(first.strokes, second.strokes); assert.deepEqual(field, snapshot);
});

test('reset empties history and restarts the same seed without replacing public arrays', () => {
  const field = run(makeField(), 3), expected = structuredClone(field), drops = field.drops, impacts = field.impacts;
  assert.equal(resetRainField(field), field);
  assert.equal(field.drops, drops); assert.equal(field.impacts, impacts);
  assert.equal(field.time, 0); assert.equal(field.intensity, 0);
  assert.equal(field.drops.length + field.impacts.length, 0);
  run(field, 3);
  assert.deepEqual(field, expected);
  for (const invalid of [null, undefined, {}]) {
    assert.equal(stepRain(invalid, 1), invalid);
    assert.equal(resizeRainField(invalid, 1, 1), invalid);
    assert.equal(resetRainField(invalid), invalid);
    assert.deepEqual(drawRain(target().ink, invalid), { drops: 0, impacts: 0, glyphs: 0 });
  }
});
