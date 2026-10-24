/** Read only the DSH root stores, never conversation text or DOM heuristics. */
export const EMPTY_ACTIVITY = Object.freeze({ scope: null, entities: Object.freeze([]) });
const emptyJobs = Object.freeze({ rows: Object.freeze({}) });
const rank = entity => entity.kind === 'waiting' ? 0 : entity.kind === 'failed' ? 1
  : entity.kind === 'completed' ? 2 : entity.kind === 'running' ? 3 : 4;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sessionKind = (row, status) => status?.pendingInteraction ? 'waiting'
  : (status?.running ?? row?.running) === true ? 'running' : 'idle';

export function currentSessionId(list) {
  return Object.values(list?.byId ?? {}).find(row => (row?.retainedBy?.mainView ?? 0) > 0)?.id ?? null;
}

/** The current session, its local descendants, other active sessions and visible jobs. */
export function readActivitySnapshot(list, statuses, jobs = emptyJobs) {
  const scope = currentSessionId(list);
  if (!scope) return EMPTY_ACTIVITY;
  const rows = new Map(Object.entries(list?.byId ?? {}));
  // Local subagents need not have been opened in the main view to have a catalog entry.
  for (const [parentId, projection] of Object.entries(list?.projectionsBySession ?? {})) {
    for (const entry of projection?.values?.subagentCatalog ?? []) {
      if (!record(entry) || entry.mode === 'external' || typeof entry.id !== 'string') continue;
      if (!rows.has(entry.id)) rows.set(entry.id, { id: entry.id, parentId, origin: 'subagent', displayTitle: entry.label });
    }
  }
  const related = new Set([scope]);
  for (let pass = 0; pass < rows.size; pass++) {
    let added = false;
    for (const [id, row] of rows) if (related.has(row?.parentId) && !related.has(id)) {
      related.add(id); added = true;
    }
    if (!added) break;
  }
  const entities = [];
  for (const [id, row] of rows) {
    if (!record(row) || typeof id !== 'string') continue;
    const kind = sessionKind(row, statuses?.get?.(id));
    if (!related.has(id) && kind === 'idle') continue;
    entities.push({ key: `session:${id}`, type: row.origin === 'subagent' || row.parentId ? 'subagent' : 'session',
      label: String(row.displayTitle ?? row.title ?? id), kind, primary: id === scope });
  }
  const seen = new Set();
  for (const job of jobs?.rows?.[scope] ?? []) {
    if (!record(job) || (typeof job.id !== 'string' && typeof job.id !== 'number')) continue;
    const key = `job:${job.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = job.status === 'running' || job.status === 'stopping' ? 'running'
      : job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'idle';
    entities.push({ key, type: 'job', label: String(job.label ?? job.id), kind, primary: false });
  }
  return { scope, entities };
}

/** Stable seats by identity. A newly observed terminal job is history, not a new celebration. */
export function createActivityTracker() {
  let snapshot = EMPTY_ACTIVITY, scope = null, seats = [], now = 0;
  let dirty = true, appliedWhales = null, appliedEnabled = null, nextExpiry = Infinity;
  const runningJobs = new Set(), terminal = new Map();
  function update(next = EMPTY_ACTIVITY) {
    if (next.scope !== scope) {
      scope = next.scope; seats = []; runningJobs.clear(); terminal.clear();
    }
    snapshot = next;
    dirty = true;
    const present = new Set();
    for (const entity of snapshot.entities) {
      if (entity.type !== 'job') continue;
      present.add(entity.key);
      if (entity.kind === 'running') { runningJobs.add(entity.key); terminal.delete(entity.key); }
      else if (runningJobs.delete(entity.key) && (entity.kind === 'completed' || entity.kind === 'failed')) {
        terminal.set(entity.key, { ...entity, until: now + 6 });
      }
    }
    for (const key of runningJobs) if (!present.has(key)) runningJobs.delete(key);
    for (const key of terminal.keys()) if (!present.has(key)) terminal.delete(key);
  }
  function apply(whales, time, enabled = true) {
    now = time;
    if (!dirty && appliedWhales === whales && appliedEnabled === enabled && now < nextExpiry) return;
    dirty = false; appliedWhales = whales; appliedEnabled = enabled;
    if (!enabled || !scope) {
      for (const whale of whales) delete whale.activity;
      return;
    }
    for (const [key, entity] of terminal) if (entity.until <= now) terminal.delete(key);
    nextExpiry = Infinity;
    for (const entity of terminal.values()) nextExpiry = Math.min(nextExpiry, entity.until);
    const candidates = snapshot.entities.filter(entity => entity.type !== 'job' || entity.kind === 'running');
    candidates.push(...terminal.values());
    const primary = candidates.find(entity => entity.primary);
    const rest = candidates.filter(entity => !entity.primary).sort((a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key));
    const chosen = primary ? [primary, ...rest.slice(0, Math.max(0, whales.length - 1))] : rest.slice(0, whales.length);
    const wanted = new Map(chosen.map(entity => [entity.key, entity]));
    seats = whales.map((_, index) => index === 0 && primary ? primary.key
      : seats[index] !== primary?.key && wanted.has(seats[index]) ? seats[index] : null);
    const seated = new Set(seats.filter(Boolean));
    for (const entity of chosen) if (!seated.has(entity.key)) {
      const index = seats.indexOf(null);
      if (index < 0) break;
      seats[index] = entity.key; seated.add(entity.key);
    }
    const overflow = candidates.filter(entity => !seated.has(entity.key) && entity.kind !== 'idle');
    const urgent = overflow.sort((a, b) => rank(a) - rank(b))[0];
    for (let i = 0; i < whales.length; i++) {
      const entity = wanted.get(seats[i]);
      if (!entity) { delete whales[i].activity; continue; }
      whales[i].activity = i === 0 && overflow.length ? { ...entity, overflow: overflow.length,
        ...(urgent && rank(urgent) < rank(entity) ? { kind: urgent.kind, attention: urgent.label } : {}) } : entity;
    }
  }
  return { update, apply };
}

/** Optional jobs service with exactly one shared roster subscription, no output follow. */
export function createJobsBridge() {
  let service = null, scope = null, release = null, unsubscribe = null, snapshot = emptyJobs;
  const listeners = new Set();
  const publish = () => {
    snapshot = service?.state.getSnapshot() ?? emptyJobs;
    for (const listener of listeners) listener();
  };
  function watch(next) {
    if (next === scope) return;
    release?.(); release = null; scope = next;
    if (scope && service) release = service.watchRows(scope);
  }
  function attach(next) {
    service = next;
    unsubscribe = service.state.subscribe(publish);
    if (scope) release = service.watchRows(scope);
    publish();
    return () => {
      release?.(); unsubscribe?.(); release = unsubscribe = null; service = null; publish();
    };
  }
  return { attach, watch, subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot };
}

/** Badges stay readable even while a waiting whale is still surfacing. */
export function drawActivityBadges(ink, whales, width, height, { dark = false, opacity = 1, fade = () => 1 } = {}) {
  ink.save();
  ink.font = '600 13px system-ui, sans-serif'; ink.textAlign = 'center'; ink.textBaseline = 'middle';
  for (const whale of whales) {
    const activity = whale.activity;
    if (!activity || activity.kind === 'idle') continue;
    const symbol = activity.kind === 'waiting' ? '!' : activity.kind === 'failed' ? '×'
      : activity.kind === 'completed' ? '✓' : '···';
    const label = activity.kind === 'running' ? '' : ` ${Array.from(activity.attention ?? activity.label).slice(0, 18).join('')}`;
    const text = `${symbol}${label}${activity.overflow ? ` +${activity.overflow}` : ''}`;
    ink.fillStyle = activity.kind === 'waiting' ? (dark ? '#ffd27d' : '#875000')
      : activity.kind === 'failed' ? (dark ? '#ffaaaa' : '#a82b36')
        : activity.kind === 'completed' ? (dark ? '#9ee6c5' : '#17654e') : (dark ? '#a9c6d6' : '#42667a');
    for (const ox of [-width, 0, width]) for (const oy of [-height, 0, height]) {
      const x = whale.x + ox, y = whale.y + oy - whale.bodyRadius - 16;
      if (x < 0 || x > width || y < 8 || y > height - 8) continue;
      ink.globalAlpha = opacity * fade(x, y);
      ink.fillText(text, x, y, 180);
    }
  }
  ink.restore();
}
