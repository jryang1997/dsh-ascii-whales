import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhaleLayer, diffWhaleConfig } from '../src/engine.js';
import { normalizeConfig } from '../src/model.js';
import { createWhaleSimulation } from '../src/simulation.js';

function events(value = {}) {
  const listeners = new Map(), listenerOptions = new Map();
  return Object.assign(value, {
    listeners, listenerOptions,
    addEventListener(type, callback, options) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); listenerOptions.set(type, options); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type, target = this, properties = {}) { for (const fn of [...(listeners.get(type) || [])]) fn({ type, target, ...properties }); },
  });
}
const defaults = { display: 'block', visibility: 'visible', opacity: '1', position: 'static',
  backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0px', borderTopLeftRadius: '0px',
  borderTopRightRadius: '0px', borderBottomLeftRadius: '0px', borderBottomRightRadius: '0px', getPropertyValue: () => '' };
function node(tag, rect, style = {}) {
  return events({ tagName: tag, rect: { ...rect }, computed: { ...defaults, ...style }, style: {}, dataset: {}, children: [],
    isConnected: true, getBoundingClientRect() { return this.rect; },
    hasAttribute(name) { return name === 'hidden' && Boolean(this.hidden); },
    contains(other) { for (let item = other; item; item = item.parentElement) if (item === this) return true; return false; } });
}
function append(parent, child) { child.parentElement = parent; parent.children.push(child); return child; }
function context() {
  const calls = [], stack = [];
  let path = [], clips = [];
  const ctx = { calls, font: '', fillStyle: '', globalAlpha: 1, filter: 'none',
    setTransform(...args) { calls.push({ op: 'setTransform', args }); },
    measureText() { return { width: 10, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }; },
    save() { stack.push(clips.slice()); }, restore() { clips = stack.pop() || []; },
    beginPath() { path = []; },
    clip(rule) { clips.push({ rule: rule || 'nonzero', path: path.map(command => ({ ...command })) }); },
    createLinearGradient() { return { addColorStop() {} }; },
  };
  for (const op of ['moveTo', 'lineTo', 'arcTo', 'closePath']) ctx[op] = (...args) => path.push({ op, args });
  for (const op of ['clearRect', 'fillRect', 'fillText', 'fill', 'stroke', 'drawImage']) {
    ctx[op] = (...args) => calls.push({ op, args, clips: clips.map(clip => ({ rule: clip.rule, path: clip.path.slice() })) });
  }
  return ctx;
}
function harness(t, options = {}) {
  const saved = new Map(), observers = [], mutations = [], pending = new Map(), timers = new Map(), buffers = [];
  const work = { geometry: 0, style: 0, ranges: 0 };
  let now = 1000, next = 1, layer;
  const bounds = { left: 0, top: 0, width: 800, height: 600 };
  const scroller = node('DIV', { left: 20, top: 10, width: 700, height: 540 });
  const body = node('BODY', bounds); append(body, scroller);
  const ink = context(), canvas = node('CANVAS', bounds);
  canvas.getContext = () => ink;
  const document = events({ body, hidden: false, queries: 0,
    querySelectorAll(selector) { this.queries++; return selector === '[data-conversation-scroll]' ? [scroller] : []; },
    createElement() { const offscreen = node('CANVAS', bounds); const ctx = context(); offscreen.getContext = () => ctx; buffers.push(offscreen); return offscreen; } });
  const reduced = events({ matches: options.reduced !== false }), transparency = events({ matches: Boolean(options.reducedTransparency) });
  const window = events({ devicePixelRatio: 1, matchMedia: query => query.includes('reduced-motion') ? reduced : transparency });
  const globals = { document, window, performance: { now: () => now }, getComputedStyle: element => { work.style++; return element.computed || defaults; },
    setTimeout: (fn, delay) => { const id = next++; timers.set(id, { fn, due: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => { const id = next++; pending.set(id, fn); return id; }, cancelAnimationFrame: id => pending.delete(id),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = new Set(); this.active = true; observers.push(this); }
      observe(element) { this.active = true; this.targets.add(element); } unobserve(element) { this.targets.delete(element); }
      disconnect() { this.targets.clear(); this.active = false; }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.active = true; this.bindings = []; mutations.push(this); }
      observe(element, settings) { this.active = true; this.bindings.push({ element, settings }); }
      disconnect() { this.bindings = []; this.active = false; }
    } };
  for (const [key, value] of Object.entries(globals)) { saved.set(key, globalThis[key]); globalThis[key] = value; }
  const config = normalizeConfig({ count: 1, species: 'blue', glass: false, composerAvoid: false,
    clouds: false, wind: false, ripples: false, spout: false, ...options.config });
  function step(milliseconds = 40) {
    now += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.fn(); }
    const due = [...pending.values()]; pending.clear(); for (const fn of due) fn(now);
  }
  const api = { document, window, scroller, body, canvas, ink, observers, mutations, pending, timers, buffers, config, work, step,
    text(count = 1) {
      const lines = Array.from({ length: count }, (_, i) => {
        const parent = append(scroller, node('P', { left: 50, top: 40 + i * 24, width: 500, height: 22 }));
        const bounds = parent.getBoundingClientRect;
        parent.getBoundingClientRect = () => { work.geometry++; return bounds.call(parent); };
        return { textContent: '正文里的鲸鱼不能挡住滚动', parentElement: parent };
      });
      document.createTreeWalker = root => { let index = 0; return { nextNode: () => root === scroller ? lines[index++] : null }; };
      document.createRange = () => { let text; return { selectNodeContents(value) { text = value; },
        getClientRects() { work.ranges++; return [text.parentElement.getBoundingClientRect()]; } }; };
    },
    media(tag = 'IMG', rect = { left: 140, top: 90, width: 260, height: 180 }, style = {}, parent = scroller) {
      return append(parent, node(tag, rect, style));
    },
    mount() { layer = createWhaleLayer(canvas, config, options.layerOptions); return layer; },
    flush() { for (let frame = 0; frame < 4; frame++) step(); },
    mutate(target, attributeName = 'class', type = 'attributes') {
      for (const observer of mutations) if (observer.active && observer.bindings.some(({ element, settings }) =>
        (element === target || settings.subtree && element.contains(target))
        && (type === 'childList' ? settings.childList : !settings.attributeFilter || settings.attributeFilter.includes(attributeName)))) {
        observer.callback([{ type, target, attributeName }]);
      }
    },
    masks() { return ink.calls.filter(call => call.op === 'clearRect' && call.clips.length); },
    dispose() { layer?.dispose(); },
  };
  t.after(() => {
    api.dispose();
    for (const [key, value] of saved) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  });
  return api;
}

for (const readingEffect of ['glow', 'blur', 'frost']) test(`${readingEffect}: scroll bursts do not repeatedly measure text or repaint the sea on the input path`, t => {
  const h = harness(t, { config: { glass: true, readingEffect, pauseOnScroll: true }, reduced: false });
  h.text(24); h.mount();
  const before = { ...h.work }, paints = h.ink.calls.length;
  for (let i = 0; i < 12; i++) { h.document.dispatch('scroll', h.scroller); h.step(16); }
  const delta = Object.fromEntries(Object.keys(before).map(key => [key, h.work[key] - before[key]]));
  t.diagnostic(`scroll work over 12 frames: ${JSON.stringify(delta)}, canvas commands: ${h.ink.calls.length - paints}`);
  assert.deepEqual(delta, { geometry: 0, style: 0, ranges: 0 }, 'scrolling must yield the main thread instead of rebuilding text masks');
  assert.equal(h.ink.calls.length, paints, 'no whale or blur work may compete with scrolling');
  assert.equal(h.canvas.style.opacity, '0', 'a stale mask must not trail behind the scrolling text');
  h.flush();
  assert.notEqual(h.canvas.style.opacity, '0', 'the sea returns only after remeasuring the final scroll position');
  assert.ok(h.work.ranges > before.ranges);
});

for (const glass of [false, true]) test(`none: text work stays disabled while content glass=${glass} and media exclusion keep working`, t => {
  const h = harness(t, { config: { glass, readingEffect: 'none' } });
  h.text(3);
  h.media('DIV', { left: 80, top: 60, width: 580, height: 360 },
    { backgroundColor: 'rgb(255, 255, 255)', ...rounded(18) });
  h.media();
  h.mount();
  assert.equal(h.work.ranges, 0, 'none never measures real text');
  assert.equal(h.buffers.length, glass ? 2 : 0, 'only the independent shared glass sea may allocate buffers');
  assert.equal(h.ink.calls.filter(call => call.op === 'drawImage').length, glass ? 1 : 0,
    'none never draws a text mask or local replacement');
  assert.equal(h.masks().length, 1, 'media still clears the finished overlay');
  h.mutate(h.scroller, undefined, 'childList'); h.flush();
  assert.equal(h.work.ranges, 0, 'content invalidation cannot re-enable text measurements');
  assert.equal(h.masks().length, 2, 'media is refreshed independently');
});

for (const effect of ['glow', 'blur', 'frost']) test(`none to ${effect} and back remeasures immediately without stale text painting`, t => {
  const h = harness(t, { config: { readingEffect: 'none' } });
  h.text(3); const layer = h.mount();
  assert.equal(h.work.ranges, 0);
  assert.equal(h.buffers.length, 0);
  layer.update({ ...h.config, readingEffect: effect });
  assert.equal(h.work.ranges, 3, 'reduced motion receives the enabled mask within update, without waiting for a frame');
  assert.ok(h.ink.calls.some(call => call.op === 'drawImage'));
  let mark = h.ink.calls.length;
  layer.update({ ...h.config, readingEffect: 'none' });
  assert.ok(!h.ink.calls.slice(mark).some(call => call.op === 'drawImage'), 'none paints neither a mask nor a text replacement');
  const before = h.work.ranges, buffers = h.buffers.length;
  h.scroller.children[0].rect.top += 80;
  h.mutate(h.scroller, undefined, 'childList'); h.flush();
  assert.equal(h.work.ranges, before);
  mark = h.ink.calls.length;
  layer.update({ ...h.config, readingEffect: effect });
  assert.equal(h.work.ranges, before + 3, 'the current text position is remeasured on re-enable');
  assert.ok(h.buffers.length > buffers, 'the mask was released while disabled');
  assert.ok(h.ink.calls.slice(mark).some(call => call.op === 'drawImage'));
});

test('disabling text during scrolling resumes with media exclusion and no text measurements', t => {
  const h = harness(t, { config: { pauseOnScroll: true } });
  h.text(3); h.media(); const layer = h.mount();
  const before = h.work.ranges;
  h.document.dispatch('scroll', h.scroller);
  layer.update({ ...h.config, readingEffect: 'none' });
  const mark = h.ink.calls.length;
  h.flush();
  assert.equal(h.work.ranges, before);
  assert.ok(!h.ink.calls.slice(mark).some(call => call.op === 'drawImage'));
  assert.equal(clearsIn(h.ink.calls.slice(mark)).length, 1);
});

test('none toggles retain the same whales, motion objects and simulation clock', () => {
  const config = normalizeConfig({ count: 1 });
  const simulation = createWhaleSimulation(config, { seed: 42 });
  simulation.resize(800, 600); simulation.advance(0.1);
  const scene = simulation.scene, whale = scene.whales[0], motion = whale._motion;
  const before = { time: scene.time, x: whale.x, y: whale.y, age: motion.age };
  for (const readingEffect of ['none', 'glow', 'none', 'blur', 'none', 'frost']) {
    const next = { ...config, readingEffect };
    assert.equal(diffWhaleConfig(config, next).scene, false);
    assert.equal(simulation.update(next), false);
    assert.equal(simulation.scene, scene);
    assert.equal(scene.whales[0], whale);
    assert.equal(whale._motion, motion);
    assert.deepEqual({ time: scene.time, x: whale.x, y: whale.y, age: motion.age }, before);
  }
  simulation.dispose();
});

test('none in the demo retains card glass and text without allocating a text mask', t => {
  const h = harness(t, { config: { glass: true, readingEffect: 'none' },
    layerOptions: { demoCard: { x: 0.1, y: 0.5, width: 0.8, height: 0.2, radius: 12 } } });
  const layer = h.mount();
  assert.equal(h.document.queries, 0);
  assert.equal(h.buffers.length, 2, 'only the card glass sea buffers exist');
  assert.equal(h.ink.calls.filter(call => call.op === 'drawImage').length, 1, 'the card glass is painted once');
  assert.equal(h.ink.calls.filter(call => call.op === 'fill').length, 5, 'the card body and four sample text lines remain visible');
  layer.update({ ...h.config, readingEffect: 'frost' });
  assert.ok(h.buffers.length > 2, 'enabling text protection prepares the preview mask immediately');
});

test('static text geometry is reused across ordinary animation frames', t => {
  const h = harness(t, { config: { glass: true }, reduced: false });
  h.text(24); h.mount();
  const before = h.work.ranges;
  for (let i = 0; i < 12; i++) h.step(40);
  assert.equal(h.work.ranges, before, 'a moving whale does not change DOM text layout');
});

test('passive wheel input hides immediately, ignores unrelated scrolling and releases suspended work on disposal', t => {
  const h = harness(t, { config: { glass: true, pauseOnScroll: true } });
  h.text(24); const layer = h.mount();
  const before = { ...h.work }, paints = h.ink.calls.length;
  assert.deepEqual(h.document.listenerOptions.get('wheel'), { capture: true, passive: true });
  h.document.dispatch('wheel', h.scroller, { ctrlKey: true });
  assert.notEqual(h.canvas.style.opacity, '0', 'browser zoom is not a reading scroll');
  const otherSidebar = h.media('DIV', { left: -200, top: 0, width: 200, height: 600 }, {}, h.body);
  h.document.dispatch('scroll', otherSidebar);
  assert.notEqual(h.canvas.style.opacity, '0', 'scrolling the left sidebar must not interrupt the reading sea');
  h.document.dispatch('wheel', h.scroller);
  assert.equal(h.canvas.style.opacity, '0', 'hide in the wheel handler before the browser moves the text');
  assert.deepEqual(h.work, before, 'even reduced motion performs no synchronous text measurement');
  h.step(100);
  h.document.dispatch('scroll', h.scroller);
  h.mutate(h.scroller, undefined, 'childList');
  layer.setActivity({ scope: 'scroll-test', entities: [] });
  h.step(100);
  assert.equal(h.canvas.style.opacity, '0', 'the quiet interval starts from the last scroll event');
  assert.equal(h.ink.calls.length, paints, 'content and status updates cannot force a hidden redraw');
  assert.deepEqual(h.work, before);
  assert.equal(h.timers.size, 1, 'an input burst has just one pending resume');
  h.dispose();
  assert.equal(h.timers.size, 0);
  assert.equal(h.pending.size, 0);
  assert.notEqual(h.canvas.style.opacity, '0');
  for (const event of ['wheel', 'scroll', 'touchmove']) assert.equal(h.document.listeners.get(event).size, 0);
  h.step(200);
  assert.equal(h.ink.calls.length, paints, 'a disposed scroll timer never revives the layer');
});

test('the scroll pause is off by default: the school keeps swimming while text moves', t => {
  const h = harness(t, { config: { glass: true, readingEffect: 'frost' }, reduced: false });
  h.text(24); const layer = h.mount();
  const before = { ...h.work }, paints = h.ink.calls.length;
  for (let i = 0; i < 6; i++) { h.document.dispatch('scroll', h.scroller); h.step(40); }
  assert.notEqual(h.canvas.style.opacity, '0', 'a scroll burst must not hide the decorative layer');
  assert.equal(h.timers.size, 0, 'no resume timer is armed while the pause is off');
  assert.ok(h.ink.calls.length > paints, 'the animation loop keeps drawing through scrolling');
  assert.ok(h.work.geometry + h.work.ranges > 0, 'the moving text still refreshes its geometry on the measure budget');
  const measured = h.work.ranges;
  for (let i = 0; i < 4; i++) { h.document.dispatch('scroll', h.scroller); h.step(10); }
  // 24 text lines per scan: four events over 40ms may cost at most one scan,
  // because the refresh rides the 120ms measure budget instead of each event.
  assert.ok(h.work.ranges - measured <= 24, `scroll events must not re-scan per event: ${h.work.ranges - measured}`);
  t.diagnostic(`default-off scroll burst, 10 frames of 40ms: ${JSON.stringify(h.work)} after ${JSON.stringify(before)}`);
  // Turning the guard on takes effect from the next burst without remounting.
  layer.update({ ...h.config, pauseOnScroll: true });
  h.document.dispatch('scroll', h.scroller);
  assert.equal(h.canvas.style.opacity, '0', 'the enabled guard hides the layer immediately');
  assert.equal(h.timers.size, 1, 'the enabled guard schedules one quiet-interval resume');
});

test('turning the scroll pause off mid-burst restores the layer and its pending work', t => {
  const h = harness(t, { config: { glass: true, pauseOnScroll: true }, reduced: false });
  h.text(24); const layer = h.mount();
  h.document.dispatch('scroll', h.scroller);
  assert.equal(h.canvas.style.opacity, '0');
  assert.equal(h.timers.size, 1);
  const paints = h.ink.calls.length;
  layer.update({ ...h.config, pauseOnScroll: false });
  assert.notEqual(h.canvas.style.opacity, '0', 'switching off must never leave the sea hidden behind the text');
  assert.equal(h.timers.size, 0, 'the abandoned quiet interval cannot repaint later');
  assert.ok(h.ink.calls.length > paints, 'the switch itself redraws the current position');
  h.document.dispatch('scroll', h.scroller);
  assert.notEqual(h.canvas.style.opacity, '0', 'scrolling after the switch keeps drawing');
  h.step(400);
  assert.notEqual(h.canvas.style.opacity, '0');
});

test('a static reduced-motion sea still follows the text when the scroll pause is off', t => {
  const h = harness(t, { config: { glass: true, readingEffect: 'frost' } });
  h.text(3); h.mount();
  const before = h.work.ranges;
  h.scroller.children.forEach(child => { child.rect.top -= 60; });
  h.document.dispatch('scroll', h.scroller);
  assert.notEqual(h.canvas.style.opacity, '0', 'reduced motion does not imply the hidden layer');
  h.step(40);
  assert.ok(h.work.ranges > before, 'the stopped loop still schedules one coalesced redraw');
  h.step(40);
  assert.equal(h.timers.size, 0, 'the disabled guard armed no resume timer');
});

test('a transparent-background GIF fully holds the sea out even when glass and avoidance are disabled', t => {
  const h = harness(t);
  h.media();
  h.mount();
  assert.ok(h.ink.calls.some(call => call.op === 'fillText'), 'the layer paints an actual sea');
  assert.equal(h.masks().length, 1, 'the visible GIF region must clear the completed sea overlay');
});

test('a GIF load refreshes the foreground geometry while reduced motion has stopped the animation loop', t => {
  const h = harness(t), image = h.media('IMG', { left: 140, top: 90, width: 0, height: 0 });
  h.mount();
  assert.equal(h.masks().length, 0);
  image.rect = { left: 140, top: 90, width: 260, height: 180 };
  h.scroller.dispatch('load', image);
  h.flush();
  assert.equal(h.masks().length, 1, 'an image becoming ready redraws a static sea with the new exclusion');
});

const rounded = radius => Object.fromEntries(['borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius'].map(key => [key, `${radius}px`]));
const clearsIn = calls => calls.filter(call => call.op === 'clearRect' && call.clips.length);
const starts = mask => mask.clips.at(-1).path.filter(command => command.op === 'moveTo').map(command => command.args);

test('overlapping rounded media clears a union after glass and every other sea draw', t => {
  const h = harness(t, { config: { glass: true } });
  const card = h.media('DIV', { left: 80, top: 60, width: 580, height: 360 },
    { backgroundColor: 'rgb(255, 255, 255)', ...rounded(18) });
  h.media('IMG', { left: 140, top: 90, width: 260, height: 180 }, rounded(12), card);
  h.media('VIDEO', { left: 220, top: 140, width: 260, height: 180 }, rounded(20), card);
  h.mount();
  const [mask] = h.masks();
  assert.equal(h.masks().length, 1, 'overlap does not require multiple destructive clears');
  assert.deepEqual(starts(mask), [[152, 90], [240, 140]]);
  assert.ok(mask.clips.every(clip => clip.rule === 'nonzero'), 'overlap stays erased rather than becoming an even-odd hole');
  assert.equal(mask.clips.at(-1).path.filter(command => command.op === 'closePath').length, 2);
  const painted = h.ink.calls.filter(call => ['drawImage', 'fillRect', 'fillText', 'fill', 'clearRect'].includes(call.op));
  assert.ok(painted.some(call => call.op === 'drawImage'), 'the real glass pass actually ran');
  assert.equal(painted.at(-1), mask, 'nothing repaints ocean ink after the media is revealed');
});

test('reduced transparency still excludes images and every supported media tag ignores its transparent background', t => {
  const h = harness(t, { config: { glass: true }, reducedTransparency: true });
  for (const [i, tag] of ['IMG', 'VIDEO', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS'].entries()) {
    h.media(tag, { left: 50 + i * 95, top: 180, width: 90, height: 100 });
  }
  append(h.scroller, h.canvas);
  h.mount();
  assert.equal(starts(h.masks()[0]).length, 6, 'all six media tags are excluded while the overlay Canvas is ignored');
  assert.ok(!h.ink.calls.some(call => call.op === 'drawImage'), 'clear material mode adds no glass buffer');
});

test('the mask respects the scroller viewport and ignores hidden, detached and offscreen media', t => {
  const h = harness(t);
  h.media('IMG', { left: -20, top: -10, width: 200, height: 180 });
  h.media('IMG', { left: 900, top: 90, width: 100, height: 100 });
  h.media('IMG').hidden = true;
  h.media('IMG', undefined, { display: 'none' });
  h.media('IMG', undefined, { visibility: 'hidden' });
  h.media('IMG').isConnected = false;
  const hidden = h.media('DIV', { left: 40, top: 50, width: 400, height: 300 }, { opacity: '0' });
  h.media('IMG', undefined, {}, hidden);
  h.mount();
  assert.equal(starts(h.masks()[0]).length, 1);
  const boundary = h.masks()[0].clips[0].path;
  assert.deepEqual(boundary[0], { op: 'moveTo', args: [20, 10] });
  assert.ok(boundary.some(command => command.op === 'lineTo' && command.args[0] === 720));
  assert.deepEqual(starts(h.masks()[0]), [[-20, -10]], 'clipping does not invent rounded corners at the scroller edge');
});

test('scroll, hidden/show transitions, leaving the viewport and media removal restore the newly uncovered sea', t => {
  const h = harness(t), image = h.media();
  h.mount();
  let mark = h.ink.calls.length;
  image.rect.top = 150;
  h.document.dispatch('scroll', h.scroller);
  h.flush();
  assert.deepEqual(starts(clearsIn(h.ink.calls.slice(mark))[0]), [[140, 150]]);
  mark = h.ink.calls.length;
  image.hidden = true;
  h.mutate(image, 'hidden'); h.flush();
  assert.equal(clearsIn(h.ink.calls.slice(mark)).length, 0);
  assert.ok(h.ink.calls.slice(mark).some(call => call.op === 'fillText'), 'the frame repaints sea where the image was');
  mark = h.ink.calls.length;
  image.hidden = false;
  h.mutate(image, 'hidden'); h.flush();
  assert.equal(clearsIn(h.ink.calls.slice(mark)).length, 1);
  mark = h.ink.calls.length;
  image.rect.top = 800;
  h.document.dispatch('scroll', h.scroller); h.flush();
  assert.equal(clearsIn(h.ink.calls.slice(mark)).length, 0);
  image.rect.top = 150;
  h.document.dispatch('scroll', h.scroller); h.flush();
  mark = h.ink.calls.length;
  h.scroller.children.splice(h.scroller.children.indexOf(image), 1); image.isConnected = false;
  h.mutate(h.scroller, undefined, 'childList'); h.flush();
  assert.equal(clearsIn(h.ink.calls.slice(mark)).length, 0);
});

test('media resize and document visibility refresh a static frame, and disposal cancels all media observers and listeners', t => {
  const h = harness(t), image = h.media();
  h.mount();
  const mediaResize = h.observers.find(observer => observer.targets.has(image));
  assert.ok(mediaResize, 'the visible media geometry is observed');
  let mark = h.ink.calls.length;
  image.rect.width = 350;
  mediaResize.callback([{ target: image }]); h.flush();
  const path = clearsIn(h.ink.calls.slice(mark))[0].clips.at(-1).path;
  assert.ok(path.some(command => command.op === 'lineTo' && command.args[0] === 490));
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  image.rect.left = 200;
  h.scroller.dispatch('loadedmetadata', image);
  assert.equal(h.pending.size, 0, 'a hidden document schedules no mask redraw');
  mark = h.ink.calls.length;
  h.document.hidden = false;
  h.document.dispatch('visibilitychange'); h.flush();
  assert.deepEqual(starts(clearsIn(h.ink.calls.slice(mark))[0]), [[200, 90]]);
  h.scroller.dispatch('load', image);
  assert.ok(h.pending.size > 0);
  h.dispose();
  assert.equal(h.pending.size, 0);
  assert.ok(h.observers.every(observer => !observer.active));
  assert.ok(h.mutations.every(observer => !observer.active));
  for (const type of ['load', 'loadedmetadata', 'error']) assert.equal(h.scroller.listeners.get(type)?.size ?? 0, 0);
  mark = h.ink.calls.length;
  h.scroller.dispatch('load', image); h.flush();
  assert.equal(h.ink.calls.length, mark, 'disposed foreground listeners cannot repaint');
});

test('demo previews never scan global conversation media and the media geometry budget is independent of glass candidates', t => {
  const h = harness(t, { layerOptions: { demoCard: { x: 0.1, y: 0.5, width: 0.8, height: 0.2, radius: 12 } } });
  h.media();
  h.mount();
  assert.equal(h.document.queries, 0);
  assert.equal(h.masks().length, 0);
});

test('right sidebar glass uses the actual engine and embedded pages stay above the ocean', t => {
  const h = harness(t, { config: { glass: true } });
  const track = h.media('DIV', { left: 800, top: 0, width: 0, height: 600 }, {}, h.body);
  const panel = h.media('DIV', { left: 560, top: 0, width: 240, height: 600 }, rounded(18), track);
  h.media('IFRAME', { left: 580, top: 100, width: 200, height: 460 }, {}, panel);
  const query = h.document.querySelectorAll.bind(h.document);
  h.document.querySelectorAll = selector => selector === '[data-rightbar-col]' ? [track] : query(selector);
  h.mount();
  assert.ok(h.ink.calls.some(call => call.op === 'drawImage' && call.clips.some(clip =>
    clip.path.some(command => command.op === 'moveTo' && command.args[0] === 578 && command.args[1] === 0))),
  'the shared blurred sea is clipped to the actual right sidebar panel');
  assert.deepEqual(starts(h.masks().at(-1)), [[580, 100]], 'embedded pages clear the completed glass as well as sharp whales');
  assert.equal(h.ink.calls.at(-1).op, 'clearRect', 'no whale effect is painted over sidebar media afterward');
});

test('a late media node survives the glass style budget and a crowded media list has its own bounded mask', t => {
  const h = harness(t, { config: { glass: true } });
  for (let i = 0; i < 650; i++) h.media('DIV', { left: 80, top: 60, width: 580, height: 360 },
    { backgroundColor: 'rgb(255, 255, 255)', ...rounded(18) });
  h.media();
  h.mount();
  assert.equal(starts(h.masks()[0]).length, 1);
  for (let i = 0; i < 200; i++) h.media('IMG', { left: 100, top: 90, width: 200, height: 100 });
  const mark = h.ink.calls.length;
  h.mutate(h.scroller, undefined, 'childList'); h.flush();
  assert.equal(starts(clearsIn(h.ink.calls.slice(mark))[0]).length, 128);
});
