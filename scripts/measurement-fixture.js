import { createWhaleLayer } from '../src/engine.js';
import { normalizeConfig } from '../src/model.js';
import { createWorkMetrics } from '../src/work-metrics.js';

const initialText = 'Deterministic simulated conversation. No model request. 阅读保护、滚动和固定文本用于受控测量。';
const scroller = document.querySelector('[data-conversation-scroll]');
const metrics = createWorkMetrics();
let layer = null, config = null, initMs = null, errors = [], longTasks = [], raw = [], phaseStarted = 0;
let longTaskObserver = null;
window.addEventListener('error', event => errors.push(String(event.message)));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
try {
  longTaskObserver = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) if (entry.startTime >= phaseStarted) longTasks.push({ atMs: entry.startTime - phaseStarted, durationMs: entry.duration });
  });
  longTaskObserver.observe({ type: 'longtask' });
} catch { /* Chrome versions without Long Tasks expose an explicit null below. */ }

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16);
}

function environment() {
  return { url: location.href, visibility: document.visibilityState, dpr: devicePixelRatio,
    viewport: { width: innerWidth, height: innerHeight }, screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
    userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGiB: navigator.deviceMemory ?? null, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches };
}

function snapshot(includeTimeline = false) {
  const observed = metrics.snapshot();
  return { atMs: performance.now() - phaseStarted, visibility: document.visibilityState,
    metrics: includeTimeline ? observed : { counters: observed.counters, dropped: observed.dropped },
    scrollTop: scroller.scrollTop, textLength: scroller.textContent.length, contentHash: hashText(scroller.textContent) };
}

function scheduleFor(scenario, durationMs) {
  const stepMs = scenario === 'append' ? 250 : 50;
  if (scenario === 'idle') return [];
  return Array.from({ length: Math.max(0, Math.ceil(durationMs / stepMs) - 1) }, (_, index) => ({ atMs: (index + 1) * stepMs, kind: scenario }));
}

async function runPhase(scenario, durationMs) {
  metrics.reset();
  longTasks = [];
  phaseStarted = performance.now();
  const plannedEvents = scheduleFor(scenario, durationMs), events = [];
  raw = [snapshot()];
  let nextEvent = 0, timer = 0;
  function dispatch() {
    while (nextEvent < plannedEvents.length && plannedEvents[nextEvent].atMs <= performance.now() - phaseStarted) {
      const planned = plannedEvents[nextEvent++];
      if (planned.kind === 'append') {
        scroller.lastElementChild.firstElementChild.append(` batch-${nextEvent.toString().padStart(4, '0')} simulated text.`);
      } else {
        const max = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = max > 0 ? (nextEvent * 6) % max : 0;
      }
      events.push({ scheduledMs: planned.atMs, atMs: performance.now() - phaseStarted, kind: planned.kind,
        scrollTop: scroller.scrollTop, textLength: scroller.textContent.length });
    }
    if (nextEvent < plannedEvents.length) timer = setTimeout(dispatch, Math.max(0, phaseStarted + plannedEvents[nextEvent].atMs - performance.now()));
  }
  if (plannedEvents.length) timer = setTimeout(dispatch, plannedEvents[0].atMs);
  const poll = setInterval(() => raw.push(snapshot()), 1000);
  await new Promise(resolve => setTimeout(resolve, durationMs));
  clearTimeout(timer);
  dispatch();
  clearTimeout(timer);
  clearInterval(poll);
  const final = snapshot(true);
  raw.push(final);
  return { durationMs: final.atMs, metrics: final.metrics, raw, events, plannedEvents,
    contentHash: final.contentHash, visibility: document.visibilityState, errors: [...errors],
    longTasks: longTaskObserver ? [...longTasks] : null, environment: environment() };
}

window.__measurement = {
  init(options) {
    const started = performance.now();
    let random = options.seed >>> 0;
    Math.random = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
    layer?.dispose();
    scroller.replaceChildren(...Array.from({ length: 60 }, (_, index) => {
      const card = document.createElement('article'), paragraph = document.createElement('p');
      paragraph.textContent = `${index.toString().padStart(2, '0')} ${initialText.repeat(3)}`;
      card.append(paragraph);
      return card;
    }));
    scroller.scrollTop = 0;
    config = normalizeConfig(options.config);
    metrics.reset();
    errors = [];
    layer = options.condition === 'standard' ? createWhaleLayer(document.querySelector('canvas'), config,
      { metrics: options.observe === false ? null : metrics, seed: options.seed }) : null;
    initMs = performance.now() - started;
    return { config, initMs, metrics: metrics.snapshot(), environment: environment(), initialContentHash: hashText(scroller.textContent) };
  },
  runPhase, snapshot, environment,
  image() {
    const canvas = document.querySelector('canvas'), data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] > 0) painted++;
    return { painted, width: canvas.width, height: canvas.height };
  },
  async refreshProbe() {
    const times = [];
    await new Promise(resolve => {
      function frame(at) { times.push(at); if (times.length < 31) requestAnimationFrame(frame); else resolve(); }
      requestAnimationFrame(frame);
    });
    const intervals = times.slice(1).map((at, index) => at - times[index]).sort((a, b) => a - b);
    return { observedRafIntervalMs: intervals[15], physicalRefreshRateHz: null, method: '31 foreground RAF callbacks before warmup; not a physical refresh-rate query' };
  },
};
