import { createWhaleLayer } from '../src/engine.js';
import { normalizeConfig } from '../src/model.js';
import { createWorkMetrics } from '../src/work-metrics.js';

const metrics = createWorkMetrics();
const canvas = document.querySelector('canvas');
const summary = document.getElementById('summary');
let layer = null, config, latest = null, textCommittedAt = null;
const errors = [];
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const task = kind => ({ scope: 'smoke', entities: [{ key: 'job:smoke', type: 'job', label: 'Smoke task', kind }] });
window.__resourceSmoke = {
  init(resourceMode) {
    layer?.dispose();
    config = normalizeConfig({ resourceMode, speed: 0.3, rain: true });
    layer = createWhaleLayer(canvas, config, { seed: 20261025, metrics, onActivityChange(value) {
      latest = value;
      summary.textContent = value.entities.map(entity => `${entity.label}: ${entity.kind}`).join('; ');
      textCommittedAt = performance.now();
    } });
    return config;
  },
  async sample(ms) {
    metrics.reset();
    const started = performance.now();
    await wait(ms);
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 20) painted++;
    return { elapsedMs: performance.now() - started, metrics: metrics.snapshot(), painted, errors: [...errors],
      visibility: document.visibilityState, config };
  },
  async eventProbe() {
    layer.setActivity(task('running'));
    await wait(40);
    metrics.reset();
    const origin = performance.now();
    layer.setActivity(task('completed'));
    const textMs = latest?.entities.some(e => e.kind === 'completed') ? textCommittedAt - origin : null;
    await wait(40);
    return { textMs, metrics: metrics.snapshot(), errors: [...errors] };
  },
  async pauseProbe() {
    layer.update({ ...config, speed: 0 });
    metrics.reset();
    const frozen = canvas.toDataURL();
    await wait(250);
    const stopped = metrics.snapshot();
    const unchanged = frozen === canvas.toDataURL();
    layer.update({ ...config, speed: 0, opacity: 0.5 });
    const refresh = metrics.snapshot();
    metrics.reset();
    layer.dispose(); layer = null;
    await wait(150);
    return { stopped, unchanged, refresh, disposed: metrics.snapshot() };
  },
  dispose() { layer?.dispose(); layer = null; },
};
