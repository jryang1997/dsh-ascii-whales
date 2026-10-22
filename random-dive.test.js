import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, resizeScene, stepScene } from './model.js';
import { adoptSceneState } from './motion.js';

test('a same-species school does not all take the opening dive together', () => {
  const scene = createScene(8, '鲸', 'blue');
  resizeScene(scene, 1600, 900);
  for (let i = 0; i < 14 * 60; i++) stepScene(scene, 1 / 60, 1);
  const underwater = scene.whales.filter(whale => whale._motion.submergence > 0.95).length;
  assert.ok(underwater < scene.whales.length,
    `${underwater}/${scene.whales.length} whales disappeared together at 14s`);
});

test('individual dive intervals are resampled rather than repeated as a fixed cycle', () => {
  const scene = createScene(3, '鲸', 'blue');
  resizeScene(scene, 1600, 900);
  const starts = scene.whales.map(() => []);
  const wasDiving = scene.whales.map(() => false);
  for (let tick = 0; tick < 300 * 30; tick++) {
    stepScene(scene, 1 / 30, 1);
    scene.whales.forEach((whale, id) => {
      const diving = whale._motion.submergence > 0.01;
      if (diving && !wasDiving[id]) starts[id].push(tick / 30);
      wasDiving[id] = diving;
    });
  }
  for (const [id, times] of starts.entries()) {
    assert.ok(times.length >= 3, `whale ${id} never completes repeated dives`);
    const intervals = times.slice(1).map((time, i) => time - times[i]);
    assert.ok(Math.max(...intervals) - Math.min(...intervals) > 1,
      `whale ${id} repeats a fixed period: ${intervals.join(', ')}`);
  }
});

function seededScene(count = 8, seed = 0x5eed1234, species = 'blue', size = 1) {
  const scene = createScene(count, '鲸', species, size);
  resizeScene(scene, 1600, 900);
  scene.diveSeed = seed;
  return scene;
}

function advance(scene, seconds, frame = 1 / 60, speed = 1) {
  for (let tick = 0; tick < Math.round(seconds / frame); tick++) stepScene(scene, frame, speed);
}

test('same-species whales skip real surface opportunities and resample every action', () => {
  const scene = seededScene();
  const records = scene.whales.map(() => []);
  let skippedWhileOtherDives = false, allSurfaceTicks = 0;
  for (let tick = 0; tick < 180 * 60; tick++) {
    const skipped = scene.whales.map(whale => whale._motion.dive?.skipped ?? 0);
    const starts = scene.whales.map(whale => whale._motion.dive?.dives ?? 0);
    stepScene(scene, 1 / 60, 1);
    const onSurface = scene.whales.filter(whale => whale._motion.submergence === 0).length;
    if (onSurface > 0) allSurfaceTicks++;
    for (const [id, whale] of scene.whales.entries()) {
      const dive = whale._motion.dive;
      if (dive.skipped > skipped[id]) {
        assert.equal(whale._motion.submergence, 0, 'a skipped opportunity stays on the surface');
        skippedWhileOtherDives ||= scene.whales.some((other, i) => i !== id && other._motion.submergence > 0.01);
      }
      if (dive.dives > starts[id]) records[id].push({ start: dive.startedAt,
        entry: dive.entry, under: dive.under, exit: dive.exit });
      if (tick < 6 * 60) assert.equal(whale._motion.submergence, 0, 'no dive in the first six seconds');
    }
  }
  assert.ok(skippedWhileOtherDives, 'one whale should skip while a neighbor independently dives');
  assert.ok(allSurfaceTicks / (180 * 60) > 0.9, 'most of the time at least one whale stays fully surfaced');
  assert.ok(new Set(scene.whales.map(whale => whale._motion.dive.activity)).size === 8,
    'same-species whales have individual activity');
  assert.equal(new Set(records.map(events => events[0]?.start)).size, 8, 'first dives differ');
  assert.equal(new Set(records.map(events => events[0]?.under)).size, 8, 'first underwater holds differ');
  for (const [id, events] of records.entries()) {
    assert.ok(events.length >= 2, `whale ${id} needs repeated sampled actions`);
    for (const key of ['entry', 'under', 'exit']) {
      assert.equal(new Set(events.map(event => event[key])).size, events.length, `${id} repeats ${key}`);
    }
    assert.ok(events.every(event => event.entry >= 2 && event.entry <= 4 && event.exit >= 2 && event.exit <= 4));
    assert.ok(scene.whales[id]._motion.dive.skipped > 0, `${id} never skipped a decision`);
  }
});

test('the independent stream can be seeded after creation and never consumes cruise randomness', () => {
  const active = seededScene(3, 12345), other = seededScene(3, 54321);
  stepScene(active, 1 / 60);
  stepScene(other, 1 / 60);
  assert.notDeepEqual(active.whales.map(whale => whale._motion.dive), other.whales.map(whale => whale._motion.dive));
  // Disable only the other school's dive decisions. Steering still takes its
  // usual random draws, and the active school's completed actions draw many more.
  for (const whale of other.whales) whale._motion.dive.nextDecision = Infinity;
  advance(active, 120);
  advance(other, 120);
  assert.ok(active.whales.some(whale => whale._motion.dive.dives >= 2));
  for (const [id, whale] of active.whales.entries()) {
    const twin = other.whales[id];
    for (const key of ['x', 'y', 'heading', 'turn', 'speed', 'vx', 'vy']) assert.equal(whale[key], twin[key], key);
    for (const key of ['seed', 'age', 'targetX', 'targetY', 'targetDue', 'wander', 'wanderGoal',
      'wanderDue', 'wave', 'stroke', 'cruise', 'agility']) assert.equal(whale._motion[key], twin._motion[key], key);
  }
});

test('dive decisions pause at zero speed and remain identical across frame subdivision', () => {
  const scenes = [seededScene(3), seededScene(3), seededScene(3)];
  advance(scenes[0], 90, 1 / 60);
  advance(scenes[1], 90, 1 / 30);
  advance(scenes[2], 90, 1 / 120);
  assert.deepEqual(scenes[1].whales, scenes[0].whales);
  assert.deepEqual(scenes[2].whales, scenes[0].whales);
  const before = structuredClone(scenes[0]);
  advance(scenes[0], 20, 1 / 60, 0);
  assert.deepEqual(scenes[0], before);
  // Pause in the middle of a real action as well as during a surface wait.
  const diving = seededScene(1);
  for (let i = 0; i < 120 * 60 && diving.whales[0]._motion.submergence < 0.1; i++) stepScene(diving, 1 / 60);
  assert.ok(diving.whales[0]._motion.submergence >= 0.1);
  const held = structuredClone(diving);
  advance(diving, 5, 1 / 60, 0);
  assert.deepEqual(diving, held);
});

test('adopting a new species and size deep-copies an ongoing action without resetting it', () => {
  const previous = seededScene(3);
  for (let i = 0; i < 120 * 60 && previous.whales[0]._motion.submergence < 0.1; i++) stepScene(previous, 1 / 60);
  assert.ok(previous.whales[0]._motion.submergence >= 0.1);
  const next = seededScene(3, 999, 'sperm', 1.4);
  assert.equal(adoptSceneState(previous, next), 3);
  const oldState = structuredClone(previous.whales.map(whale => whale._motion));
  for (const [id, whale] of next.whales.entries()) {
    assert.notEqual(whale._motion.dive, previous.whales[id]._motion.dive);
    assert.deepEqual(whale._motion.dive, previous.whales[id]._motion.dive);
    for (const key of ['submergence', 'pitch', 'noseFirst']) assert.equal(whale._motion[key], previous.whales[id]._motion[key]);
  }
  advance(next, 0.5);
  assert.deepEqual(previous.whales.map(whale => whale._motion), oldState, 'discarded scene was not mutated');
  advance(previous, 0.5);
  for (const [id, whale] of next.whales.entries()) {
    assert.deepEqual(whale._motion.dive, previous.whales[id]._motion.dive);
    for (const key of ['submergence', 'pitch', 'noseFirst']) assert.equal(whale._motion[key], previous.whales[id]._motion[key]);
  }
  const timing = { ...previous.whales[0]._motion.dive };
  const endsAt = timing.startedAt + timing.entry + timing.under + timing.exit;
  while (previous.whales[0]._motion.age <= endsAt) {
    stepScene(previous, 1 / 60);
    stepScene(next, 1 / 60);
    for (const key of ['submergence', 'pitch', 'noseFirst']) {
      assert.equal(next.whales[0]._motion[key], previous.whales[0]._motion[key], `${key} changed before the adopted dive finished`);
    }
    for (const key of ['entry', 'under', 'exit']) assert.equal(next.whales[0]._motion.dive[key], timing[key]);
  }
  assert.equal(next.whales[0]._motion.submergence, 0);
  assert.equal(next.whales[0]._motion.dive.completed, timing.completed + 1);
});

test('independent decisions allow a coincidental full-school dive without a concurrency limit', () => {
  const scene = seededScene(8);
  stepScene(scene, 1 / 60);
  for (const whale of scene.whales) {
    whale._motion.dive.activity = 1;
    whale._motion.dive.nextDecision = whale._motion.age + 1;
  }
  advance(scene, 5);
  assert.equal(scene.whales.filter(whale => whale._motion.submergence === 1).length, 8);
});

test('fixed-seed one-through-eight whale ten-minute simulation records observed activity', t => {
  const seed = 0x5eed1234, ticks = 600 * 60;
  const stats = [];
  for (let count = 1; count <= 8; count++) {
    const scene = seededScene(count, seed);
    let anySurface = 0, allUnder = 0, underwaterSum = 0, maxUnder = 0;
    const firstStarts = scene.whales.map(() => null);
    for (let tick = 0; tick < ticks; tick++) {
      stepScene(scene, 1 / 60);
      const under = scene.whales.filter(whale => whale._motion.submergence > 0.95).length;
      underwaterSum += under;
      maxUnder = Math.max(maxUnder, under);
      if (under === count) allUnder++;
      if (scene.whales.some(whale => whale._motion.submergence === 0)) anySurface++;
      scene.whales.forEach((whale, id) => {
        if (firstStarts[id] === null && whale._motion.dive.startedAt !== null) firstStarts[id] = whale._motion.dive.startedAt;
      });
    }
    const actions = scene.whales.map(whale => whale._motion.dive.dives);
    const skipped = scene.whales.reduce((sum, whale) => sum + whale._motion.dive.skipped, 0);
    assert.ok(Math.min(...actions) >= 5, `${count} whales: someone stopped diving`);
    assert.ok(skipped > count, `${count} whales: no real skipped opportunities`);
    assert.ok(anySurface / ticks > 0.5, `${count} whales: surface should be occupied most of the time`);
    stats.push({ count, actions, skipped, firstStarts: firstStarts.map(value => +value.toFixed(2)),
      averageFullyUnder: +(underwaterSum / ticks).toFixed(3), maxFullyUnder: maxUnder,
      anySurfacePercent: +(anySurface / ticks * 100).toFixed(2),
      allFullyUnderPercent: +(allUnder / ticks * 100).toFixed(2) });
  }
  t.diagnostic(`Observed 600s per school, dt=1/60, speed=1, species=blue, 1600x900, seed=${seed}: ${JSON.stringify(stats)}`);
});
