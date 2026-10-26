import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

// These checks drive the two shipped entry scripts, not the source modules:
// the squared sea has to survive the build, land in the public preview and
// react to the live switch in both entries.
const root = new URL('../', import.meta.url);
const LIGHT = 'rgba(36, 54, 70,';
const DARK = 'rgba(203, 219, 236,';
const base = { count: 1, glass: false, wind: false, clouds: false, ripples: false, rain: false, activity: false };
const gridStrokes = (commands, tone) => commands
  .filter(command => command.op === 'stroke' && String(command.state.strokeStyle).startsWith(tone));
const gridMoves = (commands, tone) => {
  const stroke = commands.findIndex(command => command.op === 'stroke'
    && String(command.state.strokeStyle).startsWith(tone));
  if (stroke < 0) return [];
  let begin = 0;
  for (let index = stroke - 1; index >= 0; index--) if (commands[index].op === 'beginPath') { begin = index; break; }
  return commands.slice(begin + 1, stroke).filter(command => command.op === 'moveTo');
};
const diffs = values => values.slice(1).map((value, index) => Math.round(value - values[index]));
/** Every offscreen buffer reachable from drawImage commands, at any depth. */
const buffers = (commands, out = []) => {
  for (const command of commands) {
    if (command.op !== 'drawImage') continue;
    const source = command.args[0];
    if (!source || !Array.isArray(source.commands)) continue;
    out.push(source);
    buffers(source.commands, out);
  }
  return out;
};
const axis = (moves, side) => moves.filter(move => move.args[side] === 0.5)
  .map(move => move.args[side === 1 ? 0 : 1]);

async function createPair(initial = {}) {
  const [client, previewHtml] = await Promise.all(['client.js', 'preview/whale-preview.html']
    .map(name => readFile(new URL(name, root), 'utf8')));
  return createArtifactPair({ client, previewHtml }, { ...base, ...initial });
}

test('the shipped entries paint one device-pixel cell lattice per frame', async t => {
  const pair = await createPair();
  t.after(() => pair.dispose());
  pair.advance(2);
  const { host, preview } = pair.snapshots();
  assert.deepEqual(host.commands, preview.commands, 'both entries draw the same sea');
  const strokes = gridStrokes(host.commands, LIGHT);
  assert.equal(strokes.length, 1, 'the whole lattice is one path and one stroke');
  assert.equal(strokes[0].state.lineWidth, 1, 'hairline is one device pixel');
  assert.equal(strokes[0].state.transform.at(0), 1, 'the lattice is stroked in device space');
  const moves = gridMoves(host.commands, LIGHT);
  // Shipped preview starts in colored-cell ASCII mode: the square cell is 16px.
  const xs = axis(moves, 1), ys = axis(moves, 0);
  assert.deepEqual([...new Set(diffs(xs))], [16]);
  assert.deepEqual([...new Set(diffs(ys))], [16]);
  assert.equal(xs[0], 16.5, 'the first line is snapped to a half device pixel');
  assert.equal(xs.at(-1), 16 * Math.floor((800 - 0.01) / 16) + 0.5, 'the last full column is inside the 800px sea');
});

test('glyph-only water uses the rectangular character cell, still aligned with the tiles', async t => {
  const pair = await createPair();
  t.after(() => pair.dispose());
  pair.update({ renderStyle: 'glyphs', fillMode: 'custom' });
  pair.advance(2);
  const strokes = gridStrokes(pair.snapshots().host.commands, LIGHT);
  assert.equal(strokes.length, 1);
  const moves = gridMoves(pair.snapshots().host.commands, LIGHT);
  // Default glyph metrics: 13px wide, 16px tall cells at devicePixelRatio 1.
  assert.deepEqual([...new Set(diffs(axis(moves, 1)))], [13]);
  assert.deepEqual([...new Set(diffs(axis(moves, 0)))], [16]);
});

test('the switch updates the running layer in place, without a remount', async t => {
  const pair = await createPair();
  t.after(() => pair.dispose());
  pair.advance(1);
  assert.equal(gridStrokes(pair.snapshots().host.commands, LIGHT).length, 1);
  pair.update({ seaGrid: false });
  pair.advance(1);
  const off = pair.snapshots();
  assert.equal(gridStrokes(off.host.commands, LIGHT).length, 0, 'no lattice while the switch is off');
  assert.equal(gridStrokes(off.preview.commands, LIGHT).length, 0, 'the public preview follows too');
  assert.ok(off.host.commands.length > 0, 'the sea keeps rendering other layers');
  pair.update({ seaGrid: true });
  pair.advance(1);
  assert.equal(gridStrokes(pair.snapshots().host.commands, LIGHT).length, 1, 'the lattice returns on the same canvas');
  assert.ok(pair.retainedCanvases());
});

test('dark theme inks the lattice with light hairlines', async t => {
  const pair = await createPair();
  t.after(() => pair.dispose());
  pair.update({ dark: true });
  pair.advance(2);
  const { host, preview } = pair.snapshots();
  assert.equal(gridStrokes(host.commands, DARK).length, 1);
  assert.equal(gridStrokes(host.commands, LIGHT).length, 0);
  assert.equal(gridStrokes(preview.commands, DARK).length, 1, 'the public preview matches the theme');
});

test('the frosted-pane sea buffer receives the lattice before it is blurred', async t => {
  const pair = await createPair({ glass: true, readingEffect: 'frost' });
  t.after(() => pair.dispose());
  pair.advance(2);
  const { host } = pair.snapshots();
  const reached = buffers(host.commands);
  const lattices = reached.filter(buffer => gridStrokes(buffer.commands, LIGHT).length === 1);
  assert.ok(lattices.length >= 1, 'the shared sea buffer contains the squared sea');
  for (const buffer of lattices) {
    assert.ok(buffer.width > 1 && buffer.height > 1);
    const stroke = gridStrokes(buffer.commands, LIGHT)[0];
    assert.equal(stroke.state.lineWidth, 1, 'still a one-pixel hairline in the buffer');
  }
});

test('turning the switch off leaves no lattice in the frosted-pane buffer either', async t => {
  const pair = await createPair({ glass: true, readingEffect: 'frost', seaGrid: false });
  t.after(() => pair.dispose());
  pair.advance(2);
  const { host } = pair.snapshots();
  for (const buffer of buffers(host.commands)) assert.equal(gridStrokes(buffer.commands, LIGHT).length, 0);
  assert.equal(gridStrokes(host.commands, LIGHT).length, 0);
});
