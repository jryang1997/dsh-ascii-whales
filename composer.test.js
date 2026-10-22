import test from 'node:test';
import assert from 'node:assert/strict';
import { glassComposerPane, glassComposerTone, glassEdgeFade, glassTone } from './glass.js';
import { setSceneObstacles, resizeScene, stepScene } from './motion.js';
import { DEFAULTS, FIELDS, createScene, configSignature, normalizeConfig } from './model.js';
import { diffWhaleConfig } from './engine.js';

const canvas = { left: 280, top: 40, width: 1000, height: 800 };
const alphaOf = text => Number(text.slice(text.lastIndexOf(',') + 1).replace(')', ''));
const parseColor = text => text.split(',').map(Number);

test('the input card becomes a rounded pane that is clipped to the sea', () => {
  const card = { left: 400, top: 600, width: 700, height: 120 };
  const pane = glassComposerPane({ canvas, card });
  assert.deepEqual(pane, { x: 120, y: 560, width: 700, height: 120, radius: 18, feather: 14 });
  // The card's own radius is honoured, but never taller than half a side.
  assert.equal(glassComposerPane({ canvas, card, radius: 8 }).radius, 8);
  assert.equal(glassComposerPane({ canvas, card: { ...card, height: 36 }, radius: 99 }).radius, 18);
  assert.equal(glassComposerPane({ canvas, card, radius: NaN }).radius, 18);
  assert.equal(glassComposerPane({ canvas, card, radius: -4 }).radius, 0);

  // Partly off the canvas: the pane is cropped to the sea, never outside it.
  const leftTop = glassComposerPane({ canvas, card: { left: 200, top: 20, width: 700, height: 120 } });
  assert.equal(leftTop.x, 0); assert.equal(leftTop.y, 0);
  assert.equal(leftTop.width, 620); assert.equal(leftTop.height, 100);
  const rightBottom = glassComposerPane({ canvas, card: { left: 900, top: 700, width: 400, height: 200 } });
  assert.equal(rightBottom.x + rightBottom.width, 1000);
  assert.equal(rightBottom.y + rightBottom.height, 800);
  assert.equal(rightBottom.width, 380); assert.equal(rightBottom.height, 140);
  for (const pane of [leftTop, rightBottom]) {
    assert.ok(pane.x >= 0 && pane.y >= 0);
    assert.ok(pane.x + pane.width <= canvas.width && pane.y + pane.height <= canvas.height);
    assert.ok(pane.radius <= Math.min(pane.width, pane.height) / 2);
  }

  // Cards too small to read text, entirely off the sea, or unusable coordinates opt out.
  assert.equal(glassComposerPane({ canvas, card: { ...card, width: 59 } }), null);
  assert.equal(glassComposerPane({ canvas, card: { ...card, height: 35 } }), null);
  assert.ok(glassComposerPane({ canvas, card: { ...card, width: 60, height: 36 } }), 'the minimum readable card still gets glass');
  assert.equal(glassComposerPane({ canvas, card: { left: 2000, top: 600, width: 700, height: 120 } }), null);
  assert.equal(glassComposerPane({ canvas, card: { left: 400, top: 1400, width: 700, height: 120 } }), null);
  assert.equal(glassComposerPane({}), null);
  assert.equal(glassComposerPane({ canvas: { ...canvas, width: 0, height: 0 }, card }), null);

  // The fade belongs to this pane only: sharp glyphs vanish under it and stay
  // untouched everywhere else on the sea.
  const fadePane = glassComposerPane({ canvas, card });
  assert.equal(glassEdgeFade(fadePane, fadePane.x + fadePane.width / 2, fadePane.y + fadePane.height / 2, fadePane.feather), 0);
  assert.equal(glassEdgeFade(fadePane, 20, 20, fadePane.feather), 1);
  assert.equal(glassEdgeFade(fadePane, canvas.width - 5, canvas.height - 5, fadePane.feather), 1);
});

test('composer glass keeps the reading material but moves its highlight off the text line', () => {
  for (const dark of [false, true]) {
    for (const strength of [0, 0.55, 1]) {
      const reading = glassTone(strength, { dark });
      const composer = glassComposerTone(strength, { dark });
      // The contrast-bearing layers are shared: no second, heavier material.
      for (const key of ['tint', 'veil', 'mist', 'silhouette', 'scale', 'blur']) {
        assert.equal(composer[key], reading[key], `${key} is reused from the reading pane`);
      }
      // The top light band is the only layer that changed: much fainter and shorter.
      assert.ok(alphaOf(composer.crest) <= alphaOf(reading.crest) * 0.25);
      assert.ok(alphaOf(composer.crest) > 0);
      assert.ok(composer.crestHeight <= 18, `crestHeight ${composer.crestHeight}`);
      assert.ok(composer.crestHeight < reading.crestHeight);
      assert.ok(composer.feather >= 12 && composer.feather <= 16, `feather ${composer.feather}`);
      assert.ok(composer.feather < reading.feather);
    }
  }
  assert.equal(glassComposerTone(0.55, { reducedTransparency: true }).mode, 'clear');
  assert.equal(glassComposerTone(0.55, { enabled: false }).mode, 'clear');
  assert.equal(glassComposerTone(NaN).strength, 0.55);
});

/**
 * The input card is composited over the words, exactly like the reading pane.
 * Compose the worst case the same way glass.test.js does — text and page, the
 * pane tint, the whale silhouette — and, because the card is short, also the
 * top highlight and the bottom shade band: every layer must leave small text
 * above the WCAG AA threshold (4.5:1).
 */
test('composer glass keeps input text above the AA contrast threshold', () => {
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
  let worst = Infinity;
  for (const dark of [false, true]) {
    for (const strength of [0, 0.55, 1]) {
      const tone = glassComposerTone(strength, { dark });
      const text = dark ? [242, 243, 245] : [15, 15, 15];
      const page = dark ? [21, 21, 23] : [255, 255, 255];
      const tint = parseColor(tone.tint), whale = parseColor(tone.silhouette);
      const body = base => over(over(base, tint, tone.veil), whale, tone.mist);
      const crest = base => over(body(base), [255, 255, 255], alphaOf(tone.crest));
      const shade = base => over(body(base), [0, 0, 0], alphaOf(tone.shade));
      for (const layer of [body, crest, shade]) {
        const value = ratio(layer(text), layer(page));
        worst = Math.min(worst, value);
        assert.ok(value >= 4.5, `${dark ? 'dark' : 'light'} at ${strength}: text contrast ${value.toFixed(2)}:1`);
      }
    }
  }
  assert.ok(worst >= 4.5);
});

test('the two composer options are mutually exclusive and never both take effect', () => {
  assert.equal(FIELDS.composerGlass.kind, 'boolean');
  assert.equal(FIELDS.composerAvoid.kind, 'boolean');
  assert.equal(DEFAULTS.composerGlass, false);
  assert.equal(DEFAULTS.composerAvoid, false);
  const both = normalizeConfig({ ...DEFAULTS, composerGlass: true, composerAvoid: true });
  assert.equal(both.composerGlass, true, 'the glass wins when both arrive enabled');
  assert.equal(both.composerAvoid, false);
  assert.equal(configSignature({ ...DEFAULTS, composerGlass: true, composerAvoid: true }),
    configSignature({ ...DEFAULTS, composerGlass: true, composerAvoid: false }));
  const avoidOnly = normalizeConfig({ ...DEFAULTS, composerAvoid: true });
  assert.equal(avoidOnly.composerAvoid, true);
  assert.equal(avoidOnly.composerGlass, false);
  const glassOnly = normalizeConfig({ ...DEFAULTS, composerGlass: true });
  assert.equal(glassOnly.composerGlass, true);
  assert.equal(glassOnly.composerAvoid, false);
});

test('the composer options form their own rebuild group and an identical config changes nothing', () => {
  const base = normalizeConfig(DEFAULTS);
  assert.deepEqual(diffWhaleConfig(base, { ...base }),
    { scene: false, metrics: false, palette: false, glass: false, composer: false, live: false });
  for (const key of ['composerGlass', 'composerAvoid']) {
    const changes = diffWhaleConfig(base, normalizeConfig({ ...DEFAULTS, [key]: true }));
    assert.deepEqual(changes, { scene: false, metrics: false, palette: false, glass: false, composer: true, live: false }, key);
  }
  // Turning the reading glass off must not disturb either composer option.
  assert.equal(diffWhaleConfig(base, normalizeConfig({ ...DEFAULTS, glass: false })).composer, false);
});

const obstacle = Object.freeze({ x: 450, y: 650, width: 700, height: 150 });
// The same five spine stations the avoidance clamps against (nose to fluke),
// plus the glyph-cell gap the motion code keeps around them.
const BODY_CLEARANCE = 12;
const bodySampleOffsets = Object.freeze([-0.5357142857142857, -0.2857142857142857,
  -0.0357142857142857, 0.2142857142857143, 0.4642857142857143]);
/** The five body samples under test, in canvas pixels. */
function bodySamples(whale) {
  const c = Math.cos(whale.heading), s = Math.sin(whale.heading);
  return bodySampleOffsets.map(offset => ({
    x: whale.x + c * whale.length * offset,
    y: whale.y + s * whale.length * offset,
  }));
}
const pointInside = (rect, x, y, margin = 0) => x > rect.x - margin && x < rect.x + rect.width + margin
  && y > rect.y - margin && y < rect.y + rect.height + margin;
/** True when every body sample stays outside the obstacle plus its clearance. */
const bodyClear = (whale, rect) => bodySamples(whale).every(point => !pointInside(rect, point.x, point.y, BODY_CLEARANCE));
/** Smallest signed clearance of a body sample to the obstacle (negative = inside). */
function bodyClearance(whale, rect) {
  let smallest = Infinity;
  for (const point of bodySamples(whale)) {
    const distance = Math.hypot(Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width)),
      Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height)));
    smallest = Math.min(smallest, distance - BODY_CLEARANCE);
  }
  return smallest;
}
const distanceToRect = (whale, rect) => Math.hypot(
  Math.max(rect.x - whale.x, 0, whale.x - (rect.x + rect.width)),
  Math.max(rect.y - whale.y, 0, whale.y - (rect.y + rect.height)));

function school(count = 3) {
  const scene = createScene(count);
  resizeScene(scene, 1600, 900);
  return scene;
}

test('an obstacle clears every body sample immediately and the school keeps them out while swimming', () => {
  const scene = school(3);
  // The third whale starts lying across the card area, so this is the immediate case.
  assert.ok(bodySamples(scene.whales[2]).some(point => pointInside(obstacle, point.x, point.y)),
    'the initial layout really puts body samples in the card area');
  const applied = setSceneObstacles(scene, [obstacle]);
  assert.equal(applied.length, 1);
  assert.equal(scene.obstacles.length, 1);
  // Reduced motion / static frames: no step has run, the body must already be clear.
  for (const whale of scene.whales) {
    assert.ok(bodyClear(whale, obstacle), `whale ${whale.id} was left with body samples inside the card`);
    assert.ok(whale.x >= 0 && whale.x <= 1600 && whale.y >= 0 && whale.y <= 900, 'the body never leaves the canvas');
    const target = whale._motion;
    const above = obstacle.y - Math.max(8, whale.length * 0.08);
    const insideTarget = target.targetX > obstacle.x && target.targetX < obstacle.x + obstacle.width
      && target.targetY > obstacle.y && target.targetY < obstacle.y + obstacle.height;
    if (insideTarget) assert.ok(target.targetY <= above + 1e-9 || target.targetY >= obstacle.y + obstacle.height, 'a route target inside the card is moved out');
  }
  let minimum = { clearance: Infinity };
  for (let frame = 0; frame < 60 * 60; frame++) {
    stepScene(scene, 1 / 60, 1);
    for (const whale of scene.whales) {
      const clearance = bodyClearance(whale, obstacle);
      if (clearance < minimum.clearance) minimum = { clearance, frame, id: whale.id };
      assert.ok(bodyClear(whale, obstacle), `whale ${whale.id} had a body sample in the card at frame ${frame}`);
      assert.ok([whale.x, whale.y, whale.vx, whale.vy, whale.heading, whale.length].every(Number.isFinite), `frame ${frame}`);
      // Normal steering may graze the canvas edge (the school is not fenced in);
      // what the clamp must never do is throw a body far outside the window.
      assert.ok(whale.x >= -whale.length && whale.x <= 1600 + whale.length, `frame ${frame}: x ${whale.x}`);
      assert.ok(whale.y >= -whale.length && whale.y <= 900 + whale.length, `frame ${frame}: y ${whale.y}`);
    }
  }
  assert.ok(minimum.clearance >= -1e-9, `closest body sample ${minimum.clearance} at frame ${minimum.frame}`);
});

test('body-aware avoidance also holds for the smallest and largest whale sizes', () => {
  for (const whaleSize of [0.55, 1, 1.55]) {
    const scene = createScene(3, DEFAULTS.text, DEFAULTS.species, whaleSize);
    resizeScene(scene, 1600, 900);
    setSceneObstacles(scene, [obstacle]);
    // The static (reduced motion) frame has to be correct before any stepping.
    for (const whale of scene.whales) assert.ok(bodyClear(whale, obstacle), `size ${whaleSize}: static frame`);
    for (let frame = 0; frame < 20 * 60; frame++) {
      stepScene(scene, 1 / 60, 1);
      for (const whale of scene.whales) {
        assert.ok(bodyClear(whale, obstacle), `size ${whaleSize}: whale ${whale.id} body sample in the card at frame ${frame}`);
        assert.ok(Number.isFinite(whale.x) && Number.isFinite(whale.y));
        assert.ok(whale.x >= 0 && whale.x <= 1600 && whale.y >= 0 && whale.y <= 900);
      }
    }
  }
});

test('an obstacle follows a canvas resize and a cleared obstacle restores the old steering', () => {
  const scene = school(3);
  setSceneObstacles(scene, [obstacle]);
  resizeScene(scene, 800, 450);
  const scaled = scene.obstacles[0];
  assert.equal(scaled.x, 225);
  assert.equal(scaled.y, 325);
  assert.equal(scaled.width, 350);
  assert.equal(scaled.height, 75);
  for (const whale of scene.whales) assert.ok(bodyClear(whale, scaled));

  // Clearing the list is exactly the pre-0.10 behaviour: an untouched twin stays in step.
  const touched = school(3), untouched = school(3);
  setSceneObstacles(touched, []);
  assert.deepEqual(touched.obstacles, []);
  for (let frame = 0; frame < 20 * 60; frame++) {
    stepScene(touched, 1 / 60, 1);
    stepScene(untouched, 1 / 60, 1);
  }
  assert.deepEqual(touched.whales, untouched.whales);
  assert.equal(touched.time, untouched.time);
});

test('broken obstacle values are dropped instead of steering whales to NaN', () => {
  const scene = school(2);
  const before = scene.whales.map(whale => ({ x: whale.x, y: whale.y }));
  assert.deepEqual(setSceneObstacles(scene, [null, { x: NaN, y: 0, width: 10, height: 10 },
    { x: 0, y: 0, width: 0, height: 10 }, { x: 0, y: 0, width: 10, height: -1 }, 'nope']), []);
  assert.deepEqual(scene.whales.map(whale => ({ x: whale.x, y: whale.y })), before);
  assert.deepEqual(setSceneObstacles(scene, undefined), []);
  stepScene(scene, 1 / 60, 1);
  for (const whale of scene.whales) assert.ok(Number.isFinite(whale.x) && Number.isFinite(whale.y));
});
