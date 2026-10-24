import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeConfig } from '../src/model.js';
import { createWhaleLayer } from '../src/engine.js';

// The demo-card path replaces every DOM measurement with one injected rectangle
// (see createWhaleLayer's third argument). This harness follows update.test.js's
// fake-canvas conventions and adds what only this path needs to prove: counts of
// the DOM reads a default-path measure() would make (querySelectorAll,
// getComputedStyle), the coordinates of every rounded-path start (the first
// moveTo of a pane is its own x + radius), and the fill() calls that only the
// demo card's body and text lines ever make.
function harness(options = {}) {
  const stats = { getContext: 0, measureText: 0, draws: 0, createCanvas: 0,
    mainGlyphs: 0, seaGlyphs: 0, blurCopies: 0, paneClips: 0, paneImages: 0,
    cardFills: 0, domQueries: 0, computedStyles: 0 };
  const drawn = [];
  let exteriorDepth = 0;
  const clipStack = [];
  const moves = [];
  const fills = [];
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
    clip(rule) { stats.paneClips++; if (rule === 'evenodd') exteriorDepth++; }, stroke() {},
    beginPath() {}, moveTo(x, y) { moves.push({ x, y }); }, lineTo() {}, arcTo() {}, closePath() {},
    fill() { stats.cardFills++; fills.push(this.fillStyle); },
    drawImage() { stats.paneImages++; },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  const canvases = [];
  const canvas = () => {
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
    __style: { ...defaultStyle, backgroundColor: 'rgb(255, 255, 255)',
      borderTopLeftRadius: `${box.radius ?? 18}px`, borderTopRightRadius: `${box.radius ?? 18}px`,
      borderBottomRightRadius: `${box.radius ?? 18}px`, borderBottomLeftRadius: `${box.radius ?? 18}px` },
    children: box.children || [],
    getBoundingClientRect: () => ({ left: box.left, top: box.top, width: box.width, height: box.height }),
  }));
  const scrollerElement = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: viewport.width, height: viewport.height }),
    children: contentElements,
  };
  const composerElement = options.composerRect ? {
    __style: { ...defaultStyle, backgroundColor: 'rgb(255, 255, 255)', borderTopLeftRadius: '18px' },
    children: [],
    getBoundingClientRect: () => options.composerRect,
  } : null;
  const raf = { next: 1, queue: new Map(), now: 1000,
    request(callback) { const id = this.next++; this.queue.set(id, callback); return id; },
    cancel(id) { this.queue.delete(id); },
    step(milliseconds = 1000 / 60) {
      this.now += milliseconds;
      stats.frames = (stats.frames || 0) + 1;
      const due = [...this.queue.values()];
      this.queue.clear();
      for (const callback of due) callback(this.now);
    },
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
    // One clock for the engine and the stub: update() stamps lastPaint with
    // performance.now(), which must follow the stepped rAF clock or the 30fps
    // throttle races the real process clock under load (see update.test.js).
    globalThis.performance = { now: () => raf.now };
    globalThis.document = {
      hidden: false, body: { hasAttribute: () => false },
      querySelectorAll: selector => {
        stats.domQueries++;
        if (selector === '[data-composer-card]') return composerElement ? [composerElement] : [];
        if (selector === '[data-conversation-scroll]') return [scrollerElement];
        return [];
      },
      createElement: () => {
        stats.createCanvas++;
        const offscreen = {
          font: '', fillStyle: '', globalAlpha: 1, filter: 'none', textAlign: '', textBaseline: '',
          lineWidth: 1, strokeStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
          setTransform() {}, clearRect() {}, fillRect() { stats.seaTiles = (stats.seaTiles || 0) + 1; },
          drawImage() { stats.blurCopies++; },
          fillText() { stats.seaGlyphs++; },
          save() {}, restore() {}, clip() {}, stroke() {}, fill() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {},
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
    const domStyle = element => { stats.computedStyles++; return element && element.__style ? element.__style : defaultStyle; };
    globalThis.getComputedStyle = domStyle;
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
  return { stats, drawn, moves, fills, canvas, canvases, raf, viewport, setViewport, install, restore };
}

// The demo card the settings preview injects; ratios of the canvas.
const DEMO = { x: 0.1, y: 0.52, width: 0.8, height: 0.2, radius: 14 };
const demoRectOf = (width, height) => ({ left: DEMO.x * width, top: DEMO.y * height,
  width: DEMO.width * width, height: DEMO.height * height });
const insideRect = (point, rect, grow = 0) => point.x > rect.left - grow && point.x < rect.left + rect.width + grow
  && point.y > rect.top - grow && point.y < rect.top + rect.height + grow;

test('a demo card replaces every DOM measurement while the glass pipeline runs', t => {
  // DOM hooks exist and would be found by the default path; the demo path must
  // not touch them at all.
  const cards = [{ left: 100, top: 300, width: 600, height: 120, radius: 20 }];
  const composer = { left: 100, top: 460, width: 600, height: 120 };
  const { stats, canvas, raf, install, restore } = harness({ contentBoxes: cards, composerRect: composer });
  install();
  t.after(restore);
  const layer = createWhaleLayer(canvas(), normalizeConfig(DEFAULTS), { demoCard: DEMO });
  for (let frame = 0; frame < 30; frame++) raf.step();
  assert.ok(stats.paneClips > 0, 'the demo pane is painted');
  assert.ok(stats.paneImages > 0, 'the shared blurred sea is drawn through the demo pane');
  assert.equal(stats.domQueries, 0, 'measure() must not query the DOM in demo mode');
  assert.equal(stats.computedStyles, 0, 'measure() must not read computed styles in demo mode');
  layer.dispose();
});

test('the demo glass holds sharp glyphs out of the injected card and paints its body and lines', t => {
  const { stats, drawn, fills, canvas, raf, install, restore } = harness();
  install();
  t.after(restore);
  const layer = createWhaleLayer(canvas(), normalizeConfig(DEFAULTS), { demoCard: DEMO });
  for (let frame = 0; frame < 30; frame++) raf.step();
  const card = demoRectOf(800, 600);
  assert.ok(drawn.length > 50, 'the school still paints around the card');
  assert.ok(drawn.every(point => point.exteriorDepth === 1), 'all sharp sea commands use the demo card exterior clip');
  assert.ok(drawn.some(point => !insideRect(point, card)), 'glyphs remain outside the pane');
  assert.ok(stats.seaGlyphs > 0 && stats.blurCopies > 0, 'the blurred sea is built for the pane');
  // Card body plus four text lines, in that order per frame: the body fill is
  // the near-opaque light card colour, the lines the grey one.
  assert.ok(stats.cardFills >= 5, `body + 4 lines per frame, got ${stats.cardFills}`);
  assert.ok(fills.includes('rgba(252, 253, 254, 0.96)'), 'the light-theme card body is filled');
  assert.ok(fills.includes('rgba(45, 66, 88, 0.32)'), 'the light-theme text lines are filled');
  const lastFill = fills.at(-1);
  assert.equal(lastFill, 'rgba(45, 66, 88, 0.32)', 'the text lines paint after the glass');
  layer.dispose();
});

test('avoidance mode keeps whale ink off the demo card without any glass material', t => {
  const { stats, drawn, fills, canvas, raf, install, restore } = harness();
  install();
  t.after(restore);
  // Count only glass buffers; cloud projection has its own Canvas cache.
  const config = normalizeConfig({ ...DEFAULTS, glass: false, composerAvoid: true, clouds: false });
  const layer = createWhaleLayer(canvas(), config, { demoCard: DEMO });
  for (let frame = 0; frame < 120; frame++) raf.step();
  const card = demoRectOf(800, 600);
  assert.ok(drawn.length > 0, 'the school paints');
  assert.ok(drawn.every(point => !insideRect(point, card, 8)),
    'no glyph may land on the demo card or its 8px clearance');
  assert.equal(stats.paneClips, 0, 'avoidance paints no glass');
  assert.equal(stats.createCanvas, 0, 'avoidance allocates no sea buffer');
  assert.ok(stats.cardFills >= 5, 'the demo card body and lines still show what is being avoided');
  // Control: without avoidance the very same school paints through the card
  // area, so the assertion above is about the injected obstacle, not luck.
  layer.dispose();
  const controlFills = stats.cardFills;
  const plain = createWhaleLayer(canvas(), { ...config, composerAvoid: false }, { demoCard: DEMO });
  for (let frame = 0; frame < 120; frame++) raf.step();
  assert.equal(stats.cardFills, controlFills, 'with both card options off the demo card is not drawn');
  assert.ok(drawn.some(point => insideRect(point, card)),
    'without avoidance the card region can hold whale ink again');
  plain.dispose();
});

test('the demo rectangle follows the canvas proportionally through a resize', t => {
  const { moves, canvas, raf, setViewport, install, restore } = harness();
  install();
  t.after(restore);
  const layer = createWhaleLayer(canvas(), normalizeConfig(DEFAULTS), { demoCard: DEMO });
  for (let frame = 0; frame < 12; frame++) raf.step();
  // 800x600 → card at (80, 312); the first vertex of its rounded paths is
  // (left + radius, top) for both the pane and the card body.
  assert.ok(moves.some(point => point.x === 94 && point.y === 312),
    'the pane starts at 10%/52% of the 800x600 canvas');
  const mark = moves.length;
  setViewport(1000, 800);
  for (let frame = 0; frame < 12; frame++) raf.step();
  const tail = moves.slice(mark);
  assert.ok(tail.some(point => point.x === 114 && point.y === 416),
    'the pane starts at 10%/52% of the 1000x800 canvas after the resize');
  assert.ok(!tail.some(point => point.x === 94 && point.y === 312),
    'the pre-resize pane position is gone');
  layer.dispose();
});

test('the default path still measures the DOM when no demo card is injected', t => {
  const cards = [{ left: 100, top: 300, width: 600, height: 120, radius: 20 }];
  const composer = { left: 100, top: 460, width: 600, height: 120 };
  const { stats, canvas, raf, install, restore } = harness({ contentBoxes: cards, composerRect: composer });
  install();
  t.after(restore);
  const layer = createWhaleLayer(canvas(), normalizeConfig(DEFAULTS));
  for (let frame = 0; frame < 30; frame++) raf.step();
  assert.ok(stats.domQueries > 0, 'the default measure() reads the conversation DOM');
  assert.ok(stats.computedStyles > 0, 'the default measure() reads computed styles');
  assert.ok(stats.paneClips > 0, 'the default glass pipeline still runs');
  layer.dispose();
});
