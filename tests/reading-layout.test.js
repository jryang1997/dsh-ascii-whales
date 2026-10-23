import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingLayout, demoReadingSnapshot } from '../src/reading-layout.js';

const card = { x: 0.2, y: 0.3, width: 0.5, height: 0.2, radius: 18 };
const demo = demoReadingSnapshot(card, 1000, 800);
const pageCard = { ...demo.composer, left: demo.composer.left + 280, top: demo.composer.top + 40 };
const dom = { canvas: { left: 280, top: 40, width: 1000, height: 800 }, boxes: [pageCard], composer: pageCard };

test('DOM and demo coordinates share glass, masks and size-aware obstacles', () => {
  for (const config of [
    { glass: true, glassStrength: 0.55, composerAvoid: false, quietCenter: false },
    { glass: false, composerAvoid: true, quietCenter: false },
  ]) {
    const a = createReadingLayout(dom, config), b = createReadingLayout(demo, config);
    assert.deepEqual(a.panes, b.panes);
    assert.deepEqual(a.obstacles(42), b.obstacles(42));
    for (const [x, y] of [[0, 0], [200, 240], [208, 248], [400, 300], [710, 410]]) {
      assert.equal(a.fade?.(x, y), b.fade?.(x, y));
      assert.equal(a.sceneryFade(x, y), b.sceneryFade(x, y));
    }
  }
});

test('glass uses a rounded clip instead of fading open water outside the card', () => {
  const layout = createReadingLayout(demo, { glass: true, glassStrength: 0.55, quietCenter: false });
  assert.equal(layout.fade, null, 'glass must not attenuate glyph footprints outside its rounded clip');
  for (const [x, y] of [[199, 300], [200, 240], [701, 300], [400, 401]]) {
    assert.equal(layout.sceneryFade(x, y), 1, `open water at ${x},${y} stays unchanged`);
  }
});

test('reduced transparency retains the rounded panes without allocating material', () => {
  const layout = createReadingLayout(demo, { glass: true, glassStrength: 0.55 }, { reducedTransparency: true });
  assert.equal(layout.fade, null);
  assert.equal(layout.panes.length, 1, 'the renderer still clips the sharp sea out of the card');
  assert.equal(layout.tone.mode, 'clear');
  assert.deepEqual(layout.obstacles(100), []);
});

test('offscreen composers produce no obstacle and open water keeps the live quiet-center setting', () => {
  const config = { glass: false, composerAvoid: false, quietCenter: false };
  const layout = createReadingLayout(demo, config);
  assert.equal(layout.fade, null);
  const before = layout.sceneryFade(500, 400);
  config.quietCenter = true;
  assert.ok(layout.sceneryFade(500, 400) < before);
  const outside = createReadingLayout({ ...dom, composer: { ...pageCard, left: 5000 } }, { composerAvoid: true });
  assert.deepEqual(outside.obstacles(20), []);
});
