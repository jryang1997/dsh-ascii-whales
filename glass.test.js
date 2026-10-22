import test from 'node:test';
import assert from 'node:assert/strict';
import { glassPanel, glassPanes, glassRoundedPath, glassTone, glassFrostSize, glassDistance, glassContains, glassEdgeFade } from './glass.js';
import { normalizeConfig, FIELDS, DEFAULTS } from './model.js';

const canvas = { left: 280, top: 40, width: 1000, height: 800 };

test('one sheet of glass spans the text column and reaches the bottom of the viewport', () => {
  const panes = glassPanes({
    canvas,
    viewport: { left: 280, top: 40, width: 1000, height: 800 },
    column: { left: 490, top: 40, width: 748, height: 800 },
  });
  assert.equal(panes.length, 1);
  const [panel] = panes;
  assert.equal(panel.width, 748 + 40);
  assert.equal(panel.x + panel.width / 2, 490 + 748 / 2 - 280, 'pane stays centred on the column');
  assert.equal(panel.y, 8);
  assert.equal(panel.y + panel.height, 800 - 12, 'the sheet covers the composer too, not just the transcript');
  assert.equal(panel.radius, 24);
});

test('narrow viewports opt out, and a missing hook still paints a centred pane', () => {
  const narrow = glassPanel({ canvas, viewport: { left: 280, top: 40, width: 300, height: 600 } });
  assert.equal(narrow, null, 'a viewport too narrow for the pane paints no glass');
  const canvasOnly = glassPanel({ canvas: { left: 0, top: 0, width: 1200, height: 800 } });
  assert.ok(canvasOnly, 'missing hooks still paint a centred pane');
  assert.equal(canvasOnly.width, Math.min(748 + 40, 1200 - 24));
  assert.equal(canvasOnly.x + canvasOnly.width / 2, 600);
  const shortWait = glassPanel({ canvas, viewport: { left: 280, top: 40, width: 1000, height: 200 } });
  assert.equal(shortWait, null, 'a viewport too short for the pane paints no glass');
  assert.equal(glassPanel({}), null);
  assert.equal(glassPanel({ canvas: { left: 0, top: 0, width: 0, height: 0 } }), null);
});

test('the pane is clipped to the sea and stays inside the visible viewport', () => {
  const offset = glassPanel({ canvas, viewport: { left: 140, top: 40, width: 1140, height: 800 },
    column: { left: 140, top: 40, width: 748, height: 800 } });
  assert.ok(offset);
  assert.ok(offset.x >= 12, 'a column left of the canvas is pulled in');
  assert.ok(offset.x + offset.width <= 988);
  const right = glassPanel({ canvas, viewport: { left: 0, top: 0, width: 1000, height: 800 },
    column: { left: 900, top: 0, width: 748, height: 800 } });
  assert.ok(right.x + right.width <= 1000 - 12);
  const scrolled = glassPanel({ canvas, viewport: { left: 280, top: -120, width: 1000, height: 800 },
    column: { left: 490, top: 40, width: 748, height: 800 } });
  assert.ok(scrolled);
  assert.ok(scrolled.y >= 8, 'a viewport above the canvas cannot push the pane off it');
});

test('frost strength grows the downsample and the fog together, monotonically', () => {
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
 */
test('the pane keeps body text above the AAA contrast threshold in both themes', () => {
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
      const onText = overPane(text), onPage = overPane(page);
      const worst = ratio(onText, onPage);
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

test('frost buffer stays small enough for an inexpensive per-frame resize', () => {
  for (const scale of [3, 4, 5, 6]) {
    const size = glassFrostSize(2400, 1600, scale);
    assert.equal(size.factor, scale);
    assert.ok(size.width <= 800 && size.height <= 534, 'frost pass is a fraction of the sea');
  }
  assert.equal(glassFrostSize(100, 100, 0).factor, 2);
  assert.equal(glassFrostSize(100, 100, 99).factor, 8);
  assert.equal(glassFrostSize(100, 100, NaN).factor, 4);
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
  assert.equal(normalized.glass, true, 'a saved config without glass gets the new default');
  assert.equal(normalized.glassStrength, 0.55);
  assert.equal(normalized.opacity, 0.7);
  assert.equal(normalizeConfig({ glass: false }).glass, false);
  assert.equal(normalizeConfig({ glassStrength: -3 }).glassStrength, 0);
  assert.equal(normalizeConfig({ glassStrength: 9 }).glassStrength, 1);
  assert.equal(normalizeConfig({ glassStrength: 0.548 }).glassStrength, 0.548, 'fractional steps clamp but never round, like speed and opacity');
});





