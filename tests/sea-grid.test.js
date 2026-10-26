import test from 'node:test';
import assert from 'node:assert/strict';
import { drawSeaGrid, seaGridAlpha } from '../src/sea-grid.js';

/** Records the hairline path and the transform it was drawn under. */
function target(canvas = null) {
  const calls = [];
  const ink = {
    calls,
    saved: 0,
    lineWidth: 0,
    strokeStyle: '',
    ...(canvas ? { canvas } : {}),
    save() { this.saved++; calls.push(['save']); },
    restore() { this.saved--; calls.push(['restore']); },
    setTransform(...args) { calls.push(['setTransform', ...args]); },
    beginPath() { calls.push(['beginPath']); },
    moveTo(x, y) { calls.push(['moveTo', x, y]); },
    lineTo(x, y) { calls.push(['lineTo', x, y]); },
    stroke() { calls.push(['stroke']); },
  };
  return ink;
}

const options = {
  width: 300, height: 200, cellWidth: 10, cellHeight: 20,
  scale: 1, offsetX: 0, offsetY: 0, opacity: 0.6, dark: false,
};
const movesOf = ink => ink.calls.filter(call => call[0] === 'moveTo').map(call => [call[1], call[2]]);

test('the sea grid frames every cell boundary inside the logical sea', () => {
  const ink = target();
  const result = drawSeaGrid(ink, options);
  // 29 interior column boundaries and 9 interior row boundaries.
  assert.equal(result.lines, 38);
  const moves = movesOf(ink);
  const lines = ink.calls.filter(call => call[0] === 'lineTo');
  assert.equal(moves.length, 38);
  assert.equal(lines.length, 38);
  // Vertical lines span the full logical height, horizontal lines the full width.
  const vertical = moves.filter(([, y]) => y === 0.5);
  const horizontal = moves.filter(([x]) => x === 0.5);
  assert.equal(vertical.length, 29);
  assert.equal(horizontal.length, 9);
  for (let i = 0; i < vertical.length; i++) assert.deepEqual(lines[i], ['lineTo', vertical[i][0], 199.5]);
  for (let i = 0; i < horizontal.length; i++) assert.deepEqual(lines[vertical.length + i], ['lineTo', 299.5, horizontal[i][1]]);
  assert.equal(ink.calls.at(-1)[0], 'restore');
  assert.equal(ink.saved, 0, 'the grid restores the caller transform');
});

test('hairlines are one device pixel and sit on half device pixels', () => {
  const ink = target();
  drawSeaGrid(ink, { ...options, scale: 2, width: 100, height: 100, cellWidth: 10, cellHeight: 10 });
  assert.equal(ink.lineWidth, 1);
  const moves = movesOf(ink);
  assert.deepEqual(moves.filter(([, y]) => y === 0.5).map(([x]) => x),
    [20.5, 40.5, 60.5, 80.5, 100.5, 120.5, 140.5, 160.5, 180.5]);
  assert.deepEqual(moves.filter(([, y]) => y !== 0.5).map(([x]) => x), Array(9).fill(0.5));
  assert.match(ink.strokeStyle, /^rgba\(36, 54, 70, 0\.1050\)$/);
  // Identity transform: the stroke is not scaled by the glyph transform.
  assert.deepEqual(ink.calls.find(call => call[0] === 'setTransform'), ['setTransform', 1, 0, 0, 1, 0, 0]);
});

test('the letterboxed preview maps the grid into its real sea rectangle', () => {
  const ink = target();
  const result = drawSeaGrid(ink, { ...options, width: 40, height: 40, cellWidth: 10, cellHeight: 10,
    scale: 0.5, offsetX: 20, offsetY: 10 });
  assert.equal(result.lines, 6);
  assert.deepEqual(movesOf(ink), [
    [25.5, 10.5], [30.5, 10.5], [35.5, 10.5],
    [20.5, 15.5], [20.5, 20.5], [20.5, 25.5],
  ]);
});

test('no cell line is emitted outside the logical sea', () => {
  const ink = target();
  const result = drawSeaGrid(ink, { ...options, width: 25, height: 15, cellWidth: 10, cellHeight: 10 });
  // Width 25 keeps 10/20; height 15 keeps 10 only.
  assert.equal(result.lines, 3);
  assert.deepEqual(movesOf(ink), [[10.5, 0.5], [20.5, 0.5], [0.5, 10.5]]);
});

test('the letterboxed settings preview continues the lattice to the canvas edges', () => {
  const ink = target({ width: 200, height: 100 });
  const result = drawSeaGrid(ink, { ...options, width: 40, height: 20, cellWidth: 10, cellHeight: 10,
    offsetX: 20, offsetY: 10, extend: true });
  // Phase survives the letterbox: lines every 10 device pixels, one cell
  // before the logical sea and on to the canvas edges.
  assert.equal(result.lines, 28);
  const moves = movesOf(ink);
  assert.deepEqual(moves.filter(([, y]) => y === 0.5).map(([x]) => x),
    Array.from({ length: 19 }, (_, index) => 10.5 + index * 10));
  assert.deepEqual(moves.filter(([x]) => x === 0.5).map(([, y]) => y),
    Array.from({ length: 9 }, (_, index) => 10.5 + index * 10));
  // A target without a canvas cannot be extended, so the old sea bounds apply.
  assert.equal(drawSeaGrid(target(), { ...options, width: 40, height: 20, cellWidth: 10, cellHeight: 10,
    offsetX: 20, offsetY: 10, extend: true }).lines, 4);
});

test('the grid reads no clock and no random source', () => {
  const savedNow = Date.now, savedRandom = Math.random;
  const perf = globalThis.performance, savedPerformanceNow = perf?.now;
  Date.now = () => { throw new Error('drawSeaGrid read Date.now'); };
  Math.random = () => { throw new Error('drawSeaGrid read Math.random'); };
  if (perf && typeof savedPerformanceNow === 'function') perf.now = () => { throw new Error('drawSeaGrid read performance.now'); };
  try {
    assert.equal(drawSeaGrid(target(), options).lines, 38);
  } finally {
    Date.now = savedNow;
    Math.random = savedRandom;
    if (perf && typeof savedPerformanceNow === 'function') perf.now = savedPerformanceNow;
  }
});

test('alpha follows the background concentration and the theme', () => {
  assert.equal(seaGridAlpha(0.6, false), 0.105);
  assert.equal(seaGridAlpha(0.6, true), 0.075);
  assert.equal(seaGridAlpha(0.8, false), 0.14);
  assert.equal(seaGridAlpha(0, false), 0);
  assert.equal(seaGridAlpha(undefined, false), 0.105);
  // The cap keeps a maximal concentration from turning the surface into ink.
  assert.equal(seaGridAlpha(1, false), 0.16);
  assert.equal(seaGridAlpha(Infinity, true), 0.075);
});

test('missing or degenerate seas draw nothing', () => {
  for (const bad of [null, {}, { beginPath() {}, stroke() {} }]) {
    assert.equal(drawSeaGrid(bad, options).lines, 0);
  }
  for (const broken of [
    { width: 0 }, { height: -1 }, { width: 100, height: 0 },
    { cellWidth: 0 }, { cellHeight: 1 }, { cellWidth: NaN },
    { opacity: 0 },
  ]) {
    const ink = target();
    const result = drawSeaGrid(ink, { ...options, ...broken });
    assert.equal(result.lines, 0, JSON.stringify(broken));
    assert.equal(ink.calls.length, 0, `no drawing for ${JSON.stringify(broken)}`);
    assert.equal(ink.saved, 0);
  }
  // A target without save/restore/setTransform still gets its lines.
  const minimal = {
    lineWidth: 0, strokeStyle: '',
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
  };
  assert.equal(drawSeaGrid(minimal, options).lines, 38);
});

test('dark theme inks the lattice with light pixels, light theme with dark ones', () => {
  const light = target(), dark = target();
  drawSeaGrid(light, options);
  drawSeaGrid(dark, { ...options, dark: true });
  assert.match(light.strokeStyle, /^rgba\(36, 54, 70,/);
  assert.match(dark.strokeStyle, /^rgba\(203, 219, 236,/);
});
