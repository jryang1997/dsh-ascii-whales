import { DEFAULTS } from '../src/model.js';
import { createWhaleLayer } from '../src/engine.js';
import { drawWhaleSample } from '../src/surface.js';
import { changeConfigDraft } from '../src/config-editor.js';

const el = id => document.getElementById(id);
const samples = Array.from(document.querySelectorAll('.card canvas'));
const readNumber = (id, min, max, fallback) => {
  const value = Number(el(id).value);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
};
const twoDigits = value => Number(value).toFixed(2);
let layer = null, paused = false, sampleFrame = 0;
// Preview-only dictation driver: the capture harness pushes a contract snapshot
// and a synthetic level, exactly like the real bridge service would.
let dictationState = null, dictationLevel = 0;

function readConfig() {
  return { ...DEFAULTS,
    resourceMode: el('resourceMode').value,
    species: el('species').value, renderStyle: el('renderStyle').value,
    fillMode: el('fillMode').value, text: el('text').value, color: el('color').value,
    count: Math.round(readNumber('count', 1, 8, 3)),
    whaleSize: readNumber('whaleSize', 0.55, 1.55, 1),
    speed: paused ? 0 : readNumber('speed', 0.3, 2, 0.65),
    readingEffect: el('readingEffect').value,
    opacity: 0.8, glass: el('glass').checked, quietCenter: false,
    composerAvoid: el('composerAvoid').checked, ripples: el('ripples').checked, activity: el('activity').checked,
    seaGrid: el('seaGrid').checked, wind: el('wind').checked, clouds: el('clouds').checked, rain: el('rain').checked, dictationEcho: true,
    rainIntensity: readNumber('rainIntensity', 0, 1, DEFAULTS.rainIntensity),
    pauseOnScroll: el('pauseOnScroll').checked,
  };
}

function syncDom(config) {
  const dark = el('dark').checked;
  document.body.classList.toggle('dark', dark);
  document.body.toggleAttribute('data-ds-dark-theme', dark);
  el('text').disabled = el('fillMode').value === 'ascii';
  el('countOut').value = String(config.count);
  el('whaleSizeOut').value = twoDigits(config.whaleSize);
  el('speedOut').value = twoDigits(el('speed').value);
  el('rainIntensityOut').value = `${Math.round(config.rainIntensity * 100)}%`;
  el('rainIntensity').disabled = !config.rain;
  el('pause').textContent = paused ? '播放' : '暂停';
  el('status').textContent = paused ? '已暂停' : config.composerAvoid ? '鱼群避让开'
    : config.glass ? '内容框毛玻璃开' : '上下摆尾与滑行';
}

function drawSamples() {
  const dark = el('dark').checked, size = readNumber('whaleSize', 0.55, 1.55, 1);
  const ratio = Math.min(2, devicePixelRatio || 1);
  for (const canvas of samples) drawWhaleSample(canvas, { ...DEFAULTS, species: 'blue',
    renderStyle: canvas.dataset.style, fillMode: canvas.dataset.fill, text: '探索未至之境',
    glyphSize: 9, opacity: 0.85, whaleSize: size }, { height: 270, ratio, dark });
}

function scheduleSamples() {
  if (!sampleFrame) sampleFrame = requestAnimationFrame(() => { sampleFrame = 0; drawSamples(); });
}
function apply() { const config = readConfig(); syncDom(config); layer?.update(config); }
function applyActivity() {
  const scenario = el('activityScene').value;
  if (scenario === 'none') { layer?.setActivity(); return; }
  const primary = { key: 'session:preview', type: 'session', primary: true, label: '当前会话',
    kind: scenario === 'waiting' ? 'waiting' : scenario === 'running' || scenario === 'team' ? 'running' : 'idle' };
  const job = { key: 'job:preview-build', type: 'job', primary: false, label: '后台构建', kind: 'running' };
  if (scenario === 'completed' || scenario === 'failed') {
    layer?.setActivity({ scope: 'preview', entities: [primary, job] });
    layer?.setActivity({ scope: 'preview', entities: [primary, { ...job, kind: scenario }] });
  } else layer?.setActivity({ scope: 'preview', entities: [primary, ...(scenario === 'team' ? [
    { key: 'session:preview-agent', type: 'subagent', primary: false, label: '子代理', kind: 'running' }, job,
  ] : [])] });
}
function boot() {
  layer = createWhaleLayer(el('live'), readConfig());
  layer.setDictation(dictationState, () => dictationLevel);
  applyActivity();
}
function disposeLayer() { layer?.dispose(); layer = null; }
function changeOption(id, value) {
  const next = changeConfigDraft(readConfig(), id, value);
  for (const key of ['glass', 'composerAvoid']) el(key).checked = next[key];
  apply();
}

for (const id of ['resourceMode', 'readingEffect', 'renderStyle', 'fillMode', 'text', 'species', 'count', 'whaleSize', 'speed', 'color', 'rainIntensity']) {
  el(id).addEventListener('input', apply);
  el(id).addEventListener('change', apply);
}
el('activityScene').addEventListener('change', applyActivity);
el('whaleSize').addEventListener('input', scheduleSamples);
el('dark').addEventListener('change', () => { apply(); scheduleSamples(); });
el('pause').addEventListener('click', () => { paused = !paused; apply(); });
for (const id of ['glass', 'composerAvoid', 'ripples', 'activity', 'seaGrid', 'wind', 'clouds', 'rain', 'pauseOnScroll']) {
  el(id).addEventListener('change', () => changeOption(id, el(id).checked));
}
const sampleObserver = new ResizeObserver(scheduleSamples);
for (const canvas of samples) sampleObserver.observe(canvas);
syncDom(readConfig()); drawSamples(); boot();

window.__previewTest = {
  config: readConfig, apply,
  size(value) { el('whaleSize').value = String(value); apply(); drawSamples(); },
  layerAlive: () => Boolean(layer),
  option(which, on) { changeOption(which === 'avoid' ? 'composerAvoid' : 'glass', Boolean(on)); },
  // Drive the dictation easter egg without the real plugin: pass a contract
  // snapshot (phase recording/processing/done) and a synthetic 0..1 level.
  dictation(state = null, level = 0.8) {
    dictationState = state && state.phase ? Object.freeze({ schema: 1, seq: 1, since: Date.now(),
      sessionId: null, locked: false, cancelArmed: false, polishing: false, pending: false,
      code: null, ...state }) : null;
    dictationLevel = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    layer?.setDictation(dictationState, () => dictationLevel);
  },
};
window.addEventListener('pagehide', () => {
  disposeLayer(); sampleObserver.disconnect();
  if (sampleFrame) cancelAnimationFrame(sampleFrame);
  sampleFrame = 0;
});
window.addEventListener('pageshow', event => {
  if (event.persisted) { for (const canvas of samples) sampleObserver.observe(canvas); drawSamples(); boot(); }
});
document.documentElement.dataset.previewReady = 'true';
