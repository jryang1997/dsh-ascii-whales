// Dictation gather: the client-side bridge that receives hold-to-dictate state,
// the pure geometry that decides where the school waits, and the small easing
// helpers the simulation reads every fixed step. No DOM is touched here; the
// caller owns the composer measurement and the canvas.

import { whaleSpecies } from './species.js';

/** The contract version this module understands. */
export const DICTATION_SCHEMA = 1;

export const DICTATION_PHASES = Object.freeze(['idle', 'listening', 'recording', 'processing', 'done', 'error']);
/** Kept phases: the school waits while the take is being captured or transcribed. */
export const GATHER_PHASES = Object.freeze(['recording', 'processing']);

export const EMPTY_DICTATION = Object.freeze({
  schema: DICTATION_SCHEMA, seq: 0, phase: 'idle', since: 0, sessionId: null,
  locked: false, cancelArmed: false, polishing: false, pending: false, code: null,
});

/**
 * Design constants, not measured values. The approach is deliberately unhurried
 * (1.8 s); a short take may only get part of the way there, which is accepted.
 */
export const GATHER = Object.freeze({
  enterSeconds: 1.8,
  exitSeconds: 0.8,
  bobAlong: 3.5,
  bobAcross: 2,
  bobPeriod: 6.5,
  swayPeriod: 9,
  edge: 16,
  clearance: 16,
  topLimitRatio: 0.12,
  holdPace: 0.14,
  approachPace: 2.8,
  // Arrival is measured in absolute pixels, clamped to the body length: a 500 px
  // whale must not start crawling 300 px away from its slot.
  slowRadius: Object.freeze({ floor: 90, cap: 170, body: 0.35 }),
  rowStep: 44,
  maxRows: 4,
});

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => value < low ? low : value > high ? high : value;

/** Normalize any snapshot-shaped object; anything unknown is idle. */
export function normalizeDictation(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || snapshot.schema !== DICTATION_SCHEMA) return EMPTY_DICTATION;
  const phase = DICTATION_PHASES.includes(snapshot.phase) ? snapshot.phase : 'idle';
  return Object.freeze({
    schema: DICTATION_SCHEMA,
    seq: finite(snapshot.seq, 0),
    phase,
    since: finite(snapshot.since, 0),
    sessionId: typeof snapshot.sessionId === 'string' && snapshot.sessionId ? snapshot.sessionId : null,
    locked: snapshot.locked === true,
    cancelArmed: snapshot.cancelArmed === true,
    polishing: snapshot.polishing === true,
    pending: snapshot.pending === true,
    code: typeof snapshot.code === 'string' && snapshot.code ? snapshot.code : null,
  });
}

/** Whether a normalized snapshot should hold the school at the composer. */
export function gatherActive(snapshot) {
  return Boolean(snapshot) && GATHER_PHASES.includes(snapshot.phase);
}

/**
 * The widest silhouette extent around the five body stations, in canvas pixels,
 * plus a glyph-cell clearance. Mirrors the avoidance model in motion.js; kept
 * here so the layout does not depend on the moving internals of the simulation.
 */
export function bodyReach(whale) {
  const anatomy = whaleSpecies(whale?.species);
  const unit = Math.max(0, finite(whale?.length, 0)) / 2.24;
  const body = Math.max(0, finite(whale?.bodyRadius, 0));
  const fluke = anatomy.fluke.span * unit;
  const flipperTip = Math.abs(anatomy.flipper.tip[2]) * unit;
  const flipperRoot = Math.abs(anatomy.flipper.root[2]) * unit + anatomy.flipper.width * unit;
  const widest = Math.max(fluke, Math.max(body * 0.6, fluke * 0.45),
    Math.max(body, flipperTip), Math.max(body, flipperRoot), body * 0.25);
  return widest + 12;
}

/** Extra room kept when the school is made to avoid the composer instead of glass. */
function avoidancePad(whales) {
  let radius = 0, reach = 0, length = 0;
  for (const whale of whales) {
    radius = Math.max(radius, finite(whale.bodyRadius, 0));
    reach = Math.max(reach, bodyReach(whale));
    length = Math.max(length, finite(whale.length, 0));
  }
  const rectangle = Math.max(26, 22 + 0.35 * radius);
  const steering = Math.max(48, reach * 2, length * 0.14);
  return rectangle + steering;
}

/** Personal space between two neighbouring whales, matching motion.js. */
function personalSpace(a, b) {
  // Slightly wider than the avoidance model: the hold must not sit exactly on
  // the mutual-repulsion threshold, or the school would jitter in place.
  return 0.53 * (finite(a.length, 0) + finite(b.length, 0)) * 1.18;
}

/** Lay one row of centers across [left, right]; returns null when it cannot fit. */
function layoutRow(entries, left, right) {
  if (!entries.length) return [];
  const width = right - left;
  if (!(width > 0)) return null;
  const centers = new Array(entries.length);
  const first = left + Math.max(20, entries[0].whale.length * 0.28);
  centers[0] = first;
  for (let i = 1; i < entries.length; i += 1) {
    centers[i] = centers[i - 1] + personalSpace(entries[i - 1].whale, entries[i].whale);
  }
  const last = centers[centers.length - 1];
  const tail = Math.max(20, entries[entries.length - 1].whale.length * 0.28);
  if (last + tail > right) return null;
  return centers;
}

/**
 * Decide the waiting band above the composer.
 *
 * @param {object} options
 * @param {{left:number,top:number,width:number,height:number}} options.card composer card, canvas CSS px
 * @param {Array} options.whales current school (x/y/heading/length/bodyRadius/species)
 * @param {number} options.width canvas width
 * @param {number} options.height canvas height
 * @param {boolean} [options.composerAvoid] add the avoidance rectangle to the clearance
 * @returns {Array<{x:number,y:number,heading:number,row:number}|null>|null} slots aligned to the whales array
 */
export function gatherGeometry({ card, whales, width, height, composerAvoid = false } = {}) {
  if (!card || !(card.width > 0) || !(card.height > 0) || !Array.isArray(whales) || !whales.length) return null;
  if (!(width > 0) || !(height > 0)) return null;
  const topLimit = Math.max(24, height * GATHER.topLimitRatio);
  const pad = composerAvoid ? avoidancePad(whales) : 0;
  const spanL = Math.max(GATHER.edge, card.left - card.width * 0.14);
  const spanR = Math.min(width - GATHER.edge, card.left + card.width * 1.14);
  if (!(spanR - spanL > 60)) return null;
  // Sort by current screen x, keeping each whale's original index for the caller.
  const order = whales.map((whale, index) => ({ whale, index, x: finite(whale.x, 0) }))
    .sort((a, b) => a.x - b.x || a.index - b.index);
  // A body that is still turning is longer vertically than its flat silhouette;
  // the posture allowance keeps a tilted flank out of the card while it settles.
  const clear = order.map(({ whale }) => bodyReach(whale) + GATHER.bobAlong + GATHER.clearance + pad
    + Math.min(48, whale.length * 0.12));
  const centreX = card.left + card.width / 2;
  const facing = (whale) => {
    const inward = whale.x < centreX ? 0 : Math.PI;
    const current = finite(whale.heading, inward);
    const turn = Math.abs(Math.atan2(Math.sin(inward - current), Math.cos(inward - current)));
    if (turn <= Math.PI / 2) return inward;
    return Math.cos(current) >= 0 ? 0 : Math.PI;
  };
  // Keep any rows that fit safely. Unassigned whales retain their cruise route
  // instead of one overflowing row cancelling the entire school's response.
  const rows = [];
  let rest = order;
  while (rest.length && rows.length < GATHER.maxRows) {
    let best = null;
    for (let take = 1; take <= rest.length; take += 1) {
      const row = rest.slice(0, take);
      const centers = layoutRow(row, spanL, spanR);
      if (!centers) break;
      best = { row, centers };
    }
    if (!best) break;
    rows.push(best);
    rest = rest.slice(best.row.length);
  }
  if (!rows.length) return null;
  const slots = new Array(whales.length).fill(null);
  // Each row is a horizontal line. Its y must clear its own widest body and sit
  // far enough above every earlier row that no cross-row pair ever overlaps once
  // the horizontal stagger is taken into account.
  const rowY = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const { row, centers } = rows[rowIndex];
    const ownClear = Math.max(...row.map(entry => clear[order.indexOf(entry)]));
    let y = card.top - ownClear;
    for (let near = 0; near < rowIndex; near += 1) {
      for (const entry of row) {
        for (const other of rows[near].row) {
          const dx = Math.abs(centers[row.indexOf(entry)] - rows[near].centers[rows[near].row.indexOf(other)]);
          const space = personalSpace(entry.whale, other.whale);
          y = Math.min(y, rowY[near] - Math.sqrt(Math.max(0, space * space - dx * dx)));
        }
      }
    }
    if (y < topLimit) return rowIndex > 0 ? slots : null;
    rowY[rowIndex] = y;
    row.forEach((entry, i) => {
      slots[entry.index] = { x: centers[i], y, heading: facing(entry.whale), row: rowIndex };
    });
  }
  return slots;
}

/** A small deterministic breath around the slot; the school is alive but still. */
export function holdOffset(slot, age, seed = 0) {
  const along = Math.sin(age * Math.PI * 2 / GATHER.bobPeriod + seed) * GATHER.bobAlong;
  const across = Math.sin(age * Math.PI * 2 / GATHER.swayPeriod + seed * 1.37) * GATHER.bobAcross;
  return {
    x: Math.cos(slot.heading) * along - Math.sin(slot.heading) * across,
    y: Math.sin(slot.heading) * along + Math.cos(slot.heading) * across,
  };
}

/** Bounded ease toward the gather state; direction-reversible and delta 0 safe. */
export function stepEngage(engage, active, delta) {
  const current = clamp(finite(engage, 0), 0, 1);
  const step = Math.max(0, finite(delta, 0));
  if (!(step > 0)) return current;
  const target = active ? 1 : 0;
  const rate = target > current ? 1 / GATHER.enterSeconds : 1 / GATHER.exitSeconds;
  return clamp(current + Math.sign(target - current) * rate * step, 0, 1);
}

/**
 * Optional service subscription wins over the lifetime-long semantic fallback.
 * The fallback resolver only looks up an existing face; it never opens audio or
 * sends frame-level notifications. Each attachment owns its own cleanup token.
 */
export function createDictationBridge() {
  let primary = null;
  let fallback = null;
  let snapshot = EMPTY_DICTATION;
  const listeners = new Set();
  const presenceListeners = new Set();
  const notifyPresence = () => { for (const listener of [...presenceListeners]) listener(); };
  const isFace = face => face?.schema === DICTATION_SCHEMA
    && typeof face.getSnapshot === 'function' && typeof face.subscribe === 'function';
  const publish = (value) => {
    const next = normalizeDictation(value);
    if (Object.keys(EMPTY_DICTATION).every(key => next[key] === snapshot[key])) return;
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  const resolveFallback = () => {
    try {
      const face = fallback?.resolve?.();
      return isFace(face) ? face : null;
    } catch {
      // Optional lookup may stop being available during host/plugin disposal.
      return null;
    }
  };
  const requestFallback = () => {
    if (fallback && !primary) fallback.target.dispatchEvent(new CustomEvent('dsh:dictation:request'));
  };
  const onFallback = (event) => {
    if (primary || !fallback || event?.detail?.schema !== DICTATION_SCHEMA) return;
    publish(event.detail);
    notifyPresence();
  };
  return {
    attach(next) {
      if (!isFace(next)) return () => {};
      const previous = primary;
      const owner = { face: next, unsubscribe: null };
      primary = owner;
      if (typeof previous?.unsubscribe === 'function') previous.unsubscribe();
      const update = () => { if (primary === owner) publish(next.getSnapshot()); };
      owner.unsubscribe = next.subscribe(update);
      update();
      notifyPresence();
      return () => {
        if (primary !== owner) return;
        primary = null;
        if (typeof owner.unsubscribe === 'function') owner.unsubscribe();
        publish(EMPTY_DICTATION);
        // Do not replay an event cached before the primary service took over.
        // A live provider can answer this request with its current semantic state.
        requestFallback();
        notifyPresence();
      };
    },
    attachFallback(resolve) {
      if (typeof document === 'undefined' || typeof CustomEvent !== 'function') return () => {};
      if (fallback) fallback.target.removeEventListener('dsh:dictation', onFallback);
      const owner = { target: document, resolve: typeof resolve === 'function' ? resolve : null };
      fallback = owner;
      owner.target.addEventListener('dsh:dictation', onFallback);
      // Seed late consumers even when the optional fiber has not activated.
      // A replacement must not inherit a recording from its previous owner.
      if (!primary) publish(EMPTY_DICTATION);
      const face = resolveFallback();
      if (!primary && face) {
        try { publish(face.getSnapshot()); } catch { publish(EMPTY_DICTATION); }
      }
      requestFallback();
      notifyPresence();
      return () => {
        if (fallback !== owner) return;
        fallback = null;
        owner.target.removeEventListener('dsh:dictation', onFallback);
        if (!primary) publish(EMPTY_DICTATION);
        notifyPresence();
      };
    },
    hasProvider() { return primary !== null || resolveFallback() !== null; },
    level() {
      const face = primary?.face ?? resolveFallback();
      try {
        const value = typeof face?.level === 'function' ? face.level() : 0;
        return clamp(finite(value, 0), 0, 1);
      } catch {
        return 0;
      }
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    subscribePresence(listener) { presenceListeners.add(listener); return () => presenceListeners.delete(listener); },
    getSnapshot() { return snapshot; },
  };
}
