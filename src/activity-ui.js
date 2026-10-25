export function createActivityAnnouncer({ announce, schedule = setTimeout, cancel = clearTimeout, delay = 120 }) {
  let scope = null, timer = null, lastEvent = 0, serial = 0;
  const pending = new Map();
  function clear() {
    if (timer !== null) cancel(timer);
    timer = null; pending.clear(); lastEvent = 0;
    announce({ serial: ++serial, entities: [] });
  }
  function update(presentation) {
    const nextScope = presentation.enabled ? presentation.scope : null;
    if (nextScope !== scope) { clear(); scope = nextScope; }
    if (!scope) return;
    const current = new Map(presentation.entities.map(entity => [entity.key, entity]));
    for (const [key, entity] of pending) if (current.has(entity.key)) {
      pending.set(key, { ...entity, label: current.get(entity.key).label });
    }
    for (const entity of presentation.transitions) {
      if (entity.event <= lastEvent) continue;
      lastEvent = entity.event;
      pending.set(`${entity.key}:${entity.kind}`, entity);
    }
    if (pending.size && timer === null) timer = schedule(() => {
      timer = null;
      const entities = [...pending.values()]; pending.clear();
      announce({ serial: ++serial, entities });
    }, delay);
  }
  return { update, dispose() { clear(); scope = null; } };
}

export function createLegendPreference(scope, storage = () => window.localStorage) {
  const key = scope ? `ascii-whales.legend.v1:${scope}` : null;
  let seen = false;
  try { seen = key !== null && storage()?.getItem(key) === 'seen'; } catch {}
  return {
    get seen() { return seen; },
    dismiss() {
      seen = true;
      try { if (key !== null) storage()?.setItem(key, 'seen'); } catch {}
    },
  };
}
