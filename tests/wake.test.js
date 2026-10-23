import test from 'node:test';
import assert from 'node:assert/strict';
import { createWakeField, stepWake, visitWakePoints } from '../src/wake.js';
import { createWaterField, resetWaterField, stepWater, drawWater } from '../src/water.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { normalizeConfig } from '../src/model.js';
import { createInkPalette } from '../src/shading.js';

const dt = 1 / 60;
const whale = extra => ({ id: 1, x: 400, y: 300, heading: 0, length: 120, bodyRadius: 18,
  speed: 40, _motion: { wave: 0, stroke: 0, submergence: 0 }, ...extra });
const sceneOf = (...whales) => ({ width: 1000, height: 600, whales });
const close = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);
function move(w, dx, dy) {
  w.x += dx; w.y += dy;
  if (w.rig) for (let i = 0; i < w.rig.nodes.length; i += 2) {
    w.rig.nodes[i] += dx; w.rig.nodes[i + 1] += dy;
  }
}
function cruise(field, scene, frames = 90, tick = dt) {
  for (let i = 0; i < frames; i++) {
    for (const w of scene.whales) move(w, Math.cos(w.heading) * w.speed * tick, Math.sin(w.heading) * w.speed * tick);
    stepWater(field, scene, tick);
  }
}
function trail(extra = {}) {
  const w = whale(extra), scene = sceneOf(w), field = createWaterField();
  stepWater(field, scene, dt);
  cruise(field, scene);
  return { field, scene, w };
}
function fakeTarget() {
  const calls = [], allowed = new Set(['font', 'fillStyle', 'globalAlpha', 'textAlign', 'textBaseline', 'fillText']);
  const base = { font: '', fillStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '',
    fillText(glyph, x, y, maxWidth) { calls.push({ glyph, x, y, maxWidth, alpha: base.globalAlpha, ink: base.fillStyle }); } };
  const target = new Proxy(base, {
    get(object, key) { assert.ok(allowed.has(key), `unexpected Canvas read ${String(key)}`); return object[key]; },
    set(object, key, value) { assert.ok(allowed.has(key), `unexpected Canvas write ${String(key)}`); object[key] = value; return true; },
  });
  return { target, calls, base };
}
const drawOptions = extra => ({ width: 1000, height: 600, cellWidth: 7.3, cellHeight: 9.7,
  ratio: 2, opacity: 0.6, font: '600 11px monospace', palette: createInkPalette('azure'), ...extra });
const points = packet => {
  const result = [];
  visitWakePoints({ packets: [packet], width: 1000, height: 600 }, {}, (x, y, glyph, alpha) => {
    result.push({ x, y, glyph, alpha }); return true;
  });
  return result;
};

test('moving passive glides leave an actual ASCII wake without tail beats or circular splashes', () => {
  const { field, w } = trail();
  assert.equal(w._motion.stroke, 0);
  assert.equal(field.ripples.length, 0);
  assert.ok(field.wake.packets.length >= 4, 'distance travelled produces several historical packets');
  const view = fakeTarget(), count = drawWater(view.target, field, drawOptions());
  assert.equal(count, view.calls.length);
  assert.ok(count > 12, `the wake branch actually paints, got ${count}`);
  assert.equal(view.base.globalAlpha, 1);
  assert.equal(view.base.font, drawOptions().font);
  const cells = new Set();
  for (const call of view.calls) {
    assert.ok(['~', '-', '.', "'", ':', '/', '\\'].includes(call.glyph));
    assert.ok(call.x >= 0 && call.x < 1000 && call.y >= 0 && call.y < 600);
    assert.ok(Number.isInteger(call.x * 2) && Number.isInteger(call.y * 2));
    assert.ok(call.alpha > 0 && call.alpha <= 0.6);
    assert.ok(drawOptions().palette.includes(call.ink));
    assert.ok(!cells.has(`${call.x},${call.y}`), 'all wake packets share cell deduplication');
    cells.add(`${call.x},${call.y}`);
  }
});

test('stationary whales and tail-only rig movement do not emit wakes; submergence and deliberate dives stop new packets', () => {
  const w = whale({ rig: { nodes: new Float64Array([450, 300, 350, 310]) } }), scene = sceneOf(w);
  const field = createWaterField();
  stepWater(field, scene, dt);
  for (let i = 0; i < 120; i++) {
    w.rig.nodes[3] = 310 + Math.sin(i) * 5;
    stepWater(field, scene, dt);
  }
  assert.equal(field.wake.packets.length, 0);
  cruise(field, scene, 90);
  assert.ok(field.wake.packets.length > 0);
  const old = field.wake.packets.slice();
  w._motion.submergence = 0.6;
  cruise(field, scene, 60);
  assert.ok(field.wake.packets.every(packet => old.includes(packet)));
  w._motion.submergence = 0;
  w._motion.dive = { startedAt: 0 };
  cruise(field, scene, 60);
  assert.ok(field.wake.packets.every(packet => old.includes(packet)), 'the entry and exit gesture owns its contact water');
  cruise(field, scene, 8 * 60);
  assert.equal(field.wake.packets.length, 0, 'submerged travel still lets old surface marks expire');
});

test('true trailing rig nodes and local tangent determine birth position; old water never rotates with a turn', () => {
  const w = whale({ rig: { nodes: new Float64Array([400, 300, 340, 310, 310, 330]) } });
  const scene = sceneOf(w), field = createWaterField();
  stepWater(field, scene, dt);
  cruise(field, scene, 24);
  const packet = field.wake.packets[0];
  assert.ok(packet);
  close(packet.x, 310 + 18 * 0.65);
  close(packet.y, 330);
  close(packet.angle, Math.atan2(-20, 30));
  const fixed = { x: packet.x, y: packet.y, angle: packet.angle, age: packet.age };
  w.heading = Math.PI / 2;
  w.rig.nodes = new Float64Array([w.x, w.y + 50, w.x + 10, w.y - 40, w.x + 30, w.y - 70]);
  cruise(field, scene, 60);
  assert.equal(packet.x, fixed.x); assert.equal(packet.y, fixed.y); assert.equal(packet.angle, fixed.angle);
  assert.ok(packet.age > fixed.age);
  assert.ok(field.wake.packets.some(p => Math.abs(p.angle - packet.angle) > 0.5));
});

test('each packet leaves two curved sides that spread away from its historical centre and then fade', () => {
  const { field } = trail(), original = field.wake.packets[2];
  const young = points({ ...original, angle: 0, x: 500, y: 300, age: 0.3 });
  const old = points({ ...original, angle: 0, x: 500, y: 300, age: 3 });
  assert.ok(young.some(p => p.y < 300) && young.some(p => p.y > 300));
  const extent = list => Math.max(...list.map(p => Math.abs(p.y - 300)));
  assert.ok(extent(old) > extent(young) + 15, 'the flanks expand while the anchor stays fixed');
  assert.ok(Math.max(...old.map(p => p.alpha)) < Math.max(...young.map(p => p.alpha)));
  assert.equal(points({ ...original, age: original.life }).length, 0);
});

test('distance sampling is deterministic across frame sizes and ignores global randomness', () => {
  const run = tick => {
    const w = whale(), scene = sceneOf(w), field = createWaterField();
    stepWater(field, scene, tick);
    cruise(field, scene, Math.round(3 / tick), tick);
    return field.wake.packets;
  };
  const a = run(1 / 60), b = run(1 / 30);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) for (const key of ['x', 'y', 'angle', 'age', 'life', 'seed', 'strength']) close(a[i][key], b[i][key], 1e-6);
  assert.deepEqual(run(1 / 60), a);
});

test('torus crossings use the shortest displacement and paint wrapped portions on both edges', () => {
  const w = whale({ x: 994, y: 300, length: 0, rig: { nodes: new Float64Array([1000, 300, 994, 300]) } });
  const scene = sceneOf(w), field = createWaterField();
  stepWater(field, scene, dt);
  for (let i = 0; i < 30; i++) {
    move(w, w.speed * dt, 0);
    if (w.x >= scene.width) { w.x -= scene.width; for (let j = 0; j < w.rig.nodes.length; j += 2) w.rig.nodes[j] -= scene.width; }
    stepWater(field, scene, dt);
  }
  assert.ok(field.wake.packets.length >= 1 && field.wake.packets.length <= 2);
  assert.ok(field.wake.packets.every(p => p.x < 30 || p.x > 970));
  const view = fakeTarget();
  drawWater(view.target, field, drawOptions());
  assert.ok(view.calls.some(p => p.x < 40) && view.calls.some(p => p.x > 960));
  assert.ok(view.calls.every(p => p.x < 80 || p.x > 920), 'no across-screen line is invented');
});

test('pause freezes history and a displaced resume or navigation correction cannot backfill long trails', () => {
  const { field, scene, w } = trail(), snapshot = structuredClone(field.wake);
  for (const tick of [0, -1, NaN, Infinity]) stepWater(field, scene, tick);
  assert.deepEqual(field.wake, snapshot);
  move(w, 260, 0);
  stepWater(field, scene, dt);
  assert.equal(field.wake.packets.length, snapshot.packets.length, 'a correction only resets the sample anchor');
  cruise(field, scene, 24);
  assert.ok(field.wake.packets.length > snapshot.packets.length, 'normal movement resumes after the correction');
  const count = field.wake.packets.length;
  move(w, 80, 0);
  stepWater(field, scene, 2);
  assert.ok(field.wake.packets.length <= count, 'a long gap ages old packets but never backfills the gap');
  const age = field.wake.packets[0]?.age;
  if (age !== undefined) assert.ok(age > snapshot.packets[0].age);
});

test('speed and proximity to the surface control strength without making stationary or hidden wakes', () => {
  const strength = (speed, submergence) => trail({ speed,
    _motion: { wave: 0, stroke: 0, submergence } }).field.wake.packets[0]?.strength ?? 0;
  assert.ok(strength(40, 0) > strength(12, 0));
  assert.ok(strength(40, 0) > strength(40, 0.08));
  assert.equal(strength(0, 0), 0);
  assert.equal(strength(40, 0.12), 0);
});

test('surface history and glyph work have hard global limits and removed whales leave no tracker memory', () => {
  const whales = Array.from({ length: 30 }, (_, i) => whale({ id: i, x: 100 + i * 25, y: 200 + (i % 5) * 30 }));
  const scene = sceneOf(...whales), field = createWaterField();
  stepWater(field, scene, dt);
  cruise(field, scene, 180);
  assert.equal(field.wake.packets.length, 96);
  const view = fakeTarget();
  const count = drawWater(view.target, field, drawOptions({ cellWidth: 2, cellHeight: 2 }));
  assert.ok(count > 100 && count <= 1200);
  assert.equal(view.calls.length, count);
  const limited = fakeTarget();
  assert.ok(drawWater(limited.target, field, drawOptions({ maxWakeGlyphs: 13 })) <= 13);
  stepWater(field, scene, dt, { maxWakePackets: 7 });
  assert.equal(field.wake.packets.length, 7);
  stepWater(field, { width: 1000, height: 600, whales: [] }, dt);
  assert.equal(field.wake.tracks.size, 0);
  stepWater(field, scene, dt, { maxWakePackets: 0 });
  assert.equal(field.wake.packets.length, 0);
});

test('wake rendering shares font, selected palette, fade and strict glyph-context contract', () => {
  const { field } = trail();
  for (const fade of [() => 0, () => NaN]) {
    const view = fakeTarget();
    assert.equal(drawWater(view.target, field, drawOptions({ fade })), 0);
    assert.equal(view.calls.length, 0);
  }
  const view = fakeTarget();
  drawWater(view.target, field, drawOptions({ fade: (x, y) => x < 390 && y < 310 ? 0.5 : 0 }));
  assert.ok(view.calls.length > 0);
  assert.ok(view.calls.every(p => p.x < 390 && p.y < 310 && p.alpha <= 0.3));
  assert.equal(view.base.textAlign, 'center'); assert.equal(view.base.textBaseline, 'middle');
});

test('reset, resize, scene replacement and the ripples toggle clear both wake packets and anchors', () => {
  const { field, scene } = trail();
  resetWaterField(field);
  assert.equal(field.wake.packets.length, 0); assert.equal(field.wake.tracks.size, 0);
  cruise(field, scene, 60);
  assert.ok(field.wake.packets.length > 0);
  scene.width = 800;
  stepWater(field, scene, dt);
  assert.equal(field.wake.packets.length, 0, 'even a direct water caller cannot connect two viewport sizes');
  const config = normalizeConfig({ count: 1, species: 'blue', speed: 1, ripples: true });
  const simulation = createWhaleSimulation(config, { seed: 42 });
  simulation.resize(1000, 600);
  for (let i = 0; i < 120; i++) simulation.advance(dt);
  assert.ok(simulation.water.wake.packets.length > 0, 'real simulation movement reaches the wake');
  simulation.update({ ...config, ripples: false });
  assert.equal(simulation.water.wake.packets.length, 0); assert.equal(simulation.water.wake.tracks.size, 0);
  simulation.advance(1);
  assert.equal(simulation.water.wake.packets.length, 0);
  simulation.update(config);
  for (let i = 0; i < 120; i++) simulation.advance(dt);
  assert.ok(simulation.water.wake.packets.length > 0);
  simulation.update({ ...config, text: '新' });
  assert.equal(simulation.water.wake.packets.length, 0);
  for (let i = 0; i < 120; i++) simulation.advance(dt);
  simulation.resize(800, 500);
  assert.equal(simulation.water.wake.packets.length, 0);
  simulation.dispose();
  assert.equal(simulation.water.wake.tracks.size, 0);
});

test('malformed geometry or packets cannot produce NaN glyphs or leak unlimited work', () => {
  const field = createWakeField();
  stepWake(field, { width: 1000, height: 600, whales: [null, {}, whale({ x: NaN })] }, dt);
  assert.equal(field.packets.length, 0);
  field.packets.push(null, { x: NaN, y: 4, age: 0, life: 2 });
  stepWake(field, sceneOf(), dt);
  assert.equal(field.packets.length, 0);
  assert.equal(visitWakePoints(field, {}, () => { throw new Error('no points expected'); }), 0);
});
