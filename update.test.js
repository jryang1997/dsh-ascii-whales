import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, DEFAULTS, normalizeConfig, configSignature, createScene, resizeScene, stepScene } from './model.js';
import { adoptSceneState } from './motion.js';
import { createWhaleLayer, diffWhaleConfig, mountWhales } from './engine.js';
import { whaleSpecies } from './species.js';

const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);
const baseline = () => normalizeConfig(DEFAULTS);
// Reefs and ripples share the canvas with the school but use their own fixed
// alphabet. Body assertions look at the school only.
const SCENERY_GLYPHS = new Set(['@', '%', '#', '*', '+', ':', '.', '·', '˙', '~', ',', "'"]);
const school = points => points.filter(point => !SCENERY_GLYPHS.has(point.glyph));

// A different value for every field: used to prove that each option lands in
// exactly one rebuild group and that the value fingerprint follows it.
const ALTERNATIVES = Object.freeze({
  enabled: false, count: 5, species: 'blue', renderStyle: 'cells', fillMode: 'ascii',
  text: '深海蓝鲸', speed: 1.1, opacity: 0.7, glyphSize: 13, whaleSize: 1.2,
  color: 'azure', quietCenter: false, leftInset: 300, glass: false, glassStrength: 0.8,
  composerGlass: true, composerAvoid: true, reefs: false, ripples: false,
});

const GROUP_OF = Object.freeze({
  scene: ['count', 'text', 'species', 'whaleSize'],
  metrics: ['glyphSize', 'fillMode', 'renderStyle'],
  palette: ['color'],
  glass: ['glass', 'glassStrength'],
  composer: ['composerGlass', 'composerAvoid'],
  live: ['speed', 'opacity', 'quietCenter', 'enabled', 'leftInset', 'reefs', 'ripples'],
});
const GROUPS = Object.keys(GROUP_OF);

test('config signature follows values, not object identity', () => {
  const base = baseline();
  assert.equal(configSignature(base), configSignature({ ...base }));
  assert.equal(configSignature(base), configSignature(JSON.parse(JSON.stringify(base))));
  assert.equal(configSignature(base), configSignature(undefined));
  assert.equal(configSignature(base), configSignature({ ...base, unknownKey: 1 }));
  // Field order in the input cannot change the fingerprint: normalization owns it.
  const shuffled = Object.fromEntries(Object.entries(base).reverse());
  assert.equal(configSignature(base), configSignature(shuffled));
  // Every field participates, so a write that changes anything is never a no-op.
  for (const key of Object.keys(FIELDS)) {
    assert.notEqual(configSignature({ ...base, [key]: ALTERNATIVES[key] }), configSignature(base), key);
  }
});

test('every field is classified into exactly one rebuild group, and equal values change nothing', () => {
  const base = baseline();
  const unchanged = diffWhaleConfig(base, { ...base });
  assert.deepEqual(unchanged, { scene: false, metrics: false, palette: false, glass: false, composer: false, live: false });
  for (const group of GROUPS) {
    for (const key of GROUP_OF[group]) {
      const changes = diffWhaleConfig(base, normalizeConfig({ ...DEFAULTS, [key]: ALTERNATIVES[key] }));
      for (const name of GROUPS) {
        assert.equal(changes[name], name === group, `${key} changed ${name}: expected ${name === group}`);
      }
    }
  }
  // A missing config is treated as "everything unknown" rather than throwing.
  assert.deepEqual(diffWhaleConfig(undefined, base), { scene: true, metrics: true, palette: true, glass: true, composer: true, live: true });
});

test('the default whale size reproduces the 0.8.0 particle counts exactly', () => {
  // Measured from the 0.8.0 runtime before the size option existed (virtual
  // 1600x900 stage, default text and species): the default picture must not move.
  const published = { 1: 2176, 2: 4355, 3: 6531, 4: 7855, 5: 7979, 6: 7894, 7: 7827, 8: 7722 };
  for (const [count, particles] of Object.entries(published)) {
    const scene = createScene(Number(count));
    assert.equal(scene.whales.length, Number(count));
    assert.equal(scene.whaleSize, 1);
    assert.equal(scene.particles.length, particles, `${count} whales`);
    assert.equal(createScene(Number(count), DEFAULTS.text, DEFAULTS.species, 1).particles.length, particles);
  }
  assert.deepEqual(createScene(3, DEFAULTS.text, DEFAULTS.species, undefined), createScene(3));
});

test('whale size scales the particle budget and caps it at 8000', () => {
  const base = createScene(3);
  const tiny = createScene(3, DEFAULTS.text, DEFAULTS.species, 0.55);
  const large = createScene(1, DEFAULTS.text, DEFAULTS.species, 1.55);
  const capped = createScene(8, DEFAULTS.text, DEFAULTS.species, 1.55);
  assert.equal(tiny.whaleSize, 0.55);
  assert.equal(large.whaleSize, 1.55);
  assert.ok(tiny.particles.length < base.particles.length * 0.45, `${tiny.particles.length} should be much sparser than ${base.particles.length}`);
  assert.ok(tiny.particles.length > base.particles.length * 0.3, 'the small whale still needs a readable body');
  assert.ok(large.particles.length > createScene(1).particles.length * 2.2, 'the large whale is denser, not sparser');
  assert.equal(capped.particles.length, createScene(8).particles.length, 'both totals sit on the 8000 cap');
  assert.ok(capped.particles.length <= 8000);
  // Out-of-range or unusable values fall back to the documented bounds.
  assert.equal(createScene(1, DEFAULTS.text, DEFAULTS.species, 9).whaleSize, 1.55);
  assert.equal(createScene(1, DEFAULTS.text, DEFAULTS.species, 0.1).whaleSize, 0.55);
  assert.equal(createScene(1, DEFAULTS.text, DEFAULTS.species, NaN).whaleSize, 1);
});

test('body length follows whale size almost linearly and rises past the old 560 px ceiling', () => {
  const lengths = [0.55, 1, 1.55].map(size => {
    const scene = createScene(1, DEFAULTS.text, 'blue', size);
    assert.equal(scene.whaleSize, size);
    assert.equal(scene.whales[0].length, scene.whales[0].halfLength * 2);
    return scene.whales[0].length;
  });
  close(lengths[0] / lengths[1], 0.55);
  close(lengths[2] / lengths[1], 1.55);
  assert.ok(lengths[1] > 400 && lengths[1] < 560, 'the default size keeps the 0.8.0 length');
  assert.ok(lengths[2] > 560, 'a large whale must be allowed to exceed the fixed 0.8.0 ceiling');
  // A resize must apply the size already stored on the scene, e.g. when the
  // canvas is laid out after the settings were read.
  const scene = createScene(2);
  resizeScene(scene, 1400, 800);
  const before = scene.whales.map(whale => whale.length);
  scene.whaleSize = 1.55;
  resizeScene(scene, 1400, 800);
  scene.whales.forEach((whale, index) => close(whale.length / before[index], 1.55));
});

test('adoptSceneState carries live swimming state to the rebuilt scene without mixing ids', () => {
  const previous = createScene(3, DEFAULTS.text, 'mixed', 1);
  resizeScene(previous, 1280, 720);
  for (let frame = 0; frame < 240; frame++) stepScene(previous, 1 / 60, 1);
  const expected = previous.whales.map(whale => ({ id: whale.id, x: whale.x, y: whale.y, heading: whale.heading,
    turn: whale.turn, speed: whale.speed, vx: whale.vx, vy: whale.vy, age: whale._motion.age, wave: whale._motion.wave,
    stroke: whale._motion.stroke, targetX: whale._motion.targetX, targetY: whale._motion.targetY }));

  const replacement = createScene(3, '深海蓝鲸', 'mixed', 1.25);
  resizeScene(replacement, 1280, 720);
  const control = createScene(3, '深海蓝鲸', 'mixed', 1.25);
  resizeScene(control, 1280, 720);

  assert.equal(adoptSceneState(previous, replacement), 3);
  for (const whale of replacement.whales) {
    const before = expected[whale.id], source = previous.whales[whale.id];
    for (const key of ['x', 'y', 'heading', 'turn', 'speed', 'vx', 'vy']) assert.equal(whale[key], before[key], `${key} of whale ${whale.id}`);
    assert.equal(whale._motion.age, before.age);
    assert.equal(whale._motion.wave, before.wave);
    assert.equal(whale._motion.stroke, before.stroke);
    assert.equal(whale._motion.targetX, before.targetX);
    assert.equal(whale._motion.targetY, before.targetY);
    assert.equal(whale._motion.cruise, source._motion.cruise, "a same-species hand-over keeps the species' cruise value untouched");
    assert.equal(whale._motion.agility, source._motion.agility, "a same-species hand-over keeps the species' turn rate untouched");
    assert.notEqual(whale._motion, source._motion, 'route state is copied, not shared with the discarded scene');
    assert.equal(whale.rig.nodes.length, 36);
    assert.ok(whale.rig.nodes.every(Number.isFinite));
    assert.notEqual(whale.x, control.whales[whale.id].x, 'the rebuilt scene really started somewhere else');
  }

  // A larger replacement has extra ids: those keep their fresh layout, they must
  // not borrow the state of an unrelated whale.
  const grown = createScene(5, DEFAULTS.text, 'mixed', 1);
  resizeScene(grown, 1280, 720);
  const grownControl = createScene(5, DEFAULTS.text, 'mixed', 1);
  resizeScene(grownControl, 1280, 720);
  assert.equal(adoptSceneState(previous, grown), 3);
  for (const whale of grown.whales.slice(3)) assert.deepEqual(whale, grownControl.whales[whale.id]);

  assert.equal(adoptSceneState(null, grown), 0);
  assert.equal(adoptSceneState(previous, previous), 0);
  assert.equal(adoptSceneState({ whales: [{ id: 7 }] }, { whales: [{ id: 0 }, { id: 1 }] }), 0);
});

test('switching a mixed group to one species rescales cruise and turn rate by the anatomy ratio', () => {
  const previous = createScene(3, DEFAULTS.text, 'mixed', 1);
  resizeScene(previous, 1280, 720);
  for (let frame = 0; frame < 120; frame++) stepScene(previous, 1 / 60, 1);
  const before = previous.whales.map(whale => ({ id: whale.id, species: whale.species, age: whale._motion.age,
    cruise: whale._motion.cruise, agility: whale._motion.agility, seed: whale._motion.seed }));

  const replacement = createScene(3, DEFAULTS.text, 'humpback', 1);
  resizeScene(replacement, 1280, 720);
  assert.equal(adoptSceneState(previous, replacement), 3);
  const humpback = whaleSpecies('humpback');

  replacement.whales.forEach((whale, index) => {
    const source = before[index], oldAnatomy = whaleSpecies(source.species);
    assert.equal(whale.species, 'humpback');
    if (source.species === 'humpback') {
      // Already the new species: the hand-over stays a pure copy.
      assert.equal(whale._motion.cruise, source.cruise);
      assert.equal(whale._motion.agility, source.agility);
    } else {
      close(whale._motion.cruise / source.cruise, humpback.cruise / oldAnatomy.cruise);
      close(whale._motion.agility / source.agility, humpback.turnRate / oldAnatomy.turnRate);
    }
    assert.equal(whale._motion.seed, source.seed, 'the individual variation seed survives the switch');
    assert.equal(whale._motion.age, source.age, 'the route clock keeps running through the switch');
    // The result sits inside the new species' own jitter band, not the old one.
    assert.ok(whale._motion.cruise >= humpback.cruise * 0.93 && whale._motion.cruise <= humpback.cruise * 1.07,
      `cruise ${whale._motion.cruise} is outside the humpback band`);
    assert.ok(whale._motion.agility >= humpback.turnRate * 0.95 && whale._motion.agility <= humpback.turnRate * 1.09,
      `agility ${whale._motion.agility} is outside the humpback band`);
  });
  // A mixed group becomes humpback for every id except the whale that already
  // was one (id 1); that pair is the only untouched hand-over, asserted above.

  // And the reverse direction: one species back to a mixed group.
  const backwards = createScene(3, DEFAULTS.text, 'mixed', 1);
  resizeScene(backwards, 1280, 720);
  const humpbackGroup = createScene(3, DEFAULTS.text, 'humpback', 1);
  resizeScene(humpbackGroup, 1280, 720);
  adoptSceneState(humpbackGroup, backwards);
  backwards.whales.forEach((whale, index) => {
    const anatomy = whaleSpecies(whale.species);
    assert.ok(whale._motion.cruise >= anatomy.cruise * 0.93 && whale._motion.cruise <= anatomy.cruise * 1.07,
      `mixed id ${index} cruise ${whale._motion.cruise} vs ${anatomy.cruise}`);
    assert.ok(whale._motion.agility >= anatomy.turnRate * 0.95 && whale._motion.agility <= anatomy.turnRate * 1.09);
  });
});

/**
 * Minimal DOM stand-in for the engine. It is deliberately small: the layer only
 * needs a 2D context, a measured canvas rect, media queries and the two
 * observers. Counting calls is what makes the "no-op" promise testable without
 * a browser.
 */
function harness(options = {}) {
  const stats = { getContext: 0, measureText: 0, draws: 0, frames: 0, createCanvas: 0 };
  const drawn = [];
  const viewport = { width: options.width ?? 800, height: options.height ?? 600 };
  const context = {
    font: '', textAlign: '', textBaseline: '', fillStyle: '', globalAlpha: 1, filter: 'none',
    setTransform() {}, clearRect() { stats.draws++; drawn.length = 0; }, fillRect() {},
    measureText(glyph) {
      stats.measureText++;
      const width = Math.min(16, 7 + glyph.length * 2);
      return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 };
    },
    fillText(glyph, x, y) { drawn.push({ glyph, x, y, alpha: this.globalAlpha }); },
    save() {}, restore() {}, clip() {}, stroke() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {},
    drawImage() {}, createLinearGradient() { return { addColorStop() {} }; },
  };
  const canvases = [];
  const canvas = () => {
    // Browsers give a fresh canvas a 300x150 backing store; matching that keeps
    // the engine's "already sized?" shortcut honest in the layout tests.
    const element = { width: 300, height: 150, getContext() { stats.getContext++; return context; },
      getBoundingClientRect() { return { left: 0, top: 0, width: viewport.width, height: viewport.height }; } };
    canvases.push(element);
    return element;
  };
  const observers = [];
  const composerElement = options.composerRect ? { getBoundingClientRect: () => options.composerRect } : null;
  const raf = { next: 1, queue: new Map(), now: 1000,
    request(callback) { const id = this.next++; this.queue.set(id, callback); return id; },
    cancel(id) { this.queue.delete(id); },
    pending() { return [...this.queue.keys()]; },
    step(milliseconds = 1000 / 60) {
      this.now += milliseconds;
      stats.frames++;
      const due = [...this.queue.values()];
      this.queue.clear();
      for (const callback of due) callback(this.now);
    },
    flush() { while (this.queue.size) this.step(); },
  };
  const saved = {};
  const media = query => ({
    matches: (Boolean(options.reduceMotion) && query.includes('reduced-motion'))
      || (Boolean(options.reduceTransparency) && query.includes('reduced-transparency')),
    addEventListener() {}, removeEventListener() {} });
  function install() {
    for (const key of ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver', 'getComputedStyle']) {
      saved[key] = globalThis[key];
    }
    globalThis.window = { devicePixelRatio: 1, matchMedia: media, addEventListener() {}, removeEventListener() {} };
    globalThis.document = {
      hidden: false, body: { hasAttribute: () => false },
      querySelectorAll: selector => composerElement && selector === '[data-composer-card]' ? [composerElement] : [],
      createElement: () => {
        stats.createCanvas++;
        // A private offscreen context: the frost pass must not touch the main one.
        const offscreen = {
          font: '', fillStyle: '', globalAlpha: 1, filter: 'none',
          setTransform() {}, clearRect() {}, fillRect() {}, drawImage() {}, save() {}, restore() {}, clip() {},
          createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 0 }),
        };
        return { width: 0, height: 0, getContext: () => offscreen };
      },
      addEventListener() {}, removeEventListener() {},
    };
    globalThis.requestAnimationFrame = callback => raf.request(callback);
    globalThis.cancelAnimationFrame = id => raf.cancel(id);
    globalThis.ResizeObserver = class {
      constructor(callback) { this.callback = callback; this.active = true; observers.push(this); }
      observe() {}
      disconnect() { this.active = false; }
    };
    globalThis.MutationObserver = class { observe() {} disconnect() {} };
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '',
      borderTopLeftRadius: options.composerRadius ?? '18px' });
  }
  function restore() {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
  /** Simulate the browser laying the canvas out / resizing the window. */
  function setViewport(width, height) {
    viewport.width = width;
    viewport.height = height;
    for (const observer of observers) if (observer.active) observer.callback();
  }
  return { stats, drawn, canvas, canvases, raf, viewport, setViewport, install, restore };
}

test('an unchanged settings snapshot is a complete no-op and a real edit updates in place', t => {
  const { stats, drawn, canvas, canvases, raf, install, restore } = harness();
  install();
  t.after(restore);
  // Glass is off here: the frosted pane needs a second canvas and a text column,
  // which is out of scope for the update mechanics and already covered by
  // glass.test.js and the browser pass. Everything else is the shipped default.
  const config = normalizeConfig({ ...DEFAULTS, glass: false });
  const same = () => normalizeConfig({ ...DEFAULTS, glass: false });
  const layer = createWhaleLayer(canvas(), config);
  assert.equal(stats.getContext, 1, 'one 2D context for the whole lifetime');
  assert.equal(raf.queue.size, 1, 'the animation loop starts once');
  for (let frame = 0; frame < 90; frame++) raf.step();
  const swimming = drawn.map(point => ({ x: point.x, y: point.y }));
  const measureCount = stats.measureText, drawCount = stats.draws, pending = raf.pending();
  assert.ok(swimming.length > 100, 'the school is actually drawn');

  // What DSH does on a model switch: same settings content, brand new object.
  layer.update(same());
  assert.equal(stats.measureText, measureCount, 'an identical snapshot must not re-measure glyphs');
  assert.equal(stats.draws, drawCount, 'an identical snapshot must not repaint or rebuild the grid');
  assert.equal(stats.getContext, 1, 'the canvas element is reused');
  assert.deepEqual(raf.pending(), pending, 'the animation frame keeps running instead of restarting');
  assert.equal(canvases.length, 1, 'no second canvas is created');

  // A genuinely different option: opacity is read at paint time, so it repaints.
  const alphas = () => drawn.map(point => point.alpha);
  const beforeAlpha = Math.max(...alphas());
  layer.update({ ...config, opacity: 0.15 });
  assert.equal(stats.measureText, measureCount, 'opacity must not rebuild the font or the grid');
  assert.equal(stats.getContext, 1);
  assert.deepEqual(raf.pending(), pending, 'opacity must not interrupt the animation loop');
  assert.ok(Math.max(...alphas()) < beforeAlpha * 0.5, `opacity 0.15 should be much fainter than ${beforeAlpha}`);

  // A scene change while swimming: same whales, same cells, new body text.
  const kept = drawn.map(point => ({ x: point.x, y: point.y }));
  const fadeOut = { ...config, opacity: 0.15, text: '深海蓝鲸' };
  layer.update(fadeOut);
  assert.equal(stats.getContext, 1, 'a rebuild never touches the canvas element');
  assert.equal(raf.queue.size, 1, 'a rebuild keeps the existing animation loop');
  assert.deepEqual(drawn.map(point => ({ x: point.x, y: point.y })), kept,
    'the swimming state was carried over instead of resetting to the start layout');
  assert.ok(school(drawn).every(point => ['深', '海', '蓝', '鲸'].includes(point.glyph)), 'the new body text is used');
  assert.ok(stats.draws > drawCount, 'the change is painted immediately');

  // The loop continues after the rebuild instead of restarting or freezing.
  const moving = drawn.map(point => ({ x: point.x, y: point.y }));
  for (let frame = 0; frame < 10; frame++) raf.step();
  assert.notDeepEqual(drawn.map(point => ({ x: point.x, y: point.y })), moving);

  // A size change is another scene rebuild; it may reshape the body, but the
  // whale stays where it was rather than jumping back to its start layout.
  const centroid = points => points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const beforeSize = centroid(drawn.map(point => ({ x: point.x, y: point.y })));
  layer.update({ ...fadeOut, whaleSize: 1.55 });
  assert.equal(stats.getContext, 1);
  const afterSize = centroid(drawn.map(point => ({ x: point.x, y: point.y })));
  assert.ok(Math.abs(afterSize.x - beforeSize.x) < 120 && Math.abs(afterSize.y - beforeSize.y) < 120,
    `the large whale moved from ${JSON.stringify(beforeSize)} to ${JSON.stringify(afterSize)}`);
  assert.ok(drawn.length > 100, 'the larger body still draws');

  // Disposing and then updating again must stay harmless.
  layer.dispose();
  assert.equal(canvases[0].width, 1);
  layer.update(same());
  raf.step();
  assert.equal(canvases.length, 1);

  // The backwards-compatible entry point still returns a disposer.
  const second = canvas();
  const dispose = mountWhales(second, config);
  assert.equal(typeof dispose, 'function');
  dispose();
  assert.equal(second.width, 1);
  // A canvas without a 2D context degrades to a no-op layer.
  const inert = createWhaleLayer({ getContext: () => null }, config);
  inert.update(config);
  inert.dispose();
});

test('speed 0 is a preview-only pause sentinel and never leaks into the settings contract', t => {
  const { stats, drawn, canvas, raf, install, restore } = harness();
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false });
  // The settings document cannot express 0, and normalization keeps clamping it:
  // the sentinel exists only inside the engine's own config copy.
  assert.equal(normalizeConfig({ ...DEFAULTS, speed: 0 }).speed, FIELDS.speed.min);
  assert.equal(configSignature({ ...DEFAULTS, speed: 0 }), configSignature({ ...DEFAULTS, speed: FIELDS.speed.min }));
  const layer = createWhaleLayer(canvas(), config);
  for (let frame = 0; frame < 40; frame++) raf.step();
  layer.update({ ...config, speed: 0 });
  const frozen = drawn.map(point => ({ x: point.x, y: point.y }));
  const draws = stats.draws;
  for (let frame = 0; frame < 40; frame++) raf.step();
  assert.deepEqual(drawn.map(point => ({ x: point.x, y: point.y })), frozen, 'a paused layer must not move');
  assert.ok(stats.draws > draws, 'a paused layer keeps its last static frame on screen');
  // A paused layer also ignores scene edits positionally: the school stays put.
  layer.update({ ...config, speed: 0, text: '深海蓝鲸' });
  assert.deepEqual(drawn.map(point => ({ x: point.x, y: point.y })), frozen, 'pausing must survive a rebuild');
  layer.update({ ...config, speed: 0.65 });
  for (let frame = 0; frame < 8; frame++) raf.step();
  assert.notDeepEqual(drawn.map(point => ({ x: point.x, y: point.y })), frozen, 'resuming moves the school again');
  layer.dispose();
});

test('reduced motion stays on a static pose but an update still repaints one frame', t => {
  const { stats, drawn, canvas, raf, install, restore } = harness({ reduceMotion: true });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false });
  const layer = createWhaleLayer(canvas(), config);
  assert.equal(raf.queue.size, 0, 'reduced motion must not start an animation loop');
  assert.ok(drawn.length > 100, 'the static pose is painted once');
  const pose = drawn.map(point => ({ x: point.x, y: point.y }));
  const draws = stats.draws;
  // Layout-only changes still have to appear: one immediate frame, still no loop.
  layer.update({ ...config, text: '深海蓝鲸' });
  assert.ok(stats.draws > draws, 'the update repaints immediately');
  assert.equal(raf.queue.size, 0, 'the update must not start the animation loop either');
  assert.deepEqual(drawn.map(point => ({ x: point.x, y: point.y })), pose);
  assert.ok(school(drawn).every(point => ['深', '海', '蓝', '鲸'].includes(point.glyph)));
  layer.dispose();
});

test('a scene rebuilt before the canvas is laid out still lands where the school belongs', t => {
  const { drawn, canvas, canvases, raf, setViewport, install, restore } = harness({ width: 0, height: 0 });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false });
  const layer = createWhaleLayer(canvas(), config);
  assert.equal(raf.queue.size, 0, 'nothing to animate while the canvas has no size');
  // The settings document can be written before the overlay gets its layout.
  layer.update({ ...config, text: '深海蓝鲸' });
  assert.equal(drawn.length, 0);
  setViewport(800, 600);
  assert.equal(canvases.length, 1);
  assert.ok(drawn.length > 100, 'the school appears once the canvas is measured');
  const xs = drawn.map(point => point.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 300,
    `the school spread from ${Math.min(...xs)} to ${Math.max(...xs)} instead of clustering at the origin`);
  layer.dispose();
});

test('the input-box glass works on its own and fades glyphs only inside the card', t => {
  // A bottom-centre card, in the same coordinate space as the 800x600 canvas.
  const card = { left: 100, top: 400, width: 600, height: 120 };
  const { stats, drawn, canvas, raf, install, restore } = harness({ composerRect: card });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false, composerGlass: true });
  const layer = createWhaleLayer(canvas(), config);
  // The reading pane is off, yet the composer material needs its frost buffer.
  assert.ok(stats.createCanvas >= 1, 'the frost buffer is allocated for the composer pane');
  assert.ok(stats.draws > 0);
  assert.equal(stats.getContext, 1);
  assert.ok(drawn.length > 100);
  const insideCard = point => point.x > card.left && point.x < card.left + card.width
    && point.y > card.top && point.y < card.top + card.height;
  assert.ok(drawn.every(point => !insideCard(point)), 'sharp glyphs must not show under the input glass');
  assert.ok(drawn.some(point => point.y < card.top), 'glyphs remain outside the pane');

  // Switching options re-measures the same canvas instead of remounting it.
  const before = { getContext: stats.getContext, canvases: stats.createCanvas };
  layer.update({ ...config, composerGlass: false, composerAvoid: true });
  assert.equal(stats.getContext, before.getContext);
  raf.step();
  layer.update({ ...config, composerGlass: false, composerAvoid: false, glass: true });
  assert.equal(stats.getContext, before.getContext, 'the reading pane comes back without a new canvas');
  raf.step();
  // Both panes at once: they overlap, so this exercises the double fade and the
  // reading-then-card paint order.
  layer.update({ ...config, glass: true, composerGlass: true });
  assert.equal(stats.getContext, before.getContext);
  raf.step();
  layer.dispose();
});

test('reduced transparency clears the composer glass material but still holds glyphs out', t => {
  const card = { left: 100, top: 400, width: 600, height: 120 };
  const { stats, drawn, canvas, install, restore } = harness({ composerRect: card, reduceTransparency: true });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false, composerGlass: true });
  const layer = createWhaleLayer(canvas(), config);
  assert.equal(stats.createCanvas, 0, 'no frost buffer is allocated when the material is cleared');
  const insideCard = point => point.x > card.left && point.x < card.left + card.width
    && point.y > card.top && point.y < card.top + card.height;
  assert.ok(drawn.length > 100);
  // The material is gone, but the text area stays clear of the sea: sharp glyphs
  // are still held out of the card exactly as the reading pane does in 0.9.0.
  assert.ok(drawn.every(point => !insideCard(point)), 'clear mode still holds glyphs out of the pane');
  assert.ok(drawn.some(point => point.y < card.top), 'glyphs remain outside the pane');
  layer.dispose();
});

test('avoidance keeps whale ink off the input card, and the card stops hiding it again', t => {
  const card = { left: 100, top: 400, width: 600, height: 120 };
  const { stats, drawn, canvas, raf, install, restore } = harness({ composerRect: card });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false, composerAvoid: true });
  const layer = createWhaleLayer(canvas(), config);
  for (let frame = 0; frame < 90; frame++) raf.step();
  const insideCard = point => point.x > card.left && point.x < card.left + card.width
    && point.y > card.top && point.y < card.top + card.height;
  assert.ok(drawn.length > 0);
  assert.ok(drawn.every(point => !insideCard(point)), 'no glyph may be painted over the input card in avoid mode');
  assert.ok(drawn.some(point => point.y < card.top), 'the school still paints elsewhere');
  assert.equal(stats.getContext, 1, 'avoidance never remounts the canvas');
  assert.equal(stats.createCanvas, 0, 'avoidance paints no material');
  layer.dispose();
  // Control: the same scene without avoidance does paint through the card area
  // (the third whale starts inside it), so the assertion above is meaningful.
  const plain = createWhaleLayer(canvas(), { ...config, composerAvoid: false });
  for (let frame = 0; frame < 90; frame++) raf.step();
  assert.ok(school(drawn).some(point => insideCard(point)), 'without avoidance the card region can hold whale ink again');
  plain.dispose();
});
