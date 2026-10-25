import test from 'node:test';
import assert from 'node:assert/strict';
import { collectRightbarSurfaces, measureReadingText, createReadingProtection, readingEffectTone } from '../src/reading-protection.js';
import { createReadingLayout } from '../src/reading-layout.js';

const canvas = { left: 280, top: 40, width: 1000, height: 800 };
const style = { display: 'block', visibility: 'visible', opacity: '1', overflow: 'visible', borderRadius: '0px' };
const rect = (left, top, width, height) => ({ left, top, width, height });
function element(bounds, computed = {}) {
  return { children: [], texts: [], inputs: [], computed: { ...style, ...computed }, isConnected: true,
    getBoundingClientRect: () => bounds, querySelectorAll() { return this.inputs; }, closest() { return this.decorative; } };
}
function text(parent, lines, value = '需要清晰阅读的文字') {
  const node = { textContent: value, parentElement: parent, lines };
  parent.texts.push(node); return node;
}
function host(t, rightbars = []) {
  const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle };
  const masks = [];
  const ink = () => {
    const calls = [], stack = [];
    const target = { calls, globalCompositeOperation: 'source-over', globalAlpha: 1,
      save() { stack.push([this.globalCompositeOperation, this.globalAlpha]); },
      restore() { [this.globalCompositeOperation, this.globalAlpha] = stack.pop(); },
      drawImage(...args) { calls.push({ op: 'drawImage', composite: this.globalCompositeOperation, alpha: this.globalAlpha, args }); } };
    for (const op of ['clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'arcTo', 'closePath', 'clip', 'fill']) {
      target[op] = (...args) => calls.push({ op, args });
    }
    return target;
  };
  globalThis.document = {
    querySelectorAll: selector => selector === '[data-rightbar-col]' ? rightbars : [],
    createTreeWalker(root) { let index = 0; return { nextNode: () => root.texts[index++] }; },
    createRange() { let node; return { selectNodeContents(value) { node = value; }, getClientRects: () => node.lines }; },
    createElement() { const context = ink(), mask = { getContext: () => context }; masks.push(mask); return mask; },
  };
  globalThis.getComputedStyle = node => node.computed;
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  });
  return { masks, ink };
}

test('transparent prose protects actual text lines in canvas coordinates, clipped to its scroller', t => {
  host(t);
  const root = element(rect(400, 100, 600, 300));
  text(root, [rect(410, 110, 380, 20), rect(410, 390, 280, 20)]);
  const [group] = measureReadingText([root], canvas);
  assert.deepEqual(group.clip, { x: 120, y: 60, width: 600, height: 300, radius: 0 });
  assert.deepEqual(group.regions, [
    { x: 127, y: 68, width: 386, height: 24, radius: 3 },
    { x: 127, y: 348, width: 286, height: 12, radius: 3 },
  ]);
  assert.equal(measureReadingText([root, root], canvas).length, 1, 'overlapping root adapters do not duplicate the same root');
});

test('nested scrolling, hidden ancestors and decorative labels cannot punch unrelated holes', t => {
  host(t);
  const root = element(rect(300, 60, 800, 600));
  const code = element(rect(420, 200, 300, 70), { overflow: 'auto' }); code.parentElement = root;
  const hidden = element(rect(420, 300, 300, 70), { opacity: '0' }); hidden.parentElement = root;
  const label = element(rect(420, 400, 300, 70)); label.parentElement = root; label.decorative = true;
  root.texts = [text(code, [rect(430, 180, 200, 20), rect(430, 220, 200, 20)]),
    text(hidden, [rect(430, 320, 200, 20)]), text(label, [rect(430, 420, 200, 20)])];
  const [group] = measureReadingText([root], canvas);
  assert.equal(group.regions.length, 2);
  assert.deepEqual(group.regions[0], { x: 147, y: 160, width: 206, height: 2, radius: 3 });
  assert.deepEqual(group.regions[1], { x: 147, y: 178, width: 206, height: 24, radius: 3 });
});

test('native input values and placeholders stay protected without DOM text nodes', t => {
  host(t);
  const root = element(rect(400, 600, 600, 180));
  root.inputs = [element(rect(430, 630, 500, 90)), element(rect(430, 730, 500, 30), { visibility: 'hidden' })];
  assert.deepEqual(measureReadingText([root], canvas)[0].regions,
    [{ x: 150, y: 590, width: 500, height: 90, radius: 4 }]);
});

test('a zero-width rightbar track still finds its visible absolute panel and ignores closed panels', t => {
  const track = element(rect(1280, 40, 0, 800));
  const hidden = element(rect(920, 40, 360, 800), { visibility: 'hidden' });
  const offscreen = element(rect(1280, 40, 360, 800));
  const panel = element(rect(920, 40, 360, 800), { borderTopLeftRadius: '18px' });
  track.children = [hidden, offscreen, panel];
  host(t, [track]);
  const [surface] = collectRightbarSurfaces(canvas);
  assert.equal(surface.element, panel);
  assert.equal(surface.radius, 18);
  const layout = createReadingLayout({ canvas, sidebars: [surface] }, { glass: true, glassStrength: 0.55 });
  assert.equal(layout.contentPanes.length, 0);
  assert.deepEqual(layout.sidebarPanes, layout.panes);
  assert.equal(layout.sidebarPanes[0].x, 640);
  assert.ok(layout.sidebarTone.mist < layout.tone.mist, 'sidebar whales are quieter than card whales');
  assert.ok(layout.sidebarTone.blur > layout.tone.blur, 'sidebar glass diffuses the whale more');
  const reduced = createReadingLayout({ canvas, sidebars: [surface] }, { glass: true }, { reducedTransparency: true });
  assert.equal(reduced.sidebarPanes.length, 1);
  assert.equal(reduced.sidebarTone.mode, 'clear', 'reduced transparency retains exclusion without drawing glass');
});

test('closed native sidebar wrappers do not frost the conversation and keep floating panes independent', t => {
  const track = element(rect(1280, 40, 0, 800));
  const panel = element(rect(920, 40, 360, 800));
  const floating = element(rect(700, 180, 300, 240));
  panel.hasAttribute = name => name === 'data-sidebar-right-panel';
  panel.querySelectorAll = selector => selector === '[data-dockkit-float]' ? [floating] : [];
  track.children = [panel];
  host(t, [track]);
  assert.deepEqual(collectRightbarSurfaces(canvas).map(surface => surface.element), [floating]);
  panel.getAttribute = name => name === 'aria-hidden' ? 'true' : null;
  assert.deepEqual(collectRightbarSurfaces(canvas), []);
});

test('the text mask is cached, erases the finished overlay and releases all drawing state', t => {
  const { masks, ink } = host(t);
  const root = element(rect(400, 100, 600, 300));
  const node = text(root, [rect(410, 110, 380, 20)]);
  const protection = createReadingProtection();
  protection.measure([root], canvas);
  const calls = masks[0].getContext().calls.length;
  protection.measure([root], canvas);
  assert.equal(masks.length, 1);
  assert.equal(masks[0].getContext().calls.length, calls, 'unchanged layout does not repaint the mask');
  const target = ink(); protection.paint(target, 1000, 800);
  assert.equal(target.calls[0].composite, 'destination-out');
  assert.equal(target.globalCompositeOperation, 'source-over');
  assert.equal(target.globalAlpha, 1);
  node.lines = [rect(410, 150, 380, 20)];
  protection.measure([root], canvas);
  assert.ok(masks[0].getContext().calls.length > calls, 'scrolling invalidates the geometry');
  root.texts = [];
  protection.measure([root], canvas);
  const count = target.calls.length; protection.paint(target, 1000, 800);
  assert.equal(target.calls.length, count, 'removing text restores open water');
  protection.dispose(); protection.paint(target, 1000, 800);
  assert.equal(target.calls.length, count);
});

for (const effect of ['blur', 'frost']) test(`${effect} replaces the mask with the continuous ocean, without per-line filtering`, t => {
  const { masks, ink } = host(t);
  const root = element(rect(400, 100, 600, 300));
  text(root, [rect(410, 110, 380, 20), rect(410, 136, 280, 20)]);
  const protection = createReadingProtection();
  protection.measure([root], canvas, effect);
  const maskCommands = masks[0].getContext().calls.length;
  const target = ink(), source = {}, sourceRect = [4, 4, 200, 160];
  const material = readingEffectTone(effect);
  protection.paint(target, 1000, 800, { material, source, sourceRect });
  assert.equal(target.calls.length, 2, 'erase the sharp material, then replace it with the intact silhouette');
  assert.equal(target.calls[0].composite, 'destination-out');
  assert.equal(target.calls[1].composite, 'source-over');
  const replacement = masks[1].getContext();
  const draws = replacement.calls.filter(call => call.op === 'drawImage');
  assert.equal(draws.length, 2, 'one shared sea image and one shared mask, independent of line count');
  assert.equal(draws[0].args[0], source);
  assert.deepEqual(draws[0].args.slice(1, 5), sourceRect);
  assert.equal(draws[0].alpha, material.mist);
  assert.equal(draws[1].composite, 'destination-in');
  assert.equal(draws[1].args[0], masks[0]);
  assert.equal(target.globalCompositeOperation, 'source-over');
  assert.equal(target.globalAlpha, 1);
  const surfaceFills = replacement.calls.filter(call => call.op === 'fillRect');
  assert.equal(surfaceFills.length, effect === 'frost' ? 1 : 0, 'only frosted glass adds a subtle tint');
  protection.paint(target, 1000, 800, { material, source, sourceRect });
  assert.equal(masks.length, 2, 'buffers are reused across frames');
  assert.equal(masks[0].getContext().calls.length, maskCommands, 'painting does not repeat text geometry or mask work');
  protection.dispose();
});

for (const method of ['measure', 'setRegions']) test(`${method}: none drops cached masks and replacement buffers before inspecting geometry`, t => {
  const { masks, ink } = host(t);
  const root = element(rect(400, 100, 600, 300));
  text(root, [rect(410, 110, 380, 20)]);
  const protection = createReadingProtection(), target = ink();
  const options = { material: readingEffectTone('frost'), source: {}, sourceRect: [0, 0, 200, 160] };
  protection.measure([root], canvas, 'frost');
  protection.paint(target, 1000, 800, options);
  assert.equal(masks.length, 2, 'the enabled effect allocated a mask and replacement');
  const count = target.calls.length;
  protection.paint(target, 1000, 800, { ...options, material: readingEffectTone('none') });
  assert.equal(target.calls.length, count, 'none never erases or replaces even an existing mask');
  protection[method](null, null, 'none');
  assert.equal(protection.active, false);
  protection.paint(target, 1000, 800, options);
  assert.equal(target.calls.length, count, 'disabled protection cannot reuse the old mask');
  assert.equal(masks.length, 2, 'disabling allocates no canvas');
  protection.measure([root], canvas, 'frost');
  protection.paint(target, 1000, 800, options);
  assert.equal(masks.length, 4, 're-enabling the same geometry allocates fresh mask and replacement buffers');
  assert.equal(protection.active, true);
  assert.equal(target.calls.at(-2).args[0], masks[2]);
  assert.equal(target.calls.at(-1).args[0], masks[3]);
});

test('none skips native text traversal and canvas allocation from the initial state', t => {
  const { masks, ink } = host(t);
  document.createTreeWalker = document.createRange = () => { throw new Error('disabled text must not be measured'); };
  const protection = createReadingProtection(), target = ink();
  protection.measure([element(rect(400, 100, 600, 300))], canvas, 'none');
  protection.paint(target, 1000, 800, { material: readingEffectTone('none'), underlay: '#fff' });
  assert.equal(protection.active, false);
  assert.equal(masks.length, 0);
  assert.equal(target.calls.length, 0);
});

test('reading effects default to frosted glass, retain explicit choices and honor reduced transparency', () => {
  assert.equal(readingEffectTone().mode, 'frost');
  assert.deepEqual(readingEffectTone('none'), { mode: 'none' });
  assert.deepEqual(readingEffectTone('none', 0.55, { reducedTransparency: true }), { mode: 'none' });
  assert.equal(readingEffectTone('glow').mode, 'glow');
  assert.equal(readingEffectTone('blur').mode, 'blur');
  assert.ok(readingEffectTone('frost').blur > readingEffectTone('blur').blur);
  for (const mode of ['glow', 'blur', 'frost']) {
    assert.equal(readingEffectTone(mode, 0.55, { reducedTransparency: true }).mode, 'glow');
  }
});

test('blur and frost retain at least 4.5:1 text contrast even over fully opaque extreme sea colors', () => {
  const over = (base, color, alpha) => base.map((value, i) => value * (1 - alpha) + color[i] * alpha);
  const luminance = color => color.map(value => {
    const s = value / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const colors = [0, 255].flatMap(r => [0, 255].flatMap(g => [0, 255].map(b => [r, g, b])));
  for (const mode of ['blur', 'frost']) for (const dark of [false, true]) for (const strength of [0, 0.55, 1]) {
    const tone = readingEffectTone(mode, strength, { dark }), tint = tone.tint.split(',').map(Number);
    for (const color of colors) {
      const text = dark ? [242, 243, 245] : [15, 15, 15], page = dark ? [21, 21, 23] : [255, 255, 255];
      const composite = base => over(over(base, color, tone.mist), tint, tone.veil);
      const values = [luminance(composite(text)), luminance(composite(page))].sort((a, b) => b - a);
      const contrast = (values[0] + 0.05) / (values[1] + 0.05);
      assert.ok(contrast >= 4.5, `${mode}, dark=${dark}, strength=${strength}, color=${color}: ${contrast}`);
    }
  }
});

test('a pathological number of text lines falls back to protecting the whole visible root', t => {
  host(t);
  const root = element(rect(400, 100, 600, 300));
  text(root, Array.from({ length: 1300 }, () => rect(410, 110, 380, 20)));
  const [group] = measureReadingText([root], canvas);
  assert.deepEqual(group.regions, [group.clip]);
});

test('older hosts without DOM text ranges keep their existing renderer', t => {
  host(t); delete document.createTreeWalker;
  assert.deepEqual(measureReadingText([element(rect(400, 100, 600, 300))], canvas), []);
});
