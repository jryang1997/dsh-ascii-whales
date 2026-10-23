import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhaleLayer } from '../src/engine.js';
import { normalizeConfig } from '../src/model.js';

function events(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    listeners,
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type, target = this) { for (const fn of [...(listeners.get(type) || [])]) fn({ type, target }); },
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
  const saved = new Map(), observers = [], mutations = [], pending = new Map();
  let now = 1000, next = 1, layer;
  const bounds = { left: 0, top: 0, width: 800, height: 600 };
  const scroller = node('DIV', { left: 20, top: 10, width: 700, height: 540 });
  const body = node('BODY', bounds); append(body, scroller);
  const ink = context(), canvas = node('CANVAS', bounds);
  canvas.getContext = () => ink;
  const document = events({ body, hidden: false, queries: 0,
    querySelectorAll(selector) { this.queries++; return selector === '[data-conversation-scroll]' ? [scroller] : []; },
    createElement() { const offscreen = node('CANVAS', bounds); const ctx = context(); offscreen.getContext = () => ctx; return offscreen; } });
  const reduced = events({ matches: options.reduced !== false }), transparency = events({ matches: Boolean(options.reducedTransparency) });
  const window = events({ devicePixelRatio: 1, matchMedia: query => query.includes('reduced-motion') ? reduced : transparency });
  const globals = { document, window, performance: { now: () => now }, getComputedStyle: element => element.computed || defaults,
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
  const api = { document, window, scroller, body, canvas, ink, observers, mutations, pending,
    media(tag = 'IMG', rect = { left: 140, top: 90, width: 260, height: 180 }, style = {}, parent = scroller) {
      return append(parent, node(tag, rect, style));
    },
    mount() { layer = createWhaleLayer(canvas, config, options.layerOptions); return layer; },
    flush() { for (let frame = 0; frame < 4; frame++) { now += 40; const due = [...pending.values()]; pending.clear(); for (const fn of due) fn(now); } },
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
