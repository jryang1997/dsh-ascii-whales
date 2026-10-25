import { runInNewContext } from 'node:vm';

// These are host adapters, not a renderer. Only the two shipped entry scripts
// create scenes, simulate whales, choose glyphs and issue drawing commands.
// Command-stream equality cannot establish raster/font or DSH visual equality.
const copy = value => JSON.parse(JSON.stringify(value));
const sameDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

function eventTarget(value = {}) {
  const listeners = new Map();
  return Object.assign(value, {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatchEvent(event) {
      event.target ??= this;
      for (const callback of [...(listeners.get(event.type) || [])]) callback(event);
      return true;
    },
  });
}

function canvasAdapter(rect) {
  let width = 300, height = 150;
  const canvas = eventTarget({ style: {}, dataset: {}, getBoundingClientRect: () => ({ ...rect }) });
  const properties = ['font', 'textAlign', 'textBaseline', 'fillStyle', 'strokeStyle', 'globalAlpha',
    'filter', 'lineWidth', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'globalCompositeOperation'];
  const defaults = { font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    fillStyle: '#000000', strokeStyle: '#000000', globalAlpha: 1, filter: 'none', lineWidth: 1,
    imageSmoothingEnabled: true, imageSmoothingQuality: 'low', globalCompositeOperation: 'source-over' };
  const context = { canvas, commands: [], stack: [], transform: [1, 0, 0, 1, 0, 0] };
  function state() {
    return { ...Object.fromEntries(properties.map(key => [key, copy(context[key])])), transform: [...context.transform] };
  }
  function record(op, args = []) { context.commands.push({ op, args, state: state() }); }
  function reset() {
    Object.assign(context, defaults);
    context.transform = [1, 0, 0, 1, 0, 0];
    context.commands = []; context.stack = [];
  }
  Object.assign(context, {
    setTransform(...matrix) { this.transform = matrix; record('setTransform', matrix); },
    clearRect(x, y, w, h) {
      if (x === 0 && y === 0 && w >= width && h >= height) this.commands = [];
      record('clearRect', [x, y, w, h]);
    },
    measureText(glyph) {
      const size = Number(/([\d.]+)px/.exec(this.font)?.[1]) || 10;
      const textWidth = Math.min(size * 1.5, size * (0.6 + String(glyph).length * 0.15));
      return { width: textWidth, actualBoundingBoxLeft: 0, actualBoundingBoxRight: textWidth,
        actualBoundingBoxAscent: size * 0.8, actualBoundingBoxDescent: size * 0.2 };
    },
    save() { this.stack.push(state()); record('save'); },
    restore() {
      const saved = this.stack.pop();
      if (saved) { for (const key of properties) this[key] = saved[key]; this.transform = saved.transform; }
      record('restore');
    },
    drawImage(source, ...args) {
      record('drawImage', [{ width: source.width, height: source.height,
        commands: copy(source.getContext('2d').commands) }, ...args]);
    },
    createLinearGradient(...args) {
      const gradient = { kind: 'linear-gradient', args, stops: [] };
      Object.defineProperty(gradient, 'addColorStop', { value: (offset, color) => gradient.stops.push([offset, color]) });
      return gradient;
    },
  });
  for (const op of ['fillText', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'arcTo', 'closePath', 'clip', 'fill', 'stroke']) {
    context[op] = (...args) => record(op, args);
  }
  Object.defineProperties(canvas, {
    width: { get: () => width, set(value) { width = value; reset(); } },
    height: { get: () => height, set(value) { height = value; reset(); } },
  });
  canvas.getContext = type => type === '2d' ? context : null;
  reset();
  return canvas;
}

function attributes(text) {
  return Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(match => [match[1], match[2] ?? '']));
}

export function environment(html = '', initial = {}, seed = 42, reducedMotion = false) {
  const viewport = { left: 0, top: 0, width: 800, height: 600 };
  const controls = new Map(), samples = [], canvases = [], themeObservers = new Set(), resizeObservers = new Set(), media = new Map();
  const clock = { now: 1000, next: 1, queue: new Map(), timers: new Map() };
  let random = seed >>> 0;
  const math = Object.create(Math);
  math.random = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
  const transparent = { backgroundColor: 'rgba(0, 0, 0, 0)', borderRadius: '0px', position: 'static',
    visibility: 'visible', display: 'block', getPropertyValue: () => '' };
  const element = (rect, radius = 0, opaque = false) => eventTarget({ children: [], style: { setProperty() {} },
    getBoundingClientRect: () => ({ ...rect }),
    __style: { ...transparent, backgroundColor: opaque ? 'rgb(255, 255, 255)' : transparent.backgroundColor,
      borderTopLeftRadius: `${radius}px`, borderTopRightRadius: `${radius}px`,
      borderBottomRightRadius: `${radius}px`, borderBottomLeftRadius: `${radius}px` } });
  const card = element({ left: 90, top: 100, width: 420, height: 130 }, 20, true);
  const composer = element({ left: 240, top: 460, width: 440, height: 110 }, 24, true);
  const scroller = element(viewport); scroller.children = [card];
  const bodyAttrs = new Set(initial.dark ? ['data-ds-dark-theme'] : []);
  const body = {
    hasAttribute: name => bodyAttrs.has(name),
    toggleAttribute(name, force = !bodyAttrs.has(name)) {
      const before = bodyAttrs.has(name);
      if (force) bodyAttrs.add(name); else bodyAttrs.delete(name);
      if (before !== force) for (const observer of themeObservers) observer.callback();
      return force;
    },
    classList: { toggle() {} },
  };
  const newCanvas = () => { const canvas = canvasAdapter(viewport); canvases.push(canvas); return canvas; };
  const markup = html.slice(0, html.search(/<script\b/i));
  for (const match of markup.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)) {
    const attrs = attributes(match[2]);
    const node = match[1] === 'canvas' ? newCanvas() : eventTarget({ value: attrs.value || '', checked: 'checked' in attrs });
    node.dataset ??= {};
    if (attrs['data-style']) node.dataset.style = attrs['data-style'];
    if (attrs['data-fill']) node.dataset.fill = attrs['data-fill'];
    if (match[1] === 'canvas' && attrs['data-style']) samples.push(node);
    if (attrs.id) controls.set(attrs.id, node);
  }
  for (const match of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
    const attrs = attributes(match[1]);
    const options = [...match[2].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)].map(option => ({ ...attributes(option[1]), text: option[2] }));
    const selected = options.find(option => 'selected' in option) || options[0];
    controls.set(attrs.id, eventTarget({ value: selected?.value ?? selected?.text ?? '' }));
  }
  for (const [key, value] of Object.entries(initial)) {
    if (!controls.has(key)) continue;
    const node = controls.get(key);
    if (typeof value === 'boolean') node.checked = value; else node.value = String(value);
  }
  const document = eventTarget({ hidden: false, body, documentElement: { dataset: {} },
    getElementById: id => controls.get(id),
    querySelectorAll(selector) {
      if (selector === '.card canvas') return samples;
      if (selector === '[data-conversation-scroll]') return [scroller];
      if (selector === '[data-composer-card]' || selector === '[data-composer-seat]') return [composer];
      return [];
    },
    createElement: type => type === 'canvas' ? newCanvas() : element(viewport),
  });
  const window = eventTarget({ devicePixelRatio: 1, innerWidth: 800, innerHeight: 600,
    matchMedia(query) {
      if (!media.has(query)) media.set(query, eventTarget({ matches: query.includes('reduced-motion') && reducedMotion }));
      return media.get(query);
    },
  });
  const globals = { window, document, Math: math, performance: { now: () => clock.now }, devicePixelRatio: 1,
    requestAnimationFrame(callback) { const id = clock.next++; clock.queue.set(id, callback); return id; },
    cancelAnimationFrame(id) { clock.queue.delete(id); },
    setTimeout(callback, delay) { const id = clock.next++; clock.timers.set(id, { callback, due: clock.now + delay }); return id; },
    clearTimeout(id) { clock.timers.delete(id); },
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { resizeObservers.add(this); } disconnect() { resizeObservers.delete(this); } },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { themeObservers.add(this); }
      disconnect() { themeObservers.delete(this); }
    },
    getComputedStyle: node => node.__style || transparent,
  };
  return {
    globals, document, window, controls, canvases, clock,
    pending: () => ({ raf: clock.queue.size, timers: clock.timers.size }),
    observersActive: () => ({ resize: resizeObservers.size, mutation: themeObservers.size }),
    elapse(milliseconds, hz = 60) {
      const target = clock.now + milliseconds;
      let nextFrame = clock.now + 1000 / hz;
      while (clock.now < target - 1e-7) {
        const due = Math.min(...[...clock.timers.values()].map(timer => timer.due));
        const next = Math.min(target, nextFrame, due);
        clock.now = next;
        for (const [id, timer] of [...clock.timers]) if (timer.due <= clock.now + 1e-7) {
          clock.timers.delete(id); timer.callback();
        }
        if (nextFrame <= clock.now + 1e-7) {
          nextFrame += 1000 / hz;
          const callbacks = [...clock.queue.values()]; clock.queue.clear();
          for (const callback of callbacks) callback(clock.now);
        }
      }
    },
    advance(frames = 1) {
      for (let i = 0; i < frames; i++) {
        clock.now += 1000 / 60;
        for (const [id, timer] of [...clock.timers]) if (timer.due <= clock.now) {
          clock.timers.delete(id); timer.callback();
        }
        const callbacks = [...clock.queue.values()]; clock.queue.clear();
        for (const callback of callbacks) callback(clock.now);
      }
    },
    setReducedMotion(value) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      query.matches = value; query.dispatchEvent({ type: 'change' });
    },
    setDark(value) { body.toggleAttribute('data-ds-dark-theme', value); },
    snapshot(canvas) { return { width: canvas.width, height: canvas.height, commands: copy(canvas.getContext('2d').commands) }; },
  };
}

// Minimal host React adapter: persistent fibers/hooks, refs committed before
// passive effects, dependency-aware effects/memo and external-store updates.
function reactAdapter(env) {
  const fibers = new Map();
  let current = null, cursor = 0, pending = [], root = null, active = true, rendering = false, requested = false;
  let visited, text = [], elements = [];
  const cleanup = fiber => { for (const state of fiber.hooks) state.cleanup?.(); };
  const hook = create => { const index = cursor++; return current.hooks[index] ??= create(); };
  function renderNode(vnode, path, ancestors = []) {
    if (vnode == null || typeof vnode === 'boolean') return;
    if (typeof vnode !== 'object') { text.push({ text: String(vnode), ancestors }); return; }
    visited.add(path);
    let fiber = fibers.get(path);
    if (fiber && fiber.type !== vnode.type) { cleanup(fiber); fiber = null; }
    if (!fiber) { fiber = { type: vnode.type, hooks: [] }; fibers.set(path, fiber); }
    if (typeof vnode.type === 'function') {
      const saved = current, savedCursor = cursor;
      current = fiber; cursor = 0;
      const child = vnode.type(vnode.props);
      current = saved; cursor = savedCursor;
      renderNode(child, `${path}.render`, ancestors);
    } else {
      if (vnode.type === 'style') return;
      fiber.node ??= env.document.createElement(vnode.type);
      if (vnode.type === 'canvas') env.liveCanvas = fiber.node;
      if (vnode.props.ref) vnode.props.ref.current = fiber.node;
      elements.push({ type: vnode.type, props: vnode.props, ancestors });
      for (const [index, child] of vnode.props.children.entries()) {
        renderNode(child, `${path}.${child?.props?.key ?? index}`, [...ancestors, vnode.props]);
      }
    }
  }
  function render() {
    if (!active) return;
    if (rendering) { requested = true; return; }
    rendering = true;
    do {
      requested = false; pending = []; visited = new Set(); text = []; elements = [];
      renderNode(root, 'root');
      for (const [path, fiber] of fibers) if (!visited.has(path)) { cleanup(fiber); fibers.delete(path); }
      for (const effect of pending) { effect.cleanup?.(); effect.cleanup = effect.run(); }
    } while (requested);
    rendering = false;
  }
  const React = {
    createElement(type, props, ...children) { return { type, props: { ...props, children: children.flat(Infinity) } }; },
    useState(initial) {
      const state = hook(() => ({ value: typeof initial === 'function' ? initial() : initial }));
      return [state.value, value => {
        const next = typeof value === 'function' ? value(state.value) : value;
        if (!Object.is(next, state.value)) { state.value = next; render(); }
      }];
    },
    useCallback(callback, deps) { return React.useMemo(() => callback, deps); },
    useId() { return hook(() => `id-${fibers.size}-${cursor}`).toString(); },
    useRef(initial) { return hook(() => ({ current: initial })); },
    useMemo(factory, deps) {
      const state = hook(() => ({}));
      if (!sameDeps(state.deps, deps)) { state.value = factory(); state.deps = deps; }
      return state.value;
    },
    useEffect(run, deps) {
      const state = hook(() => ({}));
      if (!sameDeps(state.deps, deps)) { state.run = run; state.deps = deps; pending.push(state); }
    },
    useSyncExternalStore(subscribe, snapshot) {
      React.useEffect(() => subscribe(render), [subscribe]);
      return snapshot();
    },
  };
  return {
    React,
    text: () => text,
    elements: () => elements,
    mount(view, props) { root = React.createElement(view, props); render(); },
    dispose() {
      active = false;
      for (const fiber of [...fibers.values()].reverse()) for (const state of fiber.hooks) state.cleanup?.();
    },
  };
}

function previewScript(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  if (scripts.length !== 1) throw new Error('Expected exactly one shipped preview inline script');
  return scripts[0];
}

/** Runs files supplied by the tests, never imports or recompiles product modules. */
export function createArtifactPair({ client, previewHtml }, initial = {}, options = {}) {
  const seed = options.seed ?? 0x12345678, reducedMotion = options.reducedMotion ?? false;
  const preview = environment(previewHtml, initial, seed, reducedMotion);
  runInNewContext(previewScript(previewHtml), preview.globals, { filename: 'shipped-whale-preview.js' });
  if (preview.document.documentElement.dataset.previewReady !== 'true') throw new Error('Preview did not boot');
  const readConfig = () => copy(preview.window.__previewTest.config());
  const expectedInitial = readConfig();
  for (const [key, value] of Object.entries(initial)) if (key in expectedInitial) expectedInitial[key] = value;
  const host = environment(previewHtml, initial, seed, reducedMotion);
  const storage = options.storage ?? new Map();
  host.window.location = { origin: options.origin ?? 'http://fixture.invalid' };
  Object.defineProperty(host.window, 'localStorage', { get() {
    if (options.storageFailure) throw new Error('Storage denied');
    return { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  } });
  let snapshot = { status: 'ready', writable: options.writable ?? true, revision: 1,
    value: { ...expectedInitial, ...(options.legendSeen === undefined ? {} : { legendSeen: options.legendSeen }) } };
  const subscribers = new Set(), slots = new Map(), formWrites = [];
  const form = options.form ?? {
    getSnapshot: () => snapshot,
    subscribe(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    async mutate(ops, revision) {
      formWrites.push(copy(ops));
      if (options.preferenceWriteFailure && ops.some(op => op.path[0] === 'legendSeen')) throw new Error('Preference write failed');
      if (!snapshot.writable || revision !== snapshot.revision) return false;
      const value = { ...snapshot.value };
      for (const op of ops) value[op.path[0]] = op.value;
      snapshot = { ...snapshot, value, revision: revision + 1 };
      for (const subscriber of [...subscribers]) subscriber();
      return true;
    },
  };
  const adapter = reactAdapter(host);
  const pluginCleanups = [], watchedJobs = new Map();
  let detachJobs;
  function store(initialValue) {
    let value = initialValue;
    const listeners = new Set();
    return { getSnapshot: () => value, subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
      set(next) { value = next; for (const listener of [...listeners]) listener(); } };
  }
  const activityList = store(options.activity?.list ?? { byId: {} });
  const activityStatuses = store(options.activity?.statuses ?? new Map());
  const activityJobs = store({ rows: options.activity?.rows ?? {} });
  const useSource = source => selector => selector(adapter.React.useSyncExternalStore(source.subscribe, source.getSnapshot));
  const effect = callback => { const cleanup = callback(); if (typeof cleanup === 'function') pluginCleanups.push(cleanup); return cleanup; };
  let registration;
  host.window.__ModuleLoader__ = { load(value) { registration = value; } };
  runInNewContext(client, host.globals, { filename: 'shipped-client.js' });
  if (!registration) throw new Error('Client did not register with the module loader');
  registration.factory(name => {
    if (name !== 'react') throw new Error(`Unexpected host dependency: ${name}`);
    return adapter.React;
  }).apply({
    configForms: { get: () => form },
    locale: { register() {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => 'en' },
    effect,
    inject(names, callback) {
      if (!options.activity || options.activity.jobsUnavailable || names[0] !== 'jobs') return;
      callback({ effect(callback) { detachJobs = effect(callback); return detachJobs; }, jobs: { state: activityJobs, watchRows(id) {
        watchedJobs.set(id, (watchedJobs.get(id) ?? 0) + 1);
        return () => { const refs = watchedJobs.get(id) - 1; if (refs) watchedJobs.set(id, refs); else watchedJobs.delete(id); };
      } } });
    },
    slots: { inject: (_name, callback) => callback(), register: (slot, view) => slots.set(slot.name, view) },
  });
  const overlay = slots.get('shell.overlay');
  if (!overlay) throw new Error('Client did not register the public overlay slot');
  const overlayProps = { usePanelInfo: selector => selector({ activePanelId: 'conversation' }),
    ...(options.activity ? { useSessions: useSource(activityList),
      ...(!options.activity.statusUnavailable ? { useSessionStatus: useSource(activityStatuses) } : {}) } : {}) };
  adapter.mount(() => adapter.React.createElement('div', null, adapter.React.createElement(overlay, overlayProps),
    options.settings && adapter.React.createElement(slots.get('plugins.bundle.config'))));
  const live = preview.controls.get('live');
  const hostLive = host.liveCanvas;
  return {
    snapshots() { return { host: host.snapshot(hostLive), preview: preview.snapshot(live) }; },
    config: readConfig,
    hostText({ live = false, summary = false } = {}) {
      return adapter.text().filter(row => !row.ancestors.some(p => p['aria-hidden'] === true)
        && (!live || row.ancestors.some(p => p['aria-live'] === 'polite'))
        && (!summary || row.ancestors.some(p => p['aria-label'] === 'activitySummary')))
        .map(row => row.text).join(' ').replace(/\s+/g, ' ').trim();
    },
    form, formWrites,
    async submitSettings() {
      const element = adapter.elements().find(row => row.type === 'form');
      if (!element) throw new Error('Settings are not mounted');
      await element.props.onSubmit({ preventDefault() {} });
    },
    editSetting(key, value) {
      const element = adapter.elements().find(row => row.type === 'input'
        && row.ancestors.some(props => props['data-aw-field'] === key));
      if (!element) throw new Error(`No input for ${key}`);
      element.props.onChange({ target: { value } });
    },
    hostElements: () => adapter.elements(),
    click(label) {
      const element = adapter.elements().find(row => row.type === 'button' && row.props.children.includes(label));
      if (!element) throw new Error(`No button ${label}`);
      return element.props.onClick();
    },
    setHidden(value) { host.document.hidden = value; host.document.dispatchEvent({ type: 'visibilitychange' }); },
    setReducedMotion(value) { host.setReducedMotion(value); },
    configs() { return { host: copy(form.getSnapshot().value), preview: readConfig() }; },
    advance(frames) { host.advance(frames); preview.advance(frames); },
    update(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const control = preview.controls.get(key);
        if (!control) throw new Error(`No preview control for ${key}`);
        if (typeof value === 'boolean') control.checked = value; else control.value = String(value);
        control.dispatchEvent({ type: typeof value === 'boolean' ? 'change' : 'input' });
        const valueForHost = { ...snapshot.value };
        if (key === 'dark') host.setDark(value);
        else {
          valueForHost[key] = value;
          if (key === 'glass' && value) valueForHost.composerAvoid = false;
          if (key === 'composerAvoid' && value) valueForHost.glass = false;
        }
        snapshot = { ...snapshot, revision: snapshot.revision + 1, value: valueForHost };
        for (const subscriber of [...subscribers]) subscriber();
      }
    },
    pause() { host.setReducedMotion(true); preview.setReducedMotion(true); },
    retainedCanvases() { return host.liveCanvas === hostLive && preview.controls.get('live') === live; },
    setHostActivity(next) {
      if (next.list) activityList.set(next.list);
      if (next.statuses) activityStatuses.set(next.statuses);
      if (next.rows) activityJobs.set({ rows: next.rows });
    },
    detachJobs() { detachJobs?.(); },
    watchedJobs: () => [...watchedJobs.keys()],
    dispose() {
      adapter.dispose();
      for (const cleanup of pluginCleanups.reverse()) cleanup();
      preview.window.dispatchEvent({ type: 'pagehide' });
    },
  };
}
