import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterField, stepWater, drawWater } from './water.js';
import { createScene, resizeScene, stepScene } from './model.js';

const dt = 1 / 60;
function whale() {
  return { id: 0, x: 300, y: 200, heading: 0, length: 180, bodyRadius: 24,
    rig: { nodes: new Float64Array([382, 200, 300, 210, 204, 220]) },
    _motion: { age: 0, wave: 0, stroke: 0, submergence: 0.5,
      dive: { startedAt: 0, splashSerial: 0, splashKind: '', splashStrength: 0 } } };
}
function observe() {
  const field = createWaterField(), w = whale(), scene = { whales: [w] };
  stepWater(field, scene, dt);
  return { field, w, scene };
}
function contact(w, kind, strength = 1) {
  w._motion.dive.splashSerial++;
  w._motion.dive.splashKind = kind;
  w._motion.dive.splashStrength = strength;
}

test('a deliberate tail drive makes water without a cruise beat crossing', () => {
  const { field, w, scene } = observe();
  contact(w, 'dive');
  stepWater(field, scene, dt);
  assert.equal(field.ripples.length, 1);
  assert.equal(field.ripples[0].kind, 'dive');
  assert.equal(field.ripples[0].x, 204);
  assert.equal(field.ripples[0].y, 220);
  for (let i = 0; i < 20; i++) stepWater(field, scene, dt);
  assert.equal(field.ripples.length, 1, 'one contact is never re-emitted');
});

test('breaking the surface displaces water at the head, with more reach than cruising', () => {
  const { field, w, scene } = observe();
  contact(w, 'surface');
  stepWater(field, scene, dt);
  assert.equal(field.ripples.length, 1);
  const ring = field.ripples[0];
  assert.equal(ring.kind, 'surface');
  assert.equal(ring.x, 382);
  assert.equal(ring.y, 200);
  assert.ok(ring.endRadius > w.bodyRadius * 2.8);
  assert.ok(ring.life >= 3.5);
});

test('pause does not consume an impact and enabling water does not replay old impacts', () => {
  const { field, w, scene } = observe();
  contact(w, 'surface');
  stepWater(field, scene, 0);
  assert.equal(field.ripples.length, 0);
  stepWater(field, scene, dt);
  assert.equal(field.ripples.length, 1);
  const fresh = createWaterField();
  stepWater(fresh, scene, dt);
  assert.equal(fresh.ripples.length, 0, 'first observation records an existing contact silently');
  contact(w, 'dive');
  stepWater(fresh, scene, dt);
  assert.equal(fresh.ripples.length, 1);
});

test('the visible entry gesture does not also produce ordinary cruise splashes', () => {
  const { field, w, scene } = observe();
  w._motion.submergence = 0;
  w._motion.stroke = 1;
  w._motion.wave = Math.PI * 2 + 0.1;
  stepWater(field, scene, dt);
  assert.equal(field.ripples.length, 0, 'the deliberate gesture owns its water contact');
});

test('important surface impacts displace an old ring while honoring the global budget', () => {
  const { field, w, scene } = observe();
  field.ripples.push({ x: 20, y: 20, age: 1, life: 4, startRadius: 3,
    endRadius: 30, strength: 0.5, seed: 0.1 });
  contact(w, 'surface');
  stepWater(field, scene, dt, { maxRipples: 1 });
  assert.equal(field.ripples.length, 1);
  assert.equal(field.ripples[0].kind, 'surface');
});

test('one actual dive makes exactly one tail impact and one nose-breaking wave', () => {
  const scene = createScene(1, '鲸', 'blue');
  resizeScene(scene, 1400, 850);
  stepScene(scene, dt, 1);
  const w = scene.whales[0], state = w._motion, dive = state.dive;
  dive.startedAt = state.age;
  dive.entry = 3;
  dive.under = 2;
  dive.exit = 3;
  const startedAt = dive.startedAt;
  const field = createWaterField(), seen = new Set(), contacts = [];
  stepWater(field, scene, dt);
  for (let tick = 0; tick < 9 * 60; tick++) {
    const previousTime = scene.time;
    stepScene(scene, dt, 1);
    stepWater(field, scene, scene.time - previousTime);
    for (const ring of field.ripples) {
      if (!seen.has(ring) && ring.kind) {
        seen.add(ring);
        contacts.push({ kind: ring.kind, elapsed: state.age - startedAt });
        const nodes = w.rig.nodes;
        const index = ring.kind === 'dive' ? nodes.length - 2 : 0;
        assert.equal(ring.x, nodes[index]);
        assert.equal(ring.y, nodes[index + 1]);
      }
    }
  }
  assert.deepEqual(contacts.map(event => event.kind), ['dive', 'surface']);
  assert.ok(contacts[0].elapsed > 3 * 0.45 && contacts[0].elapsed < 3 * 0.9);
  assert.ok(contacts[1].elapsed > 5 && contacts[1].elapsed < 5 + 3 * 0.65);
});

test('surface water is an oriented bow wave and fades under the existing mask', () => {
  const { field, w, scene } = observe();
  contact(w, 'surface');
  stepWater(field, scene, dt);
  const ring = field.ripples[0];
  assert.ok(ring);
  ring.age = 0.55;
  const calls = [];
  const ctx = { font: '', fillStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '',
    fillText(glyph, x, y) { calls.push({ glyph, x, y, alpha: this.globalAlpha }); } };
  const options = { width: 700, height: 400, cellWidth: 6, cellHeight: 6, opacity: 0.7 };
  drawWater(ctx, field, options);
  assert.ok(calls.length > 12);
  assert.ok(calls.some(p => p.x > ring.x + ring.startRadius));
  assert.ok(calls.every(p => p.alpha <= 0.7));
  calls.length = 0;
  drawWater(ctx, field, { ...options, fade: () => 0 });
  assert.equal(calls.length, 0);
  assert.equal(ctx.globalAlpha, 1);
});
