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

function readConfig() {
  return { ...DEFAULTS,
    species: el('species').value, renderStyle: el('renderStyle').value,
    fillMode: el('fillMode').value, text: el('text').value,
    count: Math.round(readNumber('count', 1, 8, 3)),
    whaleSize: readNumber('whaleSize', 0.55, 1.55, 1),
    speed: paused ? 0 : readNumber('speed', 0.3, 2, 0.65),
    opacity: 0.8, glass: el('glass').checked, quietCenter: false,
    composerAvoid: el('composerAvoid').checked,
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
function boot() { layer = createWhaleLayer(el('live'), readConfig()); }
function disposeLayer() { layer?.dispose(); layer = null; }
function changeOption(id, value) {
  const next = changeConfigDraft(readConfig(), id, value);
  for (const key of ['glass', 'composerAvoid']) el(key).checked = next[key];
  apply();
}

for (const id of ['renderStyle', 'fillMode', 'text', 'species', 'count', 'whaleSize', 'speed']) {
  el(id).addEventListener('input', apply);
  el(id).addEventListener('change', apply);
}
el('whaleSize').addEventListener('input', scheduleSamples);
el('dark').addEventListener('change', () => { apply(); scheduleSamples(); });
el('pause').addEventListener('click', () => { paused = !paused; apply(); });
for (const id of ['glass', 'composerAvoid']) {
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
