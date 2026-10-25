/** Read only the DSH root stores, never conversation text or DOM heuristics. */
const unavailable = Object.freeze({ currentSession: 'unavailable', liveStatus: 'unavailable', jobs: 'unavailable' });
export const EMPTY_ACTIVITY = Object.freeze({ scope: null, entities: Object.freeze([]), availability: unavailable });
const unknownJobs = Object.freeze({ rows: Object.freeze({}) });
const emptyJobs = Object.freeze({ ...unknownJobs, available: false });
const rank = entity => entity.kind === 'waiting' ? 0 : entity.kind === 'failed' ? 1
  : entity.kind === 'completed' ? 2 : entity.kind === 'running' ? 3 : 4;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sessionKind = (row, status) => status?.pendingInteraction ? 'waiting'
  : (status?.running ?? row?.running) === true ? 'running'
    : typeof status?.running === 'boolean' ? 'idle' : 'unavailable';

export function currentSessionId(list) {
  return Object.values(list?.byId ?? {}).find(row => (row?.retainedBy?.mainView ?? 0) > 0)?.id ?? null;
}

/** The current session, its local descendants and visible jobs. */
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
    if (!related.has(id)) continue;
    const status = statuses?.get?.(id);
    const kind = sessionKind(row, status);
    entities.push({ key: `session:${id}`, type: row.origin === 'subagent' || row.parentId ? 'subagent' : 'session',
      label: String(row.displayTitle ?? row.title ?? '').trim(), kind, primary: id === scope,
      waitingAvailable: record(status) });
  }
  const jobRows = record(jobs?.rows) && Object.hasOwn(jobs.rows, scope) && Array.isArray(jobs.rows[scope])
    ? jobs.rows[scope] : null;
  const jobsAvailability = jobs?.available === false ? 'unavailable' : jobRows ? 'available' : 'unknown';
  const seen = new Set();
  for (const job of jobsAvailability === 'available' ? jobRows : []) {
    if (!record(job) || (typeof job.id !== 'string' && typeof job.id !== 'number')) continue;
    const key = `job:${job.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = job.status === 'running' || job.status === 'stopping' ? 'running'
      : job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed'
        : ['killed', 'cancelled', 'stopped'].includes(job.status) ? 'idle' : 'unavailable';
    entities.push({ key, type: 'job', label: String(job.label ?? '').trim(), kind, primary: false });
  }
  return { scope, entities, availability: { currentSession: 'available',
    liveStatus: typeof statuses?.get === 'function' ? 'available' : 'unavailable',
    jobs: jobsAvailability } };
}

/** Stable seats by identity. A newly observed terminal job is history, not a new celebration. */
export function createActivityTracker({ onChange } = {}) {
  let snapshot = EMPTY_ACTIVITY, scope = null, seats = [], now = 0;
  let dirty = true, appliedWhales = null, appliedEnabled = null, nextExpiry = Infinity;
  const runningJobs = new Set(), terminal = new Map();
  let previousKinds = new Map(), transitions = [], serial = 0, published = '';
  function publish(entities, badges, overflow, enabled) {
    const value = { scope: enabled ? scope : null, enabled, availability: snapshot.availability ?? unavailable,
      entities, seats: badges, overflow };
    const signature = JSON.stringify(value);
    if (signature === published && !transitions.length) return;
    published = signature;
    const freezeRows = rows => Object.freeze(rows.map(row => row ? Object.freeze({ ...row }) : null));
    onChange?.(Object.freeze({ ...value, availability: Object.freeze({ ...value.availability }),
      entities: freezeRows(entities), seats: freezeRows(badges), overflow: freezeRows(overflow),
      transitions: freezeRows(transitions) }));
    transitions = [];
  }
  function update(next = EMPTY_ACTIVITY) {
    const changedScope = next.scope !== scope;
    if (changedScope) {
      scope = next.scope; seats = []; runningJobs.clear(); terminal.clear(); previousKinds.clear(); transitions = [];
    }
    snapshot = next;
    dirty = true;
    const present = new Set();
    for (const entity of snapshot.entities) {
      if (!changedScope && entity.kind === 'waiting' && previousKinds.get(entity.key) !== 'waiting') {
        transitions.push({ ...entity, event: ++serial });
      }
      if (entity.type !== 'job') continue;
      present.add(entity.key);
      if (entity.kind === 'running') { runningJobs.add(entity.key); terminal.delete(entity.key); }
      else if (runningJobs.delete(entity.key) && (entity.kind === 'completed' || entity.kind === 'failed')) {
        terminal.set(entity.key, { ...entity, until: now + 6 });
        transitions.push({ ...entity, event: ++serial });
      } else if (terminal.has(entity.key)) {
        terminal.set(entity.key, { ...terminal.get(entity.key), label: entity.label });
      }
    }
    previousKinds = new Map(snapshot.entities.map(entity => [entity.key, entity.kind]));
    for (const key of runningJobs) if (!present.has(key)) runningJobs.delete(key);
    for (const key of terminal.keys()) if (!present.has(key)) terminal.delete(key);
  }
  function apply(whales, time, enabled = true) {
    now = time;
    if (!dirty && appliedWhales === whales && appliedEnabled === enabled && now < nextExpiry) return;
    dirty = false; appliedWhales = whales; appliedEnabled = enabled;
    if (!enabled || !scope) {
      for (const whale of whales) delete whale.activity;
      transitions = []; nextExpiry = Infinity;
      if (!enabled) { runningJobs.clear(); terminal.clear(); previousKinds.clear(); }
      publish([], [], [], enabled);
      return;
    }
    for (const [key, entity] of terminal) if (entity.until <= now) terminal.delete(key);
    nextExpiry = Infinity;
    for (const entity of terminal.values()) nextExpiry = Math.min(nextExpiry, entity.until);
    const candidates = snapshot.entities.filter(entity => entity.type !== 'job' || !['completed', 'failed'].includes(entity.kind));
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
    const overflow = candidates.filter(entity => !seated.has(entity.key));
    const urgent = overflow.sort((a, b) => rank(a) - rank(b))[0];
    for (let i = 0; i < whales.length; i++) {
      const entity = wanted.get(seats[i]);
      if (!entity) { delete whales[i].activity; continue; }
      whales[i].activity = i === 0 && overflow.length ? { ...entity, overflow: overflow.length,
        ...(urgent && rank(urgent) < rank(entity) ? { kind: urgent.kind, attention: urgent.label } : {}) } : entity;
    }
    publish(candidates.map(({ until, ...entity }) => entity), whales.map(whale => whale.activity ?? null),
      overflow.map(({ until, ...entity }) => entity), enabled);
  }
  return { update, apply };
}

/** Optional jobs service with exactly one shared roster subscription, no output follow. */
export function createJobsBridge() {
  let service = null, scope = null, release = null, unsubscribe = null, snapshot = emptyJobs;
  const listeners = new Set();
  const publish = () => {
    snapshot = scope && service ? service.state.getSnapshot() ?? unknownJobs : emptyJobs;
    for (const listener of listeners) listener();
  };
  function connect() {
    release?.(); unsubscribe?.(); release = unsubscribe = null;
    if (scope && service) {
      unsubscribe = service.state.subscribe(publish);
      release = service.watchRows(scope);
    }
    publish();
  }
  function watch(next) {
    if (next === scope) return;
    scope = next; connect();
  }
  function attach(next) {
    service = next; connect();
    return () => {
      if (service !== next) return;
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
    if (!activity) continue;
    const quiet = activity.kind === 'idle' || activity.kind === 'unavailable';
    if (quiet && !activity.overflow) continue;
    const symbol = quiet ? '' : activity.kind === 'waiting' ? '!' : activity.kind === 'failed' ? '×'
      : activity.kind === 'completed' ? '✓' : '···';
    const label = quiet || activity.kind === 'running' ? '' : ` ${Array.from(activity.attention ?? activity.label).slice(0, 18).join('')}`;
    const text = `${symbol}${label}${activity.overflow ? ` +${activity.overflow}` : ''}`.trim();
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
