import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELDS, DEFAULTS, normalizeConfig, configSignature, createScene, resizeScene, stepScene } from '../src/model.js';
import { adoptSceneState } from '../src/motion.js';
import { createWhaleLayer, diffWhaleConfig, mountWhales } from '../src/engine.js';
import { whaleSpecies } from '../src/species.js';
import { createWhaleSimulation } from '../src/simulation.js';
import { createWorkMetrics } from '../src/work-metrics.js';

const close = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} differs from ${b}`);

test('optional observation preserves seeded renderer output, reading masks and lifecycle', () => {
  function render(observe) {
    const env = harness();
    env.install();
    const metrics = createWorkMetrics();
    const layer = createWhaleLayer(env.canvas(), { ...DEFAULTS, spout: false }, { seed: 42, metrics: observe ? metrics : null });
    try {
      for (let frame = 0; frame < 90; frame++) env.raf.step();
      layer.setActivity({ entities: [] });
      layer.update({ ...DEFAULTS, spout: false, opacity: 0.5 });
      const result = { drawn: structuredClone(env.drawn), stats: { ...env.stats }, pending: env.raf.pending() };
      layer.dispose();
      const before = metrics.snapshot();
      env.raf.step();
      assert.deepEqual(metrics.snapshot(), before, 'disposed layers do no observed work');
      return { result, sample: before };
    } finally { layer.dispose(); env.restore(); }
  }
  const observed = render(true), control = render(false);
  assert.deepEqual(observed.result, control.result);
  assert.equal(observed.sample.counters.wakeup.count, 90);
  assert.equal(observed.sample.counters.motionStep.count, 89);
  assert.ok(observed.sample.counters.layout.count > 0);
  for (const cause of ['sync', 'animation', 'activity', 'config']) assert.ok(observed.sample.timeline.some(event => event.name === 'draw' && event.cause === cause), cause);
  assert.equal(control.sample.counters.wakeup.count, 0);
});

const baseline = () => normalizeConfig(DEFAULTS);

// A different value for every field: used to prove that each option lands in
// exactly one rebuild group and that the value fingerprint follows it.
const ALTERNATIVES = Object.freeze({
  enabled: false, resourceMode: 'economy', count: 5, species: 'blue', renderStyle: 'cells', fillMode: 'ascii',
  text: '深海蓝鲸', speed: 1.1, opacity: 0.7, glyphSize: 13, whaleSize: 1.2,
  color: 'azure', activity: false, dictationEcho: false, quietCenter: false, leftInset: 300, glass: false, glassStrength: 0.8,
  readingEffect: 'glow', composerGlass: true, composerAvoid: true, spout: false, ripples: false, wind: false, clouds: false,
  rain: true, rainIntensity: 0.8, pauseOnScroll: true, seaGrid: false,
});

const GROUP_OF = Object.freeze({
  scene: ['count', 'text', 'species', 'whaleSize'],
  metrics: ['glyphSize', 'fillMode', 'renderStyle'],
  palette: ['color'],
  glass: ['glass', 'glassStrength', 'readingEffect'],
  composer: ['composerGlass', 'composerAvoid'],
  live: ['resourceMode', 'speed', 'opacity', 'quietCenter', 'enabled', 'leftInset', 'spout', 'ripples', 'seaGrid', 'wind', 'clouds', 'rain', 'rainIntensity', 'activity', 'dictationEcho', 'pauseOnScroll'],
});
const GROUPS = Object.keys(GROUP_OF);

// `composerAvoid` is mutually exclusive with the content glass (glass wins), so
// its single-field variant has to start from glass: false; otherwise the value
// would be normalized back to false and the field would look inert.
const variantOf = key => normalizeConfig({ ...DEFAULTS,
  glass: key === 'composerAvoid' ? false : DEFAULTS.glass,
  [key]: ALTERNATIVES[key] });
const baseOf = key => normalizeConfig({ ...DEFAULTS,
  glass: key === 'composerAvoid' ? false : DEFAULTS.glass });

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
    assert.notEqual(configSignature(variantOf(key)), configSignature(baseOf(key)), key);
  }
});

test('every field is classified into exactly one rebuild group, and equal values change nothing', () => {
  const base = baseline();
  const unchanged = diffWhaleConfig(base, { ...base });
  assert.deepEqual(unchanged, { scene: false, metrics: false, palette: false, glass: false, composer: false, live: false });
  for (const group of GROUPS) {
    for (const key of GROUP_OF[group]) {
      const changes = diffWhaleConfig(baseOf(key), variantOf(key));
      for (const name of GROUPS) {
        assert.equal(changes[name], name === group, `${key} changed ${name}: expected ${name === group}`);
      }
    }
  }
  // A missing config is treated as "everything unknown" rather than throwing.
  assert.deepEqual(diffWhaleConfig(undefined, base), { scene: true, metrics: true, palette: true, glass: true, composer: true, live: true });
});

test('simulation update reports actual scene replacement for structural edits and retains it for live edits', () => {
  for (const key of Object.keys(FIELDS)) {
    const simulation = createWhaleSimulation(baseOf(key), { seed: 42 });
    const previous = simulation.scene;
    const rebuilt = simulation.update(variantOf(key));
    assert.equal(rebuilt, GROUP_OF.scene.includes(key), `${key}: replacement result`);
    assert.equal(simulation.scene === previous, !rebuilt, `${key}: exposed render scene`);
    assert.equal(simulation.update(variantOf(key)), false, `${key}: unchanged update`);
    simulation.dispose();
  }
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
  const stats = { getContext: 0, measureText: 0, draws: 0, frames: 0, createCanvas: 0,
    mainGlyphs: 0, seaGlyphs: 0, seaTiles: 0, blurCopies: 0,
    paneClips: 0, paneStrokes: 0, panePaths: 0, paneMoves: 0, paneImages: 0, paneGradients: 0 };
  const drawn = [];
  let exteriorDepth = 0;
  const clipStack = [];
  const viewport = { width: options.width ?? 800, height: options.height ?? 600 };
  const context = {
    font: '', textAlign: '', textBaseline: '', fillStyle: '', globalAlpha: 1, filter: 'none',
    setTransform() {}, clearRect() { stats.draws++; drawn.length = 0; }, fillRect() {},
    measureText(glyph) {
      stats.measureText++;
      const width = Math.min(16, 7 + glyph.length * 2);
      return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 };
    },
    fillText(glyph, x, y) { stats.mainGlyphs++; drawn.push({ glyph, x, y, alpha: this.globalAlpha, exteriorDepth }); },
    save() { clipStack.push(exteriorDepth); }, restore() { exteriorDepth = clipStack.pop() ?? 0; },
    clip(rule) { stats.paneClips++; if (rule === 'evenodd') exteriorDepth++; }, stroke() { stats.paneStrokes++; },
    beginPath() { stats.panePaths++; }, moveTo() { stats.paneMoves++; }, lineTo() {}, arcTo() {}, closePath() {},
    drawImage() { stats.paneImages++; },
    createLinearGradient() { stats.paneGradients++; return { addColorStop() {} }; },
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
  const defaultStyle = { backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0px',
    borderTopLeftRadius: '0px', borderTopRightRadius: '0px', borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px', position: 'static', visibility: 'visible', display: 'block',
    getPropertyValue: () => '' };
  const contentElements = (options.contentBoxes || []).map(box => ({
    __style: { ...defaultStyle, backgroundColor: box.transparent ? 'rgba(0, 0, 0, 0)' : 'rgb(255, 255, 255)',
      borderTopLeftRadius: `${box.radius ?? 18}px`, borderTopRightRadius: `${box.radius ?? 18}px`,
      borderBottomRightRadius: `${box.radius ?? 18}px`, borderBottomLeftRadius: `${box.radius ?? 18}px`,
      position: box.fixed ? 'fixed' : 'static', display: box.hidden ? 'none' : 'block' },
    children: box.children || [],
    getBoundingClientRect: () => ({ left: box.left, top: box.top, width: box.width, height: box.height }),
  }));
  const scrollerElement = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: viewport.width, height: viewport.height }),
    children: contentElements,
  };
  const composerElement = options.composerRect ? {
    __style: { ...defaultStyle, backgroundColor: 'rgb(255, 255, 255)',
      borderTopLeftRadius: `${options.composerRadius ?? 18}px` },
    children: [],
    getBoundingClientRect: () => options.composerRect,
  } : null;
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
    for (const key of ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', 'ResizeObserver', 'MutationObserver', 'getComputedStyle', 'performance']) {
      saved[key] = globalThis[key];
    }
    globalThis.window = { devicePixelRatio: 1, matchMedia: media, addEventListener() {}, removeEventListener() {} };
    // The engine throttles paints with `now - lastPaint`, and update() stamps
    // lastPaint with performance.now(). Leaving that on the real process clock
    // races it against the stub's step clock: under load the real clock runs
    // ahead of the stepped one and a paused layer never repaints. One clock for
    // everything makes the 30fps throttle and the pause deterministic.
    globalThis.performance = { now: () => raf.now };
    globalThis.document = {
      hidden: false, body: { hasAttribute: () => false },
      querySelectorAll: selector => {
        if (selector === '[data-composer-card]') return composerElement ? [composerElement] : [];
        if (selector === '[data-conversation-scroll]') return [scrollerElement];
        return [];
      },
      createElement: () => {
        stats.createCanvas++;
        // A private offscreen context: the shared sea/blur pass must not touch the
        // main canvas, and it needs the glyph API because the sea is a glyph pass.
        const offscreen = {
          font: '', fillStyle: '', globalAlpha: 1, filter: 'none', textAlign: '', textBaseline: '',
          lineWidth: 1, strokeStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
          setTransform() {}, clearRect() {}, fillRect() { stats.seaTiles++; },
          drawImage() { stats.blurCopies++; },
          fillText() { stats.seaGlyphs++; },
          save() {}, restore() {}, clip() {}, stroke() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {},
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
    globalThis.getComputedStyle = (element, pseudo) => pseudo
      ? (pseudo === '::before' ? element?.__beforeStyle : element?.__afterStyle) ?? { ...defaultStyle, content: 'none' }
      : element && element.__style ? element.__style : defaultStyle;
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

test('weather toggles repaint the same layer and preserve the paused seeded pattern', t => {
  const { stats, drawn, canvas, install, restore } = harness({ reduceMotion: true });
  install();
  const config = { ...DEFAULTS, glass: false, quietCenter: false, text: '鲸', spout: false,
    ripples: false, wind: true, clouds: true };
  const layer = createWhaleLayer(canvas(), config);
  t.after(() => { layer.dispose(); restore(); });
  const weather = () => drawn.filter(point => point.glyph !== '鲸').map(point => ({ ...point }));
  const original = weather();
  assert.ok(original.length > 10, 'the running layer actually paints weather');
  const contexts = stats.getContext, fonts = stats.measureText;
  layer.update({ ...config, wind: false, clouds: false });
  assert.equal(weather().length, 0);
  layer.update(config);
  assert.deepEqual(weather(), original, 'a live toggle does not reroll wind or cloud shapes');
  assert.equal(stats.getContext, contexts, 'the canvas is reused');
  assert.equal(stats.measureText, fonts, 'the whale painter is reused');
});

test('the running layer generates tail ripples only after swimming and clears them live', t => {
  const { drawn, canvas, raf, install, restore } = harness();
  install();
  const config = { ...DEFAULTS, glass: false, quietCenter: false, spout: false, wind: false, clouds: false,
    reefs: false, ripples: true, text: '鲸', speed: 0 };
  const layer = createWhaleLayer(canvas(), config);
  t.after(() => { layer.dispose(); restore(); });
  const hasWater = () => drawn.some(point => point.glyph !== '鲸');
  for (let frame = 0; frame < 90; frame++) raf.step();
  assert.equal(hasWater(), false, 'a paused school does not splash');
  layer.update({ ...config, speed: 1 });
  let sawWater = false;
  for (let frame = 0; frame < 360; frame++) {
    raf.step();
    sawWater ||= hasWater();
  }
  assert.ok(sawWater, 'tail beats reach the actual draw loop');
  layer.update({ ...config, speed: 1, ripples: false });
  assert.equal(hasWater(), false, 'turning ripples off clears existing water immediately');
});

test('an unchanged settings snapshot is a complete no-op and a real edit updates in place', t => {
  const { stats, drawn, canvas, canvases, raf, install, restore } = harness();
  install();
  t.after(restore);
  // Glass is off here: the frosted pane needs a second canvas and a text column,
  // which is out of scope for the update mechanics and already covered by
  // glass.test.js. Scenery is off so every recorded glyph belongs to the whale.
  const config = normalizeConfig({ ...DEFAULTS, glass: false, ripples: false, wind: false, clouds: false });
  const same = () => normalizeConfig({ ...DEFAULTS, glass: false, ripples: false, wind: false, clouds: false });
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
  assert.ok(drawn.every(point => ['深', '海', '蓝', '鲸'].includes(point.glyph)), 'the new body text is used');
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
  const config = normalizeConfig({ ...DEFAULTS, glass: false, ripples: false, wind: false, clouds: false });
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
  assert.equal(stats.draws, draws, 'a paused layer retains its frame without repeating work');
  assert.equal(raf.pending().length, 0, 'preview pause cancels continuous scheduling');
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
  const config = normalizeConfig({ ...DEFAULTS, glass: false, ripples: false, wind: false, clouds: false });
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
  assert.ok(drawn.every(point => ['深', '海', '蓝', '鲸'].includes(point.glyph)));
  layer.dispose();
});

test('a scene rebuilt before the canvas is laid out still lands where the school belongs', t => {
  const { drawn, canvas, canvases, raf, setViewport, install, restore } = harness({ width: 0, height: 0 });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false, ripples: false, wind: false, clouds: false });
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

test('content glass gives every card a pane and fades the sharp glyphs inside it', t => {
  // Two message cards plus the input card, in the 800x600 canvas coordinate space.
  const cards = [
    { left: 100, top: 300, width: 600, height: 120, radius: 20 },
    { left: 140, top: 100, width: 520, height: 90, radius: 16 },
  ];
  const composer = { left: 100, top: 460, width: 600, height: 120 };
  const { stats, drawn, canvas, raf, install, restore } = harness({ contentBoxes: cards, composerRect: composer });
  install();
  t.after(restore);
  // Cloud shadows have independent Canvas buffers; count the glass buffers alone.
  // The squared sea is a separate layer whose hairlines are not glass strokes,
  // so it is off here to keep the pane accounting exact.
  const config = normalizeConfig({ ...DEFAULTS, composerAvoid: false, clouds: false, seaGrid: false });
  const layer = createWhaleLayer(canvas(), config);
  // One shared sea buffer plus its blurred copy: two offscreen canvases, no more.
  assert.equal(stats.createCanvas, 2, 'the shared sea and its blur buffer are allocated once');
  assert.ok(stats.draws > 0);
  assert.equal(stats.getContext, 1);
  // Commands may cross a pane, but the exterior clip keeps their raster out of it.
  assert.ok(drawn.length > 50);
  const insideCard = point => cards.concat([composer]).some(card => point.x > card.left
    && point.x < card.left + card.width && point.y > card.top && point.y < card.top + card.height);
  assert.ok(drawn.every(point => point.exteriorDepth === 3), 'every sharp glyph is drawn outside all three panes');
  assert.ok(drawn.some(point => !insideCard(point)), 'glyphs remain outside the panes');

  // The separate sea buffer includes the whole field for the blurred material.
  assert.ok(stats.seaGlyphs > 0, 'the shared sea was painted from the glyph field');
  assert.ok(stats.seaGlyphs >= stats.mainGlyphs,
    `the sea keeps every glyph the panes hide (${stats.seaGlyphs} vs ${stats.mainGlyphs})`);
  // Glyph mode also paints a body silhouette under the letters, so the blur has a
  // whale shape to show and not just faint text haze.
  assert.ok(stats.seaTiles > 0, 'the sea carries a body silhouette in glyph mode');
  assert.ok(stats.blurCopies > 0, 'the shared sea was blurred');
  // Glass passes per frame: ONE union clip for the shared sea image, plus one
  // surface clip per pane for tint + crest + shade. The upscaled drawImage runs
  // once no matter how many boxes there are, and no outline is ever drawn.
  const paneCount = stats.paneGradients / 2; // crest + shade per pane
  assert.ok(paneCount >= 3, `expected one pane per box, got ${paneCount}`);
  assert.equal(stats.paneStrokes, 0, 'the pane never draws an outline (the DOM frame owns it)');
  assert.equal(stats.paneImages, 1, 'one shared blurred-sea draw for all panes');
  assert.equal(stats.paneClips, paneCount * 2 + 1, 'exterior and surface clips per pane plus one shared sea clip');
  assert.equal(stats.panePaths, stats.paneClips, 'one path per clip, no stray path');
  assert.equal(stats.paneMoves, paneCount * 4, 'each exterior includes the canvas and pane, plus material paths');
  assert.equal(stats.paneGradients, paneCount * 2, 'crest and shade gradients per pane');

  // Turning the content glass off brings the sharp glyphs back over the cards,
  // on the same canvas and with no remount.
  const before = { getContext: stats.getContext, canvases: stats.createCanvas, clips: stats.paneClips, images: stats.paneImages };
  layer.update({ ...config, glass: false });
  for (let frame = 0; frame < 30; frame++) raf.step();
  assert.equal(stats.getContext, before.getContext);
  assert.equal(stats.paneClips, before.clips, 'no pane is drawn while the content glass is off');
  assert.equal(stats.paneImages, before.images, 'no sea image is drawn while the content glass is off');
  assert.ok(drawn.some(point => insideCard(point)), 'glyphs return inside the card area when the glass is off');
  layer.update({ ...config, glass: true });
  for (let frame = 0; frame < 30; frame++) raf.step();
  assert.equal(stats.getContext, before.getContext, 'the glass comes back without a new canvas');
  assert.ok(stats.paneClips > before.clips, 'panes are painted again');
  const clipsAdded = stats.paneClips - before.clips;
  const framesWithGlass = clipsAdded / (paneCount * 2 + 1);
  assert.equal(clipsAdded % (paneCount * 2 + 1), 0, 'each glass frame uses the same clip count');
  assert.equal(stats.paneImages - before.images, framesWithGlass, 'one shared sea image per glass frame');
  assert.ok(drawn.every(point => point.exteriorDepth === paneCount));
  layer.dispose();
});

test('reduced transparency clears the content material but still holds glyphs out', t => {
  const card = { left: 100, top: 350, width: 600, height: 140, radius: 20 };
  const { stats, drawn, canvas, install, restore } = harness({ contentBoxes: [card], reduceTransparency: true });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, clouds: false });
  const layer = createWhaleLayer(canvas(), config);
  assert.equal(stats.createCanvas, 0, 'no sea buffer is allocated when the material is cleared');
  assert.equal(stats.seaGlyphs, 0, 'no sea glyph pass runs when the material is cleared');
  assert.equal(stats.paneClips, 1, 'the sharp sea is clipped even without glass material');
  assert.equal(stats.paneImages, 0);
  const insideCard = point => point.x > card.left && point.x < card.left + card.width
    && point.y > card.top && point.y < card.top + card.height;
  assert.ok(drawn.length > 100);
  // The material is gone, but the card area stays clear of the sea: sharp glyphs
  // are still held out of every pane, exactly like 0.10.0's clear mode.
  assert.ok(drawn.every(point => point.exteriorDepth === 1), 'clear mode still clips the sharp sea out of the pane');
  assert.ok(drawn.some(point => !insideCard(point)), 'glyphs remain outside the pane');
  layer.dispose();
});

test('avoidance keeps whale ink off the input card, and the card stops hiding it again', t => {
  const card = { left: 100, top: 400, width: 600, height: 120 };
  const { stats, drawn, canvas, raf, install, restore } = harness({ composerRect: card });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false, composerAvoid: true, clouds: false });
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
  assert.ok(drawn.some(point => insideCard(point)), 'without avoidance the card region can hold whale ink again');
  plain.dispose();
});

test('content glass reaches deeply nested user bubbles past offscreen history, short replies and tall cards', t => {
  const defaultStyle = { backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0px',
    borderTopLeftRadius: '0px', borderTopRightRadius: '0px', borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px', position: 'static', visibility: 'visible', display: 'block',
    getPropertyValue: () => '' };
  const node = ({ left = 0, top = 0, width = 800, height = 40, opaque = false, radius = 0,
    display = 'block', hidden = false, tagName = 'DIV', children = [] } = {}) => ({
    tagName, hidden, children,
    style: { display },
    getBoundingClientRect: () => (display === 'none' || hidden || display === 'contents'
      ? { left: 0, top: 0, width: 0, height: 0 }
      : { left, top, width, height }),
    __style: { ...defaultStyle,
      backgroundColor: opaque ? 'rgb(237, 243, 254)' : defaultStyle.backgroundColor,
      borderTopLeftRadius: `${radius}px`, borderTopRightRadius: `${radius}px`,
      borderBottomRightRadius: `${radius}px`, borderBottomLeftRadius: `${radius}px`,
      display: hidden ? 'none' : display },
  });
  const wrapSlot = (child, rect) => node({ ...rect, display: 'contents',
    children: [node({ ...rect, children: [child] })] });
  const wrapTurn = (leaf, rect) => wrapSlot(wrapSlot(wrapSlot(leaf, rect), rect), rect);

  // Offscreen turns and collapsed tool groups with >700 nodes before the visible turn.
  const history = Array.from({ length: 6 }, (_, turn) => {
    const top = -1600 + turn * 220;
    const rect = { left: 80, top, width: 640, height: 180 };
    const hiddenTools = Array.from({ length: 20 }, () =>
      wrapTurn(node({ ...rect, hidden: true }), { ...rect, hidden: true }));
    const offscreenTokens = Array.from({ length: 16 }, () =>
      node({ left: 100, top: top + 40, width: 60, height: 18, tagName: 'SPAN' }));
    return node({ ...rect, children: [...hiddenTools,
      node({ ...rect, tagName: 'PRE', children: offscreenTokens })] });
  });

  // Visible boxes in the 800x600 viewport:
  // 1) Normal blue user bubble at DSH's real slot/flex depth
  const mainBubble = { left: 360, top: 180, width: 340, height: 64, opaque: true, radius: 20 };
  // 2) Short 1-char Chinese ("好", 46x42) and 1-char ASCII ("1", 38x42) blue user bubbles
  const shortBubble = { left: 654, top: 270, width: 46, height: 42, opaque: true, radius: 20 };
  const tinyBubble = { left: 662, top: 330, width: 38, height: 42, opaque: true, radius: 20 };
  // 3) Tall card/bubble whose unclipped height (560px) is >= 90% of the 600px viewport
  const tallCard = { left: 100, top: -320, width: 520, height: 560, opaque: true, radius: 16 };

  const flowRoot = wrapTurn(node({
    left: 0, top: 0, width: 800, height: 600,
    children: [
      ...history,
      wrapTurn(node(mainBubble), mainBubble),
      wrapTurn(node(shortBubble), shortBubble),
      wrapTurn(node(tinyBubble), tinyBubble),
      wrapTurn(node(tallCard), { left: 100, top: 0, width: 520, height: 240 }),
    ],
  }), { left: 0, top: 0, width: 800, height: 600 });

  const { stats, drawn, canvas, install, restore } = harness({
    contentBoxes: [{ left: 0, top: 0, width: 800, height: 600, transparent: true, radius: 0, children: [flowRoot] }],
    composerRect: { left: 100, top: 460, width: 600, height: 110 },
  });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, composerAvoid: false, clouds: false });
  const layer = createWhaleLayer(canvas(), config);
  const paneCount = stats.paneGradients / 2;
  assert.equal(paneCount, 5, 'main bubble, two short bubbles, tall card and composer all receive glass panes');
  const insideMain = point => point.x > mainBubble.left && point.x < mainBubble.left + mainBubble.width
    && point.y > mainBubble.top && point.y < mainBubble.top + mainBubble.height;
  assert.ok(drawn.some(insideMain), 'the whole field is issued before clipping');
  assert.ok(drawn.every(point => point.exteriorDepth === paneCount), 'all deeply nested panes clip the sharp sea');
  layer.dispose();
});

for (const material of [
  { name: 'translucent ::before', base: 'rgba(0, 0, 0, 0)', before: true },
  { name: 'opaque body control', base: 'rgb(255, 255, 255)' },
  { name: 'translucent body with backdrop', base: 'rgba(255, 255, 255, 0.76)', filter: 'blur(16px)' },
  { name: 'translucent ::after', base: 'rgba(0, 0, 0, 0)', after: true },
  { name: 'modern computed menu color', base: 'rgba(0, 0, 0, 0)', before: true, pseudoFill: 'color(srgb 1 1 1 / 76%)' },
  { name: 'a translucent decoration without backdrop', base: 'rgba(255, 255, 255, 0.08)', expected: 1 },
  { name: 'a zero-blur decoration', base: 'rgba(255, 255, 255, 0.08)', filter: 'blur(0px)', expected: 1 },
  { name: 'an absent pseudo element', base: 'rgba(0, 0, 0, 0)', before: true, content: 'none', expected: 1 },
  { name: 'an invisible pseudo element', base: 'rgba(0, 0, 0, 0)', before: true, opacity: '0', expected: 1 },
  { name: 'an invisible parent panel', base: 'rgba(0, 0, 0, 0)', before: true, parentOpacity: '0', expected: 1 },
  { name: 'an accent that does not cover the panel', base: 'rgba(0, 0, 0, 0)', before: true, bottom: 'auto', expected: 1 },
]) test(`${material.expected === 1 ? 'the goal bar ignores' : 'the goal bar gets its own glass pane with'} ${material.name}`, t => {
  // Installed DSH GoalBar: transparent dock -> rounded bar -> full-size ::before.
  const goal = { left: 80, top: 150, width: 640, height: 36 };
  const transparent = { backgroundColor: 'rgba(0, 0, 0, 0)', position: 'relative',
    visibility: 'visible', display: 'flex', borderTopLeftRadius: '8px', borderTopRightRadius: '8px',
    borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' };
  const pseudo = { ...transparent, backgroundColor: material.pseudoFill ?? 'rgba(255, 255, 255, 0.76)',
    content: material.content ?? '\"\"', position: 'absolute', inset: '0px',
    top: '0px', right: '0px', bottom: material.bottom ?? '0px', left: '0px',
    backdropFilter: 'blur(16px)', zIndex: '-1', opacity: material.opacity ?? '1' };
  const bar = { tagName: 'DIV', children: [], getBoundingClientRect: () => goal,
    __style: { ...transparent, backgroundColor: material.base, backdropFilter: material.filter ?? 'none', opacity: material.parentOpacity ?? '1' },
    __beforeStyle: material.before ? pseudo : undefined, __afterStyle: material.after ? pseudo : undefined };
  const { stats, drawn, canvas, install, restore } = harness({
    contentBoxes: [{ ...goal, transparent: true, radius: 0, children: [bar] }],
    composerRect: { left: 80, top: 450, width: 640, height: 110 }, reduceMotion: true,
  });
  install(); t.after(restore);
  const layer = createWhaleLayer(canvas(), normalizeConfig({ glass: true, glassStrength: 0,
    wind: false, clouds: false, ripples: false, spout: false }));
  try {
    assert.ok(drawn.some(point => point.x > goal.left && point.x < goal.left + goal.width
      && point.y > goal.top && point.y < goal.top + goal.height), 'a whale really overlaps the goal bar');
    const panes = material.expected ?? 2;
    assert.equal(stats.paneGradients / 2, panes, 'only the actual goal material and composer get glass');
    assert.ok(drawn.every(point => point.exteriorDepth === panes), 'sharp whale commands use the actual pane clip');
    assert.ok(stats.blurCopies > 0 && stats.paneImages > 0, 'recognized panels use the actual blurred-sea pipeline');
  } finally { layer.dispose(); }
});


test('dictation repaints in place and the voice swell only paints while recording', t => {
  const card = { left: 100, top: 400, width: 600, height: 120 };
  const { stats, drawn, canvas, raf, canvases, install, restore } = harness({ composerRect: card });
  install();
  t.after(restore);
  const config = normalizeConfig({ ...DEFAULTS, glass: false, composerAvoid: false, wind: false,
    clouds: false, ripples: false, spout: false, activity: false, text: '鲸' });
  const layer = createWhaleLayer(canvas(), config);
  assert.equal(stats.getContext, 1);
  const swellGlyphs = new Set(['·', '˙', "'", ';', '~']);

  // Idle and missing snapshots never create a second context or canvas.
  layer.setDictation(null);
  layer.setDictation({ schema: 1, seq: 0, phase: 'idle' }, () => 0);
  assert.equal(stats.getContext, 1);
  assert.equal(canvases.length, 1);

  // Quiet raw microphone RMS must still paint from the measured composer anchor.
  layer.setDictation({ schema: 1, seq: 1, phase: 'recording' }, () => 0.02);
  for (let frame = 0; frame < 120; frame += 1) raf.step();
  assert.ok(drawn.some(point => swellGlyphs.has(point.glyph)), 'the voice swell reaches the canvas');
  assert.equal(stats.getContext, 1, 'the swell shares the layer context');

  // Done calms the sea again; the school keeps its single layer.
  layer.setDictation({ schema: 1, seq: 2, phase: 'done' }, () => 1);
  for (let frame = 0; frame < 150; frame += 1) raf.step();
  assert.equal(drawn.some(point => swellGlyphs.has(point.glyph)), false, 'the sea is calm after done');
  assert.equal(canvases.length, 1);

  // Disposing and then receiving a late snapshot must stay harmless.
  layer.dispose();
  layer.setDictation({ schema: 1, seq: 3, phase: 'recording' }, () => 1);
});

