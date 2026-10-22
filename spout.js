import { attenuation, projectParticle } from './model.js';

// Helpers stay `spout`-prefixed: build.mjs strips `export` and concatenates this
// file into the same scope as model.js, which already owns clamp/mix/smooth/noise.
const SPOUT_LIMIT = 3;
const SPOUT_BLOCK_TAGS = new Set(['button', 'input', 'textarea', 'a', 'select', 'label', 'summary']);
const SPOUT_BLOCK_ROLES = new Set(['button', 'slider', 'textbox']);
const SPOUT_PHASES = new Set(['jet', 'bush', 'droplets']);

// Blowhole stations are drawing choices, not measurements.
const SPOUT_MARK = Object.freeze({
  blue: Object.freeze({ x: 0.62, y: -0.12, z: 0, basis: 'screen' }),
  humpback: Object.freeze({ x: 0.56, y: -0.14, z: 0, basis: 'screen' }),
  fin: Object.freeze({ x: 0.60, y: -0.10, z: 0, basis: 'screen' }),
  bowhead: Object.freeze({ x: 0.50, y: -0.16, z: 0, basis: 'lateral' }),
  sperm: Object.freeze({ x: 0.88, y: -0.08, z: 0.06, basis: 'body' }),
});

const SPOUT_STAMPS = Object.freeze({
  blue: {
    basis: 'screen',
    jet: { anchor: { row: 0, col: 1 }, rows: [' * '] },
    bush: { anchor: { row: 1, col: 1 }, rows: [' o ', 'o*o', ' o '] },
    droplets: { anchor: { row: 1, col: 1 }, rows: [' . ', '. .', ' . '] },
  },
  humpback: {
    basis: 'screen',
    jet: { anchor: { row: 0, col: 2 }, rows: [' *** '] },
    bush: { anchor: { row: 1, col: 3 }, rows: [" 'o o' ", 'o  *  o', " 'o o' "] },
    droplets: { anchor: { row: 1, col: 3 }, rows: ['.  .  .', ' .   . ', '   .   '] },
  },
  bowhead: {
    basis: 'lateral',
    jet: { anchor: { row: 1, col: 2 }, rows: ["  '  ", '  *  '] },
    bush: { anchor: { row: 3, col: 4 }, rows: ['O       O', " '     ' ", "  '   '  ", '    *    '] },
    droplets: { anchor: { row: 2, col: 4 }, rows: ['.       .', " '     ' ", '    .    '] },
  },
  fin: {
    basis: 'screen',
    unverified: true,
    jet: { anchor: { row: 0, col: 1 }, rows: [' * '] },
    bush: { anchor: { row: 1, col: 1 }, rows: [' . ', ' * ', ' . '] },
    droplets: { anchor: { row: 0, col: 1 }, rows: [' . '] },
  },
  sperm: {
    basis: 'body',
    jet: { anchor: { row: 0, col: 0 }, rows: ['*  ', " ' ", '  o'] },
    bush: { anchor: { row: 0, col: 0 }, rows: ['*   ', " '  ", '  o ', '   ~'] },
    droplets: { anchor: { row: 0, col: 0 }, rows: ['*  ', ' . ', '  .'] },
  },
});

/**
 * Phase window is half-open [0, 760). Alpha is 1 until 160ms, then linear to 0
 * at 760. The burst keeps the whale until 760 even after the ink falls under
 * 0.04 — otherwise a click at 759ms would start a second mist. Glyphs skip the
 * faint ink themselves.
 */
export function spoutAge(ageMs) {
  if (typeof ageMs !== 'number' || !Number.isFinite(ageMs) || ageMs < 0 || ageMs >= 760) return null;
  const alpha = ageMs < 160 ? 1 : (760 - ageMs) / 600;
  const phase = ageMs < 160 ? 'jet' : ageMs < 420 ? 'bush' : 'droplets';
  return { phase, alpha };
}

export function spoutFrame(species, phase) {
  if (!SPOUT_PHASES.has(phase)) return null;
  const speciesStamps = SPOUT_STAMPS[species];
  const stamp = speciesStamps && speciesStamps[phase];
  if (!stamp) return null;
  const frame = {
    rows: stamp.rows.slice(),
    anchor: { row: stamp.anchor.row, col: stamp.anchor.col },
    basis: speciesStamps.basis,
  };
  if (speciesStamps.unverified) frame.unverified = true;
  return frame;
}

/** Whale index under a primary click, or null. Depth is the grid's; not recomputed. */
export function spoutHit(hit, grid, particles) {
  if (!hit || hit.enabled !== true || hit.button !== 0) return null;
  const tag = String(hit.tag ?? '').toLowerCase();
  if (SPOUT_BLOCK_TAGS.has(tag)) return null;
  if (hit.editable === true || hit.composer === true) return null;
  const role = String(hit.role ?? '').toLowerCase();
  if (SPOUT_BLOCK_ROLES.has(role)) return null;
  if (!grid || !(grid.cellWidth > 0) || !(grid.cellHeight > 0) || !(grid.columns > 0) || !(grid.rows > 0)) return null;
  const x = hit.x, y = hit.y;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const spanW = Number.isFinite(grid.width) ? grid.width : grid.columns * grid.cellWidth;
  const spanH = Number.isFinite(grid.height) ? grid.height : grid.rows * grid.cellHeight;
  if (x < 0 || y < 0 || x >= spanW || y >= spanH) return null;
  const col = Math.floor(x / grid.cellWidth);
  const row = Math.floor(y / grid.cellHeight);
  if (col < 0 || row < 0 || col >= grid.columns || row >= grid.rows) return null;
  const cell = row * grid.columns + col;
  const owners = grid.owners;
  if (!owners || cell >= owners.length) return null;
  const owner = owners[cell];
  if (typeof owner !== 'number' || owner < 0) return null;
  const particle = particles && particles[owner];
  if (!particle || !Number.isInteger(particle.whale)) return null;
  return particle.whale;
}

export function spoutBlit(ink, frame, place) {
  if (!ink) return;
  const savedAlpha = ink.globalAlpha;
  const savedFill = ink.fillStyle;
  const savedAlign = ink.textAlign;
  const savedBaseline = ink.textBaseline;
  const savedFont = ink.font;
  try {
    if (!frame || !place || !Array.isArray(frame.rows)) return;
    const anchor = frame.anchor || { row: 0, col: 0 };
    const acrossX = Number.isFinite(place.acrossX) ? place.acrossX : 0;
    const acrossY = Number.isFinite(place.acrossY) ? place.acrossY : 0;
    const alongX = Number.isFinite(place.alongX) ? place.alongX : 0;
    const alongY = Number.isFinite(place.alongY) ? place.alongY : 0;
    const alphaAt = typeof place.alphaAt === 'function' ? place.alphaAt : null;
    if (!alphaAt && !(place.alpha >= 0.04)) return;
    if (place.fillStyle != null) ink.fillStyle = place.fillStyle;
    if (place.font != null) ink.font = place.font;
    ink.textAlign = 'center';
    ink.textBaseline = 'middle';
    for (let row = 0; row < frame.rows.length; row++) {
      const line = frame.rows[row];
      if (typeof line !== 'string') continue;
      for (let col = 0; col < line.length; col++) {
        const glyph = line[col];
        if (glyph === ' ') continue;
        const dx = col - anchor.col;
        const dy = row - anchor.row;
        const x = place.anchorX + dx * acrossX + dy * alongX;
        const y = place.anchorY + dx * acrossY + dy * alongY;
        const glyphAlpha = alphaAt ? alphaAt(x, y) : place.alpha;
        if (!(glyphAlpha >= 0.04)) continue;
        ink.globalAlpha = glyphAlpha;
        ink.fillText(glyph, x, y);
      }
    }
  } finally {
    ink.globalAlpha = savedAlpha;
    ink.fillStyle = savedFill;
    ink.textAlign = savedAlign;
    ink.textBaseline = savedBaseline;
    ink.font = savedFont;
  }
}

function spoutParticle(x, y, z) {
  return { x, y, z, nx: 0, ny: -1, nz: 0, part: 'body', material: 'skin', seed: 0 };
}

function spoutPoseReady(pose) {
  return Boolean(pose) && Number.isFinite(pose.scale) && pose.spine != null && Number(pose.spine.length) > 0;
}

function spoutProjected(particle, pose) {
  try {
    const point = projectParticle(particle, pose);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    return point;
  } catch {
    return null;
  }
}

function spoutCellLength(grid) {
  return Math.hypot(grid.cellWidth, grid.cellHeight) / Math.SQRT2;
}

function spoutScreenAxes(grid) {
  return { acrossX: grid.cellWidth, acrossY: 0, alongX: 0, alongY: grid.cellHeight };
}

function spoutNormalizeCell(dx, dy, cell) {
  const length = Math.hypot(dx, dy);
  if (!(length > 0) || !Number.isFinite(length)) return null;
  return { x: dx / length * cell, y: dy / length * cell };
}

function spoutAxes(mark, pose, origin, grid) {
  const screen = spoutScreenAxes(grid);
  if (mark.basis === 'screen') return screen;
  const cell = spoutCellLength(grid);
  if (!(cell > 0)) return screen;
  if (mark.basis === 'lateral') {
    const side = spoutProjected(spoutParticle(mark.x, mark.y, mark.z + 0.12), pose);
    if (!side) return screen;
    const across = spoutNormalizeCell(side.x - origin.x, side.y - origin.y, cell);
    if (!across) return screen;
    return { acrossX: across.x, acrossY: across.y, alongX: -across.y, alongY: across.x };
  }
  if (mark.basis === 'body') {
    const forward = spoutProjected(spoutParticle(mark.x + 0.08, mark.y, mark.z), pose);
    const side = spoutProjected(spoutParticle(mark.x, mark.y, mark.z + 0.06), pose);
    if (!forward || !side) return screen;
    const along = spoutNormalizeCell(forward.x - origin.x, forward.y - origin.y, cell);
    const across = spoutNormalizeCell(side.x - origin.x, side.y - origin.y, cell);
    if (!along || !across) return screen;
    return { acrossX: across.x, acrossY: across.y, alongX: along.x, alongY: along.y };
  }
  return screen;
}

function spoutDescribePointer(target) {
  let node = target ?? null;
  if (node && node.nodeType === 3) node = node.parentElement ?? null;
  let tag = '';
  let editable = false;
  let role = '';
  let composer = false;
  if (node && typeof node.closest === 'function') composer = Boolean(node.closest('[data-composer-card]'));
  for (let el = node; el; el = el.parentElement) {
    const name = typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
    if (!tag && name) tag = name;
    if (SPOUT_BLOCK_TAGS.has(name)) tag = name;
    if (el.isContentEditable === true) editable = true;
    else if (typeof el.getAttribute === 'function') {
      const flag = el.getAttribute('contenteditable');
      if (flag != null && String(flag).toLowerCase() !== 'false') editable = true;
    }
    const folded = typeof el.getAttribute === 'function' ? String(el.getAttribute('role') || '').toLowerCase() : '';
    if (!role && SPOUT_BLOCK_ROLES.has(folded)) role = folded;
  }
  return { tag, editable, composer, role };
}

export function attachSpout(canvas, read) {
  let bursts = [];
  let seenScene;
  let detached = false;

  function spoutAdoptScene(state) {
    if (state.scene !== seenScene) {
      seenScene = state.scene;
      bursts.length = 0;
    }
  }

  function spoutDropExpired(now) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      if (!spoutAge(now - bursts[i].born)) bursts.splice(i, 1);
    }
  }

  function spoutPushBurst(state, whaleId) {
    const whale = state.scene && state.scene.whales && state.scene.whales[whaleId];
    if (!whale) return;
    const mark = SPOUT_MARK[whale.species];
    if (!mark) return;
    const pose = state.poses && state.poses[whaleId];
    if (!spoutPoseReady(pose)) return;
    const grid = state.grid;
    if (!grid || !(grid.cellWidth > 0) || !(grid.cellHeight > 0)) return;
    if (!Number.isFinite(state.now)) return;
    const origin = spoutProjected(spoutParticle(mark.x, mark.y, mark.z), pose);
    if (!origin) return;
    const axes = spoutAxes(mark, pose, origin, grid);
    spoutDropExpired(state.now);
    if (bursts.some(burst => burst.whaleId === whaleId)) return;
    if (bursts.length >= SPOUT_LIMIT) bursts.shift();
    bursts.push({
      whaleId,
      species: whale.species,
      born: state.now,
      anchorX: origin.x,
      anchorY: origin.y,
      acrossX: axes.acrossX,
      acrossY: axes.acrossY,
      alongX: axes.alongX,
      alongY: axes.alongY,
    });
  }

  function onPointerDown(event) {
    if (detached || !event) return;
    let state;
    try { state = read(); } catch { return; }
    if (!state || state.reduced || state.hidden || state.enabled !== true || event.button !== 0) return;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (!(x >= 0 && y >= 0 && x < rect.width && y < rect.height)) return;
    spoutAdoptScene(state);
    const described = spoutDescribePointer(event.target);
    const whaleId = spoutHit({
      enabled: true, button: 0, x, y,
      tag: described.tag, editable: described.editable, composer: described.composer, role: described.role,
    }, state.grid, state.scene && state.scene.particles);
    if (whaleId == null) return;
    spoutPushBurst(state, whaleId);
  }

  function paint(ink, fade) {
    if (detached) return;
    let state;
    try { state = read(); } catch { return; }
    if (!state || state.enabled !== true || state.reduced) {
      bursts.length = 0;
      return;
    }
    spoutAdoptScene(state);
    spoutDropExpired(state.now);
    if (!ink || !bursts.length) return;
    const opacity = Number.isFinite(state.opacity) ? state.opacity : 0;
    const fillStyle = state.dark ? '#d7e8ee' : '#b7d0d6';
    const font = `600 ${state.glyphSize}px Consolas, "Cascadia Mono", "Courier New", monospace`;
    for (const burst of bursts) {
      const aged = spoutAge(state.now - burst.born);
      if (!aged) continue;
      const frame = spoutFrame(burst.species, aged.phase);
      if (!frame) continue;
      spoutBlit(ink, frame, {
        anchorX: burst.anchorX, anchorY: burst.anchorY,
        acrossX: burst.acrossX, acrossY: burst.acrossY,
        alongX: burst.alongX, alongY: burst.alongY,
        fillStyle, font,
        alphaAt(x, y) {
          const veil = attenuation(x, y, state.width, state.height, state.quietCenter);
          const edge = typeof fade === 'function' ? fade(x, y) : 1;
          const whale = state.scene && state.scene.whales && state.scene.whales[burst.whaleId];
          const submergence = whale && whale._motion ? whale._motion.submergence : undefined;
          const surfaced = Number.isFinite(submergence) && submergence > 0 ? 1 - submergence : 1;
          return aged.alpha * opacity * veil * edge * surfaced;
        },
      });
    }
  }

  function detach() {
    if (detached) return;
    detached = true;
    bursts.length = 0;
    document.removeEventListener('pointerdown', onPointerDown);
  }

  document.addEventListener('pointerdown', onPointerDown);
  return { paint, detach };
}
