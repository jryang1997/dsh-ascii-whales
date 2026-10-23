import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, projectParticle } from '../src/model.js';
import { adoptSceneState, DIVE_NOSE_CONTACT, DIVE_TAIL_CONTACT, DIVE_WATERLINE, divePose, stepScene, whalePose } from '../src/motion.js';
import { deformWhaleParticle } from '../src/rig.js';
import { whaleSpecies } from '../src/species.js';

const timing = { entry: 3, under: 2, exit: 3 };
const waterline = DIVE_WATERLINE;
const overhead = { x: 800, y: 450, scale: 220, focal: 900, cameraZ: 400, near: 108,
  cy: 1, sy: 0, cp: 0, sp: 1, cr: 1, sr: 0, wave: 0, stroke: 0, turn: 0 };
const back = (x, y = -0.08, part = 'body') => ({ x, y, z: 0, nx: 0, ny: -1, nz: 0,
  seed: 0.4, material: 'skin', part });
const controls = ['pitch', 'depth', 'tailKick', 'arch'];

function poseAt(t, anatomy = whaleSpecies('blue')) {
  const action = divePose(t, timing);
  return { ...overhead, anatomy, submergence: action.submergence, noseFirst: action.noseFirst,
    divePitch: action.pitch, diveDepth: action.depth, diveKick: action.tailKick, diveArch: action.arch };
}

function forceDive(scene) {
  stepScene(scene, 1 / 60);
  const state = scene.whales[0]._motion;
  Object.assign(state.dive, { ...timing, startedAt: state.age, nextDecision: Infinity, contactStage: 0 });
  return state.age;
}

function contactHeight(scene, tail) {
  const whale = scene.whales[0];
  const pose = whalePose(whale, scene.time, scene.width, scene.height, 1);
  const probe = tail ? DIVE_TAIL_CONTACT : DIVE_NOSE_CONTACT;
  return deformWhaleParticle(probe, pose, {}).y;
}

test('half entry puts the head below water while the raised tail stays visible', () => {
  const pose = poseAt(timing.entry * 0.5);
  const head = deformWhaleParticle(back(1.04), pose, {});
  const tail = deformWhaleParticle(back(-1.05, 0.01, 'fluke'), pose, {});
  assert.ok(pose.divePitch >= 0.5, 'the body visibly foreshortens into the water');
  assert.ok(head.y > waterline && head.y > tail.y);
  assert.ok(tail.y < waterline, `raised tail y=${tail.y}`);
  assert.equal(projectParticle(back(1.04), pose).visibility, 0);
  assert.ok(projectParticle(back(-1.05, 0.01, 'fluke'), pose).visibility > 0.5,
    'the exposed tail must not fade along with the submerged head');
});

test('entry contains one tail lift and one forceful downstroke with a rotating fluke hinge', () => {
  const samples = Array.from({ length: 301 }, (_, i) => divePose(timing.entry * i / 300, timing));
  const kick = samples.map(sample => sample.tailKick);
  assert.ok(Math.min(...kick) < -0.45);
  assert.ok(Math.max(...kick) > 0.45);
  const signs = kick.filter(value => Math.abs(value) > 1e-6).map(Math.sign)
    .filter((sign, i, values) => i === 0 || sign !== values[i - 1]);
  assert.deepEqual(signs, [-1, 1], 'one deliberate lift then press, with no repeated oscillation');
  const base = { ...overhead, diveKick: 0 }, driven = { ...overhead, diveKick: 0.5 };
  const hinge = deformWhaleParticle(back(-0.96, 0.01, 'fluke'), driven, {});
  const tip = deformWhaleParticle(back(-1.2, 0.01, 'fluke'), driven, {});
  const flatHinge = deformWhaleParticle(back(-0.96, 0.01, 'fluke'), base, {});
  const flatTip = deformWhaleParticle(back(-1.2, 0.01, 'fluke'), base, {});
  assert.ok(tip.y - hinge.y > flatTip.y - flatHinge.y + 0.04,
    'the hinge rotates as well as translating the tail');
});

test('real positive depth reduces perspective and hides the entire underwater body', () => {
  const flat = { ...overhead, diveDepth: 0, divePitch: 0, diveKick: 0, diveArch: 0 };
  const deep = { ...flat, diveDepth: 1.2, submergence: 1 };
  const a = projectParticle(back(-0.5), flat), b = projectParticle(back(0.5), flat);
  const da = projectParticle(back(-0.5), deep), db = projectParticle(back(0.5), deep);
  assert.ok(db.x - da.x > 0 && db.x - da.x < b.x - a.x);
  assert.ok(da.perspective > 0 && da.perspective < a.perspective);
  assert.ok(da.z > a.z && Number.isFinite(da.x));
  assert.equal(deep.scale, flat.scale, 'size is not animated to zero');
  for (const species of ['blue', 'humpback', 'sperm', 'fin', 'bowhead']) {
    const scene = createScene(1, '鲸', species);
    for (const at of [timing.entry, timing.entry + timing.under * 0.5, timing.entry + timing.under]) {
      const pose = poseAt(at, whaleSpecies(species));
      assert.ok(pose.diveDepth >= 1.1 && pose.diveDepth <= 1.3);
      assert.ok(scene.particles.every(particle => projectParticle(particle, pose).visibility === 0), `${species} under at ${at}`);
    }
  }
});

test('powered exit exposes the nose before the tail and settles after one lift peak', () => {
  const exitStart = timing.entry + timing.under;
  const emerging = poseAt(exitStart + timing.exit * 0.32);
  assert.ok(projectParticle(back(1.04), emerging).visibility > 0.5);
  assert.equal(projectParticle(back(-1.05), emerging).visibility, 0);
  const lifted = divePose(exitStart + timing.exit * 0.58, timing);
  assert.ok(lifted.depth < 0, 'the back briefly rises above its resting waterline');
  let lastDepth = lifted.depth;
  for (let i = 59; i <= 100; i++) {
    const current = divePose(exitStart + timing.exit * i / 100, timing);
    assert.ok(current.depth >= lastDepth - 1e-12, 'settles monotonically rather than bouncing');
    lastDepth = current.depth;
  }
  const finish = divePose(8, timing);
  for (const key of controls) assert.equal(finish[key], 0);
});

test('all geometry controls have continuous velocity at phase joins and flat action endpoints', () => {
  const joins = [0, ...[0.18, 0.2, 0.35, 0.38, 0.46, 0.55, 0.65, 0.68, 0.92, 1].map(u => u * timing.entry),
    timing.entry + timing.under, ...[0.3, 0.32, 0.4, 0.58, 1].map(u => timing.entry + timing.under + u * timing.exit)];
  const epsilon = 1e-5;
  for (const t of joins) {
    const a = divePose(t - epsilon, timing), b = divePose(t, timing), c = divePose(t + epsilon, timing);
    for (const key of controls) {
      assert.ok(Number.isFinite(b[key]), key);
      const left = (b[key] - a[key]) / epsilon, right = (c[key] - b[key]) / epsilon;
      assert.ok(Math.abs(left - right) < 0.003, `${key} velocity jumps at ${t}: ${left}, ${right}`);
      if (t === 0 || t === 8) assert.ok(Math.abs(left) < 0.001 && Math.abs(right) < 0.001, `${key} endpoint`);
    }
  }
});

test('normals stay unit length and geometry and visibility converge continuously to the surface pose', () => {
  const probes = [back(1.04), back(0), back(-0.7), back(-1.2, 0.01, 'fluke'), back(0.01, 0.115, 'fin')];
  for (let i = 0; i <= 800; i++) {
    const pose = poseAt(i / 100);
    for (const particle of probes) {
      const out = deformWhaleParticle(particle, pose, {});
      assert.ok(Math.abs(Math.hypot(out.nx, out.ny, out.nz) - 1) < 1e-10);
    }
  }
  const scene = createScene(1, '鲸', 'humpback');
  for (const particle of scene.particles) {
    const flat = projectParticle(particle, { ...overhead, anatomy: whaleSpecies('humpback') });
    for (const t of [1e-5, 8 - 1e-5]) {
      const near = projectParticle(particle, poseAt(t, whaleSpecies('humpback')));
      assert.ok(Math.abs(near.visibility - flat.visibility) < 1e-6, `${particle.part} pops at ${t}`);
      assert.ok(Math.abs(near.x - flat.x) < 1e-5 && Math.abs(near.y - flat.y) < 1e-5);
    }
  }
  const particle = back(-0.4);
  assert.deepEqual(deformWhaleParticle(particle, overhead, {}), deformWhaleParticle(particle,
    { ...overhead, divePitch: 0, diveDepth: 0, diveKick: 0, diveArch: 0 }, {}));
  assert.deepEqual(projectParticle(particle, overhead), projectParticle(particle,
    { ...overhead, divePitch: 0, diveDepth: 0, diveKick: 0, diveArch: 0 }, {}));
});

test('one action emits exactly two geometry-timed contacts, and pause cannot emit another', () => {
  const scene = createScene(1), startedAt = forceDive(scene), state = scene.whales[0]._motion;
  const events = [];
  let serial = state.dive.splashSerial;
  for (let i = 0; i < 9 * 60; i++) {
    const beforeHeight = contactHeight(scene, serial === 0);
    stepScene(scene, 1 / 60);
    if (state.dive.splashSerial === serial) continue;
    assert.equal(state.dive.splashSerial, serial + 1);
    serial = state.dive.splashSerial;
    const elapsed = state.age - startedAt, after = divePose(elapsed, timing);
    events.push({ kind: state.dive.splashKind, elapsed });
    assert.ok(state.dive.splashStrength > 0.5 && state.dive.splashStrength <= 1);
    if (state.dive.splashKind === 'dive') {
      assert.ok(after.tailKick > 0, 'contact happens on the strong downstroke');
      assert.ok(beforeHeight < waterline && contactHeight(scene, true) >= waterline);
    } else {
      assert.ok(beforeHeight > waterline && contactHeight(scene, false) <= waterline);
      assert.ok(after.submergence > 0, 'surface contact precedes full emergence');
    }
    const held = structuredClone(scene);
    for (let frame = 0; frame < 60; frame++) stepScene(scene, 1 / 60, 0);
    assert.deepEqual(scene, held);
  }
  assert.deepEqual(events.map(event => event.kind), ['dive', 'surface']);
  assert.ok(events[0].elapsed > timing.entry * 0.5 && events[0].elapsed < timing.entry * 0.8);
  assert.ok(events[1].elapsed > timing.entry + timing.under && events[1].elapsed < 8);
  assert.equal(state.dive.splashSerial, 2, 'serial survives action completion');
});

test('adoption preserves active geometry and contact serial with independent state objects', () => {
  const previous = createScene(1), startedAt = forceDive(previous), source = previous.whales[0]._motion;
  while (source.dive.splashSerial < 1 && source.age < 4) stepScene(previous, 1 / 60);
  assert.equal(source.dive.splashSerial, 1);
  const next = createScene(1, '鲸', 'sperm', 1.4);
  adoptSceneState(previous, next);
  const state = next.whales[0]._motion;
  assert.notEqual(state.dive, source.dive);
  assert.deepEqual(state.dive, source.dive);
  for (const key of ['depth', 'tailKick', 'arch', 'pitch']) assert.equal(state[key], source[key]);
  const sourceBefore = structuredClone(source);
  stepScene(next, 1 / 60);
  assert.deepEqual(source, sourceBefore);
  stepScene(previous, 1 / 60);
  while (source.age - startedAt < 8.1) {
    for (const key of ['depth', 'tailKick', 'arch', 'pitch']) assert.equal(state[key], source[key]);
    assert.equal(state.dive.splashSerial, source.dive.splashSerial);
    stepScene(previous, 1 / 60);
    stepScene(next, 1 / 60);
  }
  assert.equal(state.dive.splashSerial, 2);
  const pose = whalePose(next.whales[0], next.time, next.width, next.height, 1);
  assert.equal(pose.pitch, Math.PI / 2);
  assert.equal(pose.diveDepth, state.depth);
  assert.equal(pose.diveKick, state.tailKick);
  assert.equal(pose.diveArch, state.arch);
});
