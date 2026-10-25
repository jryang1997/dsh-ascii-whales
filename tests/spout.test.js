import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene, whalePose, createDepthGrid, normalizeConfig, projectParticle } from '../src/model.js';
import { attachSpout, spoutAge, spoutBlit, spoutFrame, spoutHit } from '../src/spout.js';

const ALLOWED = new Set([' ', '.', "'", '`', '~', '-', '*', 'o', 'O']);
const SPECIES = ['blue', 'humpback', 'fin', 'bowhead', 'sperm'];
const PHASES = ['jet', 'bush', 'droplets'];

function fakeInk() {
  const calls = [];
  let armed = 0;
  const ink = {
    globalAlpha: 1, fillStyle: '#000', textAlign: 'left', textBaseline: 'alphabetic', font: '10px serif',
    fillText(glyph, x, y) {
      if (armed > 0) { armed -= 1; throw new Error('fillText failed'); }
      calls.push({ glyph, x, y, alpha: this.globalAlpha, fillStyle: this.fillStyle });
    },
  };
  return { ink, calls, throwOnce() { armed = 1; } };
}

function gridWith(ownerAt, whaleId = 0) {
  const columns = 4, rows = 3, cellWidth = 10, cellHeight = 12;
  const owners = new Int32Array(columns * rows);
  owners.fill(-1);
  if (ownerAt) owners[ownerAt.row * columns + ownerAt.col] = 0;
  return {
    grid: { columns, rows, cellWidth, cellHeight, width: columns * cellWidth, height: rows * cellHeight, owners },
    particles: [{ whale: whaleId }],
    inside: { x: ((ownerAt?.col ?? 1) + 0.5) * cellWidth, y: ((ownerAt?.row ?? 1) + 0.5) * cellHeight },
  };
}

test('spout frames are fixed stamps with equal rows and a small allowed alphabet', () => {
  const expected = {
    blue: {
      basis: 'screen',
      jet: { anchor: { row: 1, col: 2 }, rows: ['  *  ', '* * *', '  *  '] },
      bush: { anchor: { row: 2, col: 2 }, rows: [' . . ', '. * .', '* * *', '. * .', ' . . '] },
      droplets: { anchor: { row: 2, col: 2 }, rows: ['.   .', '  .  ', '. . .', '  .  ', '.   .'] },
    },
    humpback: {
      basis: 'screen',
      jet: { anchor: { row: 1, col: 4 }, rows: ['  .*.*.  ', '   ***   ', '  .*.*.  '] },
      bush: { anchor: { row: 2, col: 4 }, rows: ['  .  *  .', ' . o  o .', '*   *   *', ' . o  o .', '  .  *  .'] },
      droplets: { anchor: { row: 2, col: 4 }, rows: ['.   .   .', '  .   .  ', '.   .   .', '    .    ', '.   .   .'] },
    },
    bowhead: {
      basis: 'lateral',
      jet: { anchor: { row: 1, col: 5 }, rows: ['  .     .  ', '     *     ', "  '     '  "] },
      bush: { anchor: { row: 2, col: 5 }, rows: ['.    .    .', "  '     '  ", '    * *    ', "  '     '  ", '.    .    .'] },
      droplets: { anchor: { row: 2, col: 5 }, rows: ['.         .', '  .     .  ', '     .     ', '  .     .  ', '.         .'] },
    },
    fin: {
      basis: 'screen', unverified: true,
      jet: { anchor: { row: 0, col: 1 }, rows: [' * '] },
      bush: { anchor: { row: 1, col: 1 }, rows: [' . ', '* *', ' . '] },
      droplets: { anchor: { row: 0, col: 1 }, rows: [' . '] },
    },
    sperm: {
      basis: 'body',
      jet: { anchor: { row: 0, col: 0 }, rows: ['* .', " ' ", '  o'] },
      bush: { anchor: { row: 0, col: 0 }, rows: ['* ..', " '~ ", ' o. ', '  . '] },
      droplets: { anchor: { row: 0, col: 0 }, rows: ['* .', ' . ', '  .'] },
    },
  };
  for (const species of SPECIES) for (const phase of PHASES) {
    const frame = spoutFrame(species, phase);
    const spec = expected[species];
    assert.deepEqual(frame.rows, spec[phase].rows, `${species} ${phase}`);
    assert.deepEqual(frame.anchor, spec[phase].anchor, `${species} ${phase}`);
    assert.equal(frame.basis, spec.basis);
    assert.equal(frame.unverified, species === 'fin' ? true : undefined);
    const width = frame.rows[0].length;
    assert.ok(frame.rows.every(row => row.length === width), `${species} ${phase} rows differ`);
    for (const row of frame.rows) for (const glyph of row) assert.ok(ALLOWED.has(glyph), glyph);
  }
  const blueBush = spoutFrame('blue', 'bush');
  const humpbackBush = spoutFrame('humpback', 'bush');
  const bowheadBush = spoutFrame('bowhead', 'bush');
  assert.ok(bowheadBush.rows[0].length > blueBush.rows[0].length);
  assert.ok(humpbackBush.rows[0].length > humpbackBush.rows.length);
  for (const phase of PHASES) assert.deepEqual(spoutFrame('sperm', phase).anchor, { row: 0, col: 0 });
  assert.equal(spoutFrame('fin', 'bush').unverified, true);
  for (const species of ['blue', 'humpback', 'bowhead', 'sperm']) assert.ok(spoutFrame(species, 'jet').unverified !== true);
  assert.equal(spoutFrame('orca', 'jet'), null);
  assert.equal(spoutFrame('blue', 'foam'), null);
  assert.equal(spoutFrame('blue', null), null);
});

test('spout age cuts jet, bush and droplets, and keeps 1499 alive', () => {
  assert.deepEqual(spoutAge(0), { phase: 'jet', alpha: 1 });
  assert.equal(spoutAge(219).phase, 'jet');
  assert.equal(spoutAge(220).phase, 'bush');
  assert.equal(spoutAge(220).alpha, 1);
  assert.equal(spoutAge(500).phase, 'bush');
  const mid = spoutAge(1100);
  assert.equal(mid.phase, 'droplets');
  assert.ok(mid.alpha < 1);
  assert.ok(Math.abs(mid.alpha - (1500 - 1100) / 800) < 1e-12);
  assert.equal(spoutAge(5000), null);
  assert.notEqual(spoutAge(1499), null);
  assert.equal(spoutAge(1499).phase, 'droplets');
  assert.equal(spoutAge(1500), null);
  assert.equal(spoutAge(-1), null);
  assert.equal(spoutAge(Number.NaN), null);
});

test('spout hit ignores empty water, chrome and non-primary clicks', () => {
  const { grid, particles, inside } = gridWith({ row: 1, col: 2 }, 4);
  const hit = (extra = {}) => spoutHit({ enabled: true, button: 0, tag: 'div', editable: false, composer: false, role: '', ...inside, ...extra }, grid, particles);
  assert.equal(hit(), 4);
  const empty = gridWith(null);
  assert.equal(spoutHit({ enabled: true, button: 0, tag: 'div', x: empty.inside.x, y: empty.inside.y }, empty.grid, empty.particles), null);
  assert.equal(hit({ x: -1 }), null);
  assert.equal(hit({ y: -0.01 }), null);
  assert.equal(hit({ x: grid.width }), null);
  assert.equal(hit({ y: grid.height }), null);
  assert.equal(hit({ enabled: false }), null);
  assert.equal(hit({ button: 2 }), null);
  for (const tag of ['button', 'input', 'textarea', 'a', 'select', 'label', 'summary', 'BUTTON', 'Label']) {
    assert.equal(hit({ tag }), null, tag);
  }
  assert.equal(hit({ editable: true }), null);
  assert.equal(hit({ composer: true }), null);
  assert.equal(hit({ role: 'textbox' }), null);
  assert.equal(hit({ role: 'button' }), null);
  assert.equal(hit({ role: 'slider' }), null);
  assert.equal(spoutHit({ enabled: true, button: 0, ...inside }, null, particles), null);
});

test('spout blit skips faint ink and spaces, and restores the context', () => {
  const place = { alpha: 1, anchorX: 40, anchorY: 70, acrossX: 8, acrossY: 0, alongX: 0, alongY: 14 };
  const quiet = fakeInk();
  quiet.ink.globalAlpha = 0.25;
  quiet.ink.fillStyle = 'red';
  spoutBlit(quiet.ink, spoutFrame('blue', 'jet'), { ...place, alpha: 0.03 });
  assert.equal(quiet.calls.length, 0);
  assert.equal(quiet.ink.globalAlpha, 0.25);
  assert.equal(quiet.ink.fillStyle, 'red');

  const spaced = fakeInk();
  spaced.ink.globalAlpha = 0.4;
  spaced.ink.fillStyle = 'navy';
  spoutBlit(spaced.ink, { rows: [' * ', '   '], anchor: { row: 0, col: 1 } }, place);
  assert.equal(spaced.calls.length, 1);
  assert.equal(spaced.calls[0].glyph, '*');
  assert.equal(spaced.calls[0].x, place.anchorX);
  assert.equal(spaced.calls[0].y, place.anchorY);
  assert.equal(spaced.ink.globalAlpha, 0.4);
  assert.equal(spaced.ink.fillStyle, 'navy');
  assert.equal(spaced.ink.textAlign, 'left');
  assert.equal(spaced.ink.textBaseline, 'alphabetic');
  assert.equal(spaced.ink.font, '10px serif');

  const broken = fakeInk();
  broken.ink.globalAlpha = 0.8;
  broken.ink.fillStyle = 'orange';
  broken.throwOnce();
  assert.throws(() => spoutBlit(broken.ink, spoutFrame('blue', 'bush'), place), /fillText failed/);
  assert.equal(broken.ink.globalAlpha, 0.8);
  assert.equal(broken.ink.fillStyle, 'orange');
});

test('a surfaced whale spouts from the blowhole on its own, then leaves the mist where it started', () => {
  assert.equal(normalizeConfig({}).spout, true);
  const scene = createScene(1, '鲸', 'blue', 1);
  const poseA = whalePose(scene.whales[0], 0, 1600, 900, 0);
  const poseB = { ...poseA, x: poseA.x + 280 };
  const mark = { x: 0.62, y: -0.12, z: 0, nx: 0, ny: -1, nz: 0, part: 'body', material: 'skin', seed: 0 };
  const projectedA = projectParticle(mark, poseA);
  assert.ok(Math.hypot(projectedA.x - projectParticle(mark, poseB).x) > 50);

  const grid = createDepthGrid(1600, 900, 11);
  let enabled = true, reduced = false, hidden = false, poses = [poseA], current = scene, now = 0;
  const read = () => ({
    enabled, reduced, hidden, opacity: 1, quietCenter: false, glyphSize: 11, dark: false,
    scene: current, poses, grid, width: 1600, height: 900, now,
  });
  const layer = attachSpout(null, read);
  const drawn = fakeInk();
  layer.paint(drawn.ink, null);
  assert.equal(drawn.calls.length, 0, 'the first instant is still quiet');

  scene.whales[0]._motion.submergence = 1;
  now = 20000;
  layer.paint(drawn.ink, null);
  assert.equal(drawn.calls.length, 0, 'a submerged whale does not spout');

  scene.whales[0]._motion.submergence = 0;
  now = 23000;
  layer.paint(drawn.ink, null);
  assert.ok(drawn.calls.length >= 4, 'a surfaced whale lets out a puff, not one mark');
  const core = drawn.calls.find((call) => call.glyph === '*' && call.x === projectedA.x && call.y === projectedA.y);
  assert.ok(core, 'the core sits on the blowhole');
  const placed = drawn.calls.map((call) => [call.glyph, call.x, call.y]);

  poses = [poseB];
  now = 23100;
  drawn.calls.length = 0;
  layer.paint(drawn.ink, null);
  assert.deepEqual(drawn.calls.map((call) => [call.glyph, call.x, call.y]), placed, 'the mist stays where it was breathed');

  now = 23000 + 1500;
  drawn.calls.length = 0;
  layer.paint(drawn.ink, null);
  assert.equal(drawn.calls.length, 0, 'the mist is gone before another can start');

  reduced = true;
  now = 50000;
  layer.paint(drawn.ink, null);
  reduced = false;
  layer.paint(drawn.ink, null);
  assert.equal(drawn.calls.length, 0, 'reduced motion clears the schedule');

  now = 60000;
  poses = [poseA];
  layer.paint(drawn.ink, null);
  assert.ok(drawn.calls.length > 0);
  const replaced = createScene(1, '鲸', 'blue', 1);
  current = replaced;
  drawn.calls.length = 0;
  layer.paint(drawn.ink, null);
  assert.equal(drawn.calls.length, 0, 'a new scene drops every burst');

  layer.detach();
  current = scene;
  now = 90000;
  drawn.calls.length = 0;
  layer.paint(drawn.ink, null);
  assert.equal(drawn.calls.length, 0);
});

test('low whale opacity still leaves a readable mist on a light background', () => {
  const scene = createScene(1, '鲸', 'blue', 1);
  const grid = createDepthGrid(1600, 900, 11);
  let now = 0;
  const layer = attachSpout(null, () => ({
    enabled: true, reduced: false, hidden: false, opacity: 0.35, quietCenter: false,
    glyphSize: 11, dark: false,
    scene, poses: [whalePose(scene.whales[0], 0, 1600, 900, 0)], grid,
    width: 1600, height: 900, now,
  }));
  try {
    const drawn = fakeInk();
    layer.paint(drawn.ink, null);
    now = 20000;
    layer.paint(drawn.ink, null);
    assert.ok(drawn.calls.length > 0, 'the mist should appear once the clock is due');
    assert.ok(drawn.calls[0].alpha >= 0.5, `mist alpha ${drawn.calls[0].alpha} is too faint`);
    assert.notEqual(drawn.calls[0].fillStyle, '#b7d0d6');
  } finally {
    layer.detach();
  }
});

test('spout stays quiet when the option is off, and a detached paint does not throw', () => {
  const { grid, particles, inside } = gridWith({ row: 0, col: 0 }, 0);
  assert.equal(spoutHit({ enabled: false, button: 0, tag: 'div', x: inside.x, y: inside.y }, grid, particles), null);
  const scene = createScene(1, '鲸', 'blue', 1);
  const gridLive = createDepthGrid(1600, 900, 11);
  let enabled = false;
  let now = 10;
  const layer = attachSpout(null, () => ({
    enabled, reduced: false, hidden: false, opacity: 1, quietCenter: false, glyphSize: 11, dark: true,
    scene, poses: [whalePose(scene.whales[0], 0, 1600, 900, 0)], grid: gridLive,
    width: 1600, height: 900, now,
  }));
  try {
    const drawn = fakeInk();
    layer.paint(drawn.ink, null);
    assert.equal(drawn.calls.length, 0);
    enabled = true;
    layer.paint(drawn.ink, null);
    assert.equal(drawn.calls.length, 0, 'turning it on only arms the clock');
    now = 20000;
    layer.paint(drawn.ink, null);
    assert.ok(drawn.calls.length > 0, 'the clock then spouts on its own');
    enabled = false;
    drawn.calls.length = 0;
    layer.paint(drawn.ink, null);
    assert.equal(drawn.calls.length, 0, 'turning it off clears the mist');
  } finally {
    layer.detach();
  }

  const parked = globalThis.document;
  globalThis.document = { addEventListener() {}, removeEventListener() {} };
  const dead = attachSpout({ getBoundingClientRect() { return { left: 0, top: 0, width: 1, height: 1 }; } }, () => { throw new Error('read failed'); });
  dead.detach();
  const { ink } = fakeInk();
  assert.doesNotThrow(() => dead.paint(ink, null));
  if (parked === undefined) delete globalThis.document;
  else globalThis.document = parked;
});
