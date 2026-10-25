import { createDemoScenario } from './status-demo-scenario.mjs';
import { probeReactStatus } from './react-status-probe.js';

const React = window.React, ReactDOM = window.ReactDOM;
let seed = 20261025;
Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const slots = new Map(), dictionaries = {}, cleanups = [];
let statusDelivered = null;
const store = (initial, delivered) => {
  let value = initial;
  const listeners = new Set();
  return { getSnapshot: () => value, subscribe: callback => { listeners.add(callback); return () => listeners.delete(callback); },
    set(next) { value = next; for (const callback of listeners) { delivered?.(); callback(); } } };
};
const language = store('en'), sessions = store({ byId: {} }), statuses = store(new Map(), () => statusDelivered?.()), jobs = store({ available: true, rows: { demo: [] } });
const initial = { enabled: true, activity: true, text: 'ASCII Whales', count: 3, speed: 0.65, opacity: 0.6,
  color: 'ocean', wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45,
  glass: true, readingEffect: 'frost', quietCenter: true, leftInset: 0 };
const saved = store({ status: 'ready', writable: true, revision: 1, value: initial });
const writes = [];
const form = { ...saved, async mutate(ops, revision) {
  const current = saved.getSnapshot();
  if (current.revision !== revision) return false;
  const value = { ...current.value };
  for (const op of ops) value[op.path[0]] = op.value;
  writes.push(ops);
  saved.set({ ...current, revision: current.revision + 1, value });
  return true;
} };
const source = state => selector => selector(React.useSyncExternalStore(state.subscribe, state.getSnapshot));
let root, scenario;
window.__demo = {
  mount(locale, mode) {
    root?.unmount();
    language.set(locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.body.dataset.mode = mode;
    document.getElementById('stage').textContent = mode === 'settings' ? 'settings · saved draft' : '';
    seed = 20261025;
    saved.set({ status: 'ready', writable: true, revision: 1, value: mode === 'settings' ? { ...initial }
      : { ...initial, glass: false, readingEffect: 'none', quietCenter: false, opacity: 0.85, clouds: false, wind: false } });
    writes.length = 0;
    scenario = createDemoScenario(locale);
    document.getElementById('caption').textContent = locale === 'zh' ? '模拟状态 · 正式渲染器 · 非已安装 DSH 录屏' : 'SIMULATED states · formal renderer · NOT installed DSH';
    document.getElementById('explanation').textContent = locale === 'zh'
      ? '确定性演示任务。空闲不等于成功。构建演示与检查演示是两个后台任务。'
      : 'Deterministic fixture tasks. Idle does not mean success. Build demo and Check demo are separate jobs.';
    root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(slots.get(mode === 'settings' ? 'plugins.bundle.config' : 'shell.overlay'), {
      usePanelInfo: selector => selector({ activePanelId: 'conversation' }), useSessions: source(sessions), useSessionStatus: source(statuses),
    }));
  },
  advance(stage) {
    const next = scenario.advance(stage);
    sessions.set(next.sessions); statuses.set(next.statuses); jobs.set(next.jobs);
    document.getElementById('stage').textContent = stage;
  },
  configure(patch) {
    const current = saved.getSnapshot();
    saved.set({ ...current, revision: current.revision + 1, value: { ...current.value, ...patch } });
  },
  probeStatus(options) {
    return probeReactStatus({ ...options,
      publish(waiting) { statuses.set(new Map([['demo', { running: true, ...(waiting ? { pendingInteraction: { kind: 'question' } } : {}) }]])); },
      observeDelivery(callback) { statusDelivered = callback; return () => { statusDelivered = null; }; },
    });
  },
  saved: () => saved.getSnapshot(), writes: () => writes,
  dispose() { root?.unmount(); for (const cleanup of cleanups.reverse()) cleanup(); },
};
window.__ModuleLoader__ = { load(registration) { registration.factory(() => React).apply({
  configForms: { get: () => form },
  locale: { register(ns, locale, dictionary) { dictionaries[locale] = dictionary; }, bind: () => key => dictionaries[language.getSnapshot()]?.[key] ?? key,
    subscribe: language.subscribe, getSnapshot: language.getSnapshot },
  effect(run) { const cleanup = run(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
  inject(names, run) { if (names[0] === 'jobs') run({ effect: f => { const cleanup = f(); if (typeof cleanup === 'function') cleanups.push(cleanup); },
    jobs: { state: jobs, watchRows() { return () => {}; } } }); },
  slots: { inject(name, run) { run(); }, register(slot, view) { slots.set(slot.name, view); } },
}); } };
