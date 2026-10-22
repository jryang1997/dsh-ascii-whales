import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, resizeScene, stepScene, whalePose, transformParticle, projectParticle } from './model.js';
import { surfaceInkTone, createInkPalette, glyphInkIndex } from './shading.js';

const body = extra => ({ x: 0.3, y: 0, z: 0, nx: 0, ny: -1, nz: 0, seed: 0.5, material: 'skin', part: 'body', ...extra });
const scene = createScene(1);
const pose = () => whalePose(scene.whales[0], 0, 1600, 900, 1);

test('overhead camera maps model height to depth without changing the sea-plane position', () => {
  const p = { ...pose(), stroke: 0, turn: 0 };
  const high = transformParticle(body({ y: -0.2 }), p);
  const low = transformParticle(body({ y: 0.2 }), p);
  assert.ok(Math.hypot(high.x - low.x, high.y - low.y) < 1e-7,
    'vertical height is being drawn sideways on the interface instead of into the water');
  assert.ok(high.z < low.z - p.scale * 0.39, 'raised back must be closer to the camera');
});

test('both sides and the spread of the flukes lie in the visible sea plane', () => {
  const p = { ...pose(), stroke: 0, turn: 0 };
  const left = transformParticle(body({ z: -0.48 }), p);
  const right = transformParticle(body({ z: 0.48 }), p);
  const span = Math.hypot(left.x - right.x, left.y - right.y) / p.scale;
  assert.ok(span > 0.94, `lateral spread is foreshortened to ${span.toFixed(3)}, a side view`);
});

test('raised dorsal surface uses substantially darker ink than the lower flank', () => {
  const p = { ...pose(), stroke: 0, turn: 0 };
  const crown = projectParticle(body({ y: -0.235 }), p);
  const flank = projectParticle(body({ y: -0.04, z: 0.185, ny: -0.2, nz: 0.98 }), p);
  assert.ok(crown.light < flank.light - 0.25,
    `crown tone ${crown.light.toFixed(3)} is not darker than flank ${flank.light.toFixed(3)}`);
  assert.equal(crown.elevation, 0.235);
  for (const name of ['ocean', 'azure', 'indigo']) {
    const palette = createInkPalette(name);
    const rgb = tone => palette[glyphInkIndex(tone, 0.14)].match(/\d+/g).map(Number);
    const dark = rgb(crown.light), pale = rgb(flank.light);
    assert.ok(dark.every((channel, i) => channel < pale[i] - 35));
  }
});

test('water relief is darker as the back rises, with restrained surface texture', () => {
  let previous = Infinity;
  for (const elevation of [0, 0.04, 0.08, 0.12, 0.16, 0.20, 0.235]) {
    const tone = surfaceInkTone(elevation, 0.8, 0, 'skin', 0.5);
    assert.ok(tone < previous);
    previous = tone;
  }
  const low = surfaceInkTone(0.15, 0.8, 0, 'skin', 0);
  const high = surfaceInkTone(0.15, 0.8, 0, 'skin', 1);
  assert.ok(Math.abs(low - high) <= 0.026, 'texture should not obscure the dorsal volume');
});

test('swimming changes heading while the overhead camera remains fixed', () => {
  const s = createScene(3);
  for (let frame = 0; frame < 600; frame++) {
    stepScene(s, 1 / 60, 1);
    if (frame % 60) continue;
    for (const whale of s.whales) {
      const p = whalePose(whale, s.time, 1600, 900, 1);
      assert.equal(p.yaw, 0); assert.equal(p.pitch, Math.PI / 2);
      assert.equal(p.cp, 0); assert.equal(p.sp, 1);
      assert.equal(p.roll, whale.heading);
    }
  }
});

test('visible body surface comes from the back rather than the belly', () => {
  const p = { ...pose(), stroke: 0, turn: 0 };
  const visible = scene.particles.filter(particle => particle.part === 'body'
    && projectParticle(particle, p).visibility > 0.7);
  const upper = visible.filter(particle => particle.y <= 0.02);
  assert.ok(visible.length > 100);
  assert.ok(upper.length / visible.length > 0.95,
    `only ${(upper.length / visible.length * 100).toFixed(1)}% of visible body samples are dorsal`);
});

test('body follow-through stays visible across the sea surface when turning', () => {
  const s = createScene(1);
  resizeScene(s, 1200, 800);
  const whale = s.whales[0];
  whale._motion.targetX = whale.x;
  whale._motion.targetY = whale.y + 450;
  whale._motion.targetDue = 100;
  for (let frame = 0; frame < 360; frame++) stepScene(s, 1 / 60, 1);
  const straight = structuredClone(whale);
  delete straight.rig;
  const a = whalePose(whale, s.time, 1200, 800, 1);
  const b = whalePose(straight, s.time, 1200, 800, 1);
  const tail = body({ x: -1.05 });
  const curvedPoint = transformParticle(tail, a), straightPoint = transformParticle(tail, b);
  assert.ok(Math.hypot(curvedPoint.x - straightPoint.x, curvedPoint.y - straightPoint.y) / a.scale > 0.04,
    'the spine bends down into the water but does not bend in the visible sea plane');
});
