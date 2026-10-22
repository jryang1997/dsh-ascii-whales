import test from 'node:test';
import assert from 'node:assert/strict';
import { glassRoundedPath, glassRoundedSubpath, glassTone, glassDistance, glassContains, glassEdgeFade } from './glass.js';
import { normalizeConfig, FIELDS, DEFAULTS } from './model.js';

test('frost strength grows the blur and the fog together, monotonically', () => {
  const soft = glassTone(0.1), thick = glassTone(0.9);
  assert.equal(soft.mode, 'frost');
  assert.ok(thick.scale > soft.scale);
  assert.ok(thick.mist >= soft.mist, 'more strength never lightens the pane');
  assert.ok(thick.veil > soft.veil);
  assert.ok(thick.feather > soft.feather, 'a thicker pane dissolves glyphs over a wider band');
  for (const strength of [0, 0.25, 0.5, 0.75, 1]) {
    const tone = glassTone(strength);
    assert.ok(tone.mist >= 0.22 && tone.mist <= 0.32, 'the silhouette shows as a tint, capped by the text-contrast budget');
    assert.ok(tone.veil <= 0.13, 'the pane tint stays under the bound that keeps body text readable');
    assert.ok(tone.blur >= 8 && tone.blur <= 20, 'the blur reads as frosted glass, not as a fog bank');
    assert.ok(tone.scale >= 3 && tone.scale <= 7);
  }
  assert.equal(glassTone(NaN).strength, 0.55);
  assert.equal(glassTone(-1).strength, 0);
  assert.equal(glassTone(2).strength, 1);
});

/**
 * The pane is composited above the DOM text, so every layer it paints is also a
 * contrast cost for the words underneath. Compose the worst case — text at full
 * black or white, then the pane tint, then the brightest silhouette the pane can
 * show — and require the result to stay above the WCAG AAA body threshold.
 * (The content-box material has its own, stricter budget in content-glass.test.js.)
 */
test('the base material keeps body text above the AAA contrast threshold in both themes', () => {
  const over = (under, layer, alpha) => under.map((channel, i) => channel * (1 - alpha) + layer[i] * alpha);
  const luminance = rgb => {
    const [r, g, b] = rgb.map(value => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const parse = text => text.split(',').map(Number);
  for (const dark of [false, true]) {
    for (const strength of [0, 0.55, 1]) {
      const tone = glassTone(strength, { dark });
      const text = dark ? [242, 243, 245] : [15, 15, 15];
      const page = dark ? [21, 21, 23] : [255, 255, 255];
      const tint = parse(tone.tint), whale = parse(tone.silhouette);
      // The same pane over a glyph and over the bare page, then compared.
      const overPane = base => over(over(base, tint, tone.veil), whale, tone.mist);
      const worst = ratio(overPane(text), overPane(page));
      assert.ok(worst >= 7, `${dark ? 'dark' : 'light'} at ${strength}: text contrast ${worst.toFixed(2)}:1`);
    }
  }
});

test('reduced transparency and a disabled pane clear the water under the text', () => {
  assert.equal(glassTone(0.55, { reducedTransparency: true }).mode, 'clear');
  assert.equal(glassTone(0.55, { enabled: false }).mode, 'clear');
  const dark = glassTone(0.55, { dark: true }), light = glassTone(0.55);
  assert.notEqual(dark.tint, light.tint);
  assert.equal(dark.mode, 'frost');
});

test('rounded path issues one closed contour with four corner arcs', () => {
  const log = [];
  const ctx = {
    beginPath: () => log.push('begin'), closePath: () => log.push('close'),
    moveTo: () => log.push('move'), lineTo: () => log.push('line'),
    arcTo: () => log.push('arc'),
  };
  glassRoundedPath(ctx, { x: 0, y: 0, width: 100, height: 60, radius: 12 });
  assert.equal(log[0], 'begin');
  assert.equal(log.at(-1), 'close');
  assert.equal(log.filter(entry => entry === 'arc').length, 4);
  const radii = [];
  glassRoundedPath({ ...ctx, arcTo: (...args) => radii.push(args.at(-1)) },
    { x: 0, y: 0, width: 40, height: 20, radius: 99 });
  assert.deepEqual(radii, [10, 10, 10, 10], 'a radius taller than the pane is reduced to half the short side');
});

test('rounded subpaths append to one path, so panes can share a single union clip', () => {
  const log = [];
  const ctx = {
    beginPath: () => log.push('begin'), closePath: () => log.push('close'),
    moveTo: () => log.push('move'), lineTo: () => log.push('line'),
    arcTo: () => log.push('arc'),
  };
  // The caller owns beginPath once; each pane only appends its rectangle. The
  // resulting nonzero-winding path is the union of the boxes, which is what lets
  // one drawImage serve every pane without painting the gaps between them.
  ctx.beginPath();
  glassRoundedSubpath(ctx, { x: 0, y: 0, width: 100, height: 60, radius: 12 });
  glassRoundedSubpath(ctx, { x: 200, y: 10, width: 80, height: 40, radius: 8 });
  assert.equal(log.filter(entry => entry === 'begin').length, 1, 'subpaths never restart the path');
  assert.equal(log.filter(entry => entry === 'move').length, 2, 'one subpath start per pane');
  assert.equal(log.filter(entry => entry === 'arc').length, 8, 'four corner arcs per pane');
  assert.equal(log.filter(entry => entry === 'close').length, 2);
});

test('rounded shape tests agree at the corners, so no glyph falls between layers', () => {
  const rect = { x: 100, y: 50, width: 400, height: 300, radius: 30 };
  assert.equal(glassContains(rect, 300, 200), true);
  assert.equal(glassDistance(rect, 300, 200), -150);
  assert.equal(glassContains(rect, 100, 50), false, 'the corner cut-out is outside');
  assert.ok(glassDistance(rect, 100, 50) > 0);
  // The 45° point of the corner arc sits exactly on the boundary, and the arc
  // centre is inside by one radius: both check the radius is applied once.
  const inset = 30 - 30 / Math.SQRT2;
  assert.ok(Math.abs(glassDistance(rect, 100 + inset, 50 + inset)) < 1e-9, 'the arc lies on the boundary');
  assert.equal(glassDistance(rect, 130, 80), -30);
  assert.equal(glassContains(rect, 130, 80), true);
  // Every sampled point is classified by one signed number, never by two tests.
  for (let x = 90; x <= 510; x += 7) for (let y = 40; y <= 360; y += 7) {
    assert.equal(glassContains(rect, x, y), glassDistance(rect, x, y) <= 0);
  }
  assert.equal(glassEdgeFade(rect, 300, 200), 0, 'inside the pane the sharp glyph is fully removed');
  assert.equal(glassEdgeFade(rect, 300, 400), 1, 'well outside it survives');
  const ramp = [0, 6, 12, 18, 24, 30].map(offset => glassEdgeFade(rect, 90 - offset, 200, 30));
  for (let i = 1; i < ramp.length; i++) assert.ok(ramp[i] >= ramp[i - 1], 'the fade rises monotonically outward');
  assert.ok(ramp[0] > 0.1 && ramp[0] < 0.35, 'ten pixels out of a thirty pixel feather is a third of the way');
  assert.equal(ramp.at(-1), 1);
});

test('glass settings keep saved values compatible and stay inside their ranges', () => {
  assert.equal(DEFAULTS.glass, true);
  assert.equal(DEFAULTS.glassStrength, 0.55);
  assert.ok(Object.keys(FIELDS).includes('glass'));
  const legacy = { count: 3, text: '探索未至之境', opacity: 0.7, color: 'indigo' };
  const normalized = normalizeConfig(legacy);
  assert.equal(normalized.glass, true, 'a saved config without glass gets the content-glass default');
  assert.equal(normalized.glassStrength, 0.55);
  assert.equal(normalized.opacity, 0.7);
  assert.equal(normalizeConfig({ glass: false }).glass, false);
  assert.equal(normalizeConfig({ glassStrength: -3 }).glassStrength, 0);
  assert.equal(normalizeConfig({ glassStrength: 9 }).glassStrength, 1);
  assert.equal(normalizeConfig({ glassStrength: 0.548 }).glassStrength, 0.548, 'fractional steps clamp but never round, like speed and opacity');
});
