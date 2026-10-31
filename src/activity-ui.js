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

export function createLegendPreference(form) {
  let dismissed = false;
  return {
    get seen() {
      if (dismissed) return true;
      try {
        const snapshot = form.getSnapshot();
        return snapshot.status === 'ready' && snapshot.value?.legendSeen === true;
      } catch { return false; }
    },
    async dismiss() {
      dismissed = true;
      try {
        const snapshot = form.getSnapshot();
        if (snapshot.status !== 'ready' || !snapshot.writable) return false;
        if (snapshot.value?.legendSeen === true) return true;
        if (typeof form.set === 'function') return await form.set('legendSeen', true);
        return await form.mutate([{ op: 'set', path: ['legendSeen'], value: true }], snapshot.revision);
      } catch { return false; }
    },
  };
}
