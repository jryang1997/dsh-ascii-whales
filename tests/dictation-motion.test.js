import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeConfig } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { bodyReach, gatherGeometry } from '../src/dictation.js';

const CARD = { left: 220, top: 710, width: 720, height: 118 };
const CONFIG = overrides => normalizeConfig({ ...DEFAULTS, glass: false, composerAvoid: false,
  ripples: false, wind: false, clouds: false, rain: false, spout: false, activity: false, ...overrides });
const RECORDING = { schema: 1, seq: 1, phase: 'recording', since: 0, sessionId: null };
const DONE = { schema: 1, seq: 2, phase: 'done', since: 0, sessionId: null };
const STEP = 1 / 60;
const advance = (simulation, seconds) => {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) simulation.advance(STEP);
};
const bodySamples = whale => [-0.5357142857142857, -0.2857142857142857, -0.0357142857142857,
  0.2142857142857143, 0.4642857142857143].map(u => ({
  x: whale.x + Math.cos(whale.heading) * whale.length * u,
  y: whale.y + Math.sin(whale.heading) * whale.length * u }));
const inside = (rect, x, y) => x > rect.left && x < rect.left + rect.width
  && y > rect.top && y < rect.top + rect.height;

test('a recording take pulls the school into the band and slows it down', () => {
  const simulation = createWhaleSimulation(CONFIG(), { seed: 21 });
  simulation.resize(1160, 860);
  advance(simulation, 10);
  simulation.setDictationAnchor(CARD);
  simulation.setDictation(RECORDING, () => 0.7);
  const start = simulation.scene.whales.map(whale => ({ x: whale.x, y: whale.y }));
  advance(simulation, 22);
  const directive = simulation.scene.dictation;
  assert.equal(directive.active, true);
  assert.ok(directive.engage > 0.99, 'the ease reaches the hold');
  assert.ok(Array.isArray(directive.slots) && directive.slots.length === simulation.scene.whales.length);
  const slots = directive.slots;
  let arrived = 0;
  for (let i = 0; i < simulation.scene.whales.length; i += 1) {
    const whale = simulation.scene.whales[i];
    if (Math.hypot(whale.x - slots[i].x, whale.y - slots[i].y) < whale.length * 0.75) arrived += 1;
  }
  assert.ok(arrived >= Math.ceil(simulation.scene.whales.length * 0.6), 'most of the school reaches the band');
  for (let i = 0; i < simulation.scene.whales.length; i += 1) {
    const whale = simulation.scene.whales[i];
    for (const point of bodySamples(whale)) {
      assert.equal(inside(CARD, point.x, point.y), false, 'no body sample sits inside the composer card');
    }
  }
  const moved = simulation.scene.whales.reduce((sum, whale, index) =>
    sum + Math.hypot(whale.x - start[index].x, whale.y - start[index].y), 0);
  assert.ok(moved > 0, 'the school actually travelled during the take');
});

test('the hold suppresses new dives and keeps tail ripples below the wake threshold', () => {
  const simulation = createWhaleSimulation(CONFIG(), { seed: 22 });
  simulation.resize(1160, 860);
  advance(simulation, 10);
  const divesBefore = simulation.scene.whales.map(whale => whale._motion.dive.dives);
  simulation.setDictationAnchor(CARD);
  simulation.setDictation(RECORDING, () => 0.5);
  advance(simulation, 20);
  simulation.scene.whales.forEach((whale, index) => {
    assert.equal(whale._motion.dive.dives, divesBefore[index], 'no new dive while listening');
    assert.ok(whale._motion.stroke <= 0.3, 'the body wave stays under the ripple threshold');
    assert.ok(whale._motion.submergence <= 0.001, 'the body stays surfaced');
  });
});

test('done releases the hold, the school disperses and dives become possible again', () => {
  const simulation = createWhaleSimulation(CONFIG(), { seed: 23 });
  simulation.resize(1160, 860);
  advance(simulation, 10);
  simulation.setDictationAnchor(CARD);
  simulation.setDictation(RECORDING, () => 0.5);
  advance(simulation, 18);
  const held = simulation.scene.whales.map(whale => ({ x: whale.x, y: whale.y }));
  simulation.setDictation(DONE, () => 0);
  advance(simulation, 3);
  assert.equal(simulation.scene.dictation.engage, 0, 'the exit ramp has finished');
  assert.equal(simulation.scene.dictation.active, false);
  let spread = 0;
  simulation.scene.whales.forEach((whale, index) => {
    spread += Math.hypot(whale.x - held[index].x, whale.y - held[index].y);
  });
  assert.ok(spread > 0, 'the school leaves the band instead of freezing there');
  for (const whale of simulation.scene.whales) {
    assert.ok(Number.isFinite(whale.x) && Number.isFinite(whale.y));
  }
});

test('identical takes stay deterministic and never jump between frames', () => {
  const run = () => {
    const simulation = createWhaleSimulation(CONFIG(), { seed: 24 });
    simulation.resize(1160, 860);
    advance(simulation, 10);
    simulation.setDictationAnchor(CARD);
    simulation.setDictation(RECORDING, () => 0.5);
    const positions = [];
    for (let frame = 0; frame < 12 * 60; frame += 1) {
      simulation.advance(STEP);
      positions.push(simulation.scene.whales.map(whale => ({ x: whale.x, y: whale.y, speed: whale.speed })));
    }
    simulation.setDictation(DONE, () => 0);
    advance(simulation, 4);
    return positions;
  };
  const first = run();
  const second = run();
  assert.deepEqual(first, second, 'the same take and seed reproduce the same school');
  for (let frame = 1; frame < first.length; frame += 1) {
    for (let i = 0; i < first[frame].length; i += 1) {
      const before = first[frame - 1][i], after = first[frame][i];
      // The sea wraps: compare shortest-period deltas, not raw coordinates.
      const dx = after.x - before.x - Math.round((after.x - before.x) / 1160) * 1160;
      const dy = after.y - before.y - Math.round((after.y - before.y) / 860) * 860;
      const moved = Math.hypot(dx, dy);
      assert.ok(moved <= Math.max(before.speed, 36) * STEP * 2.2 + 1, 'no position jump');
    }
  }
});

test('turning the switch off drops the directive and lets the school resume cruising', () => {
  const base = CONFIG();
  const simulation = createWhaleSimulation(base, { seed: 25 });
  simulation.resize(1160, 860);
  advance(simulation, 10);
  simulation.setDictationAnchor(CARD);
  simulation.setDictation(RECORDING, () => 0.5);
  advance(simulation, 10);
  simulation.update({ ...base, dictationEcho: false });
  assert.equal(simulation.scene.dictation.active, false);
  assert.equal(simulation.scene.dictation.anchor, null);
  advance(simulation, 2);
  assert.equal(simulation.scene.dictation.engage, 0);
});

test('a growing multi-line composer raises the band without rebuilding the scene', () => {
  const simulation = createWhaleSimulation(CONFIG(), { seed: 26 });
  simulation.resize(1160, 860);
  advance(simulation, 10);
  simulation.setDictationAnchor(CARD);
  simulation.setDictation(RECORDING, () => 0.5);
  advance(simulation, 8);
  const scene = simulation.scene;
  const lowBand = scene.dictation.slots.map(slot => slot && slot.y);
  simulation.setDictationAnchor({ ...CARD, top: 610, height: 218 });
  advance(simulation, 1);
  assert.equal(simulation.scene, scene, 'the composer growing never rebuilds the school');
  const highBand = scene.dictation.slots.map(slot => slot && slot.y);
  for (let i = 0; i < lowBand.length; i += 1) {
    assert.ok(highBand[i] <= lowBand[i], 'the band moved up with the card');
  }
});

test('unassigned whales keep renewing cruise routes while safe rows gather', () => {
  const simulation = createWhaleSimulation(CONFIG({ count: 5, whaleSize: 1.55 }), { seed: 21 });
  simulation.resize(800, 600);
  advance(simulation, 5);
  simulation.setDictationAnchor({ left: 96, top: 445, width: 640, height: 110 });
  simulation.setDictation(RECORDING, () => 0.02);
  advance(simulation, 8);
  const directive = simulation.scene.dictation;
  assert.ok(directive.engage > 0.99);
  const unassigned = simulation.scene.whales.filter((whale, index) => !directive.slots[index]);
  assert.ok(unassigned.length > 0 && unassigned.length < simulation.scene.whales.length);
  for (const whale of unassigned) whale._motion.targetDue = -1;
  advance(simulation, 1);
  for (const whale of unassigned) {
    assert.ok(whale._motion.targetDue > 0, 'a whale without a slot must still choose cruise routes');
    assert.ok(Number.isFinite(whale.heading) && Number.isFinite(whale.speed));
  }
});

test('composer avoidance raises the waiting band by the avoidance rectangle', () => {
  const create = () => {
    const simulation = createWhaleSimulation(CONFIG({ composerAvoid: true }), { seed: 27 });
    simulation.resize(1160, 860);
    advance(simulation, 6);
    return simulation.scene.whales;
  };
  const whales = create();
  const plain = gatherGeometry({ card: CARD, whales, width: 1160, height: 860 });
  const avoided = gatherGeometry({ card: CARD, whales, width: 1160, height: 860, composerAvoid: true });
  assert.ok(plain && avoided);
  for (let i = 0; i < plain.length; i += 1) {
    assert.ok(avoided[i].y < plain[i].y, 'avoidance clears extra room above the card');
    assert.ok(CARD.top - avoided[i].y >= bodyReach(whales[i]) + 16);
  }
});
