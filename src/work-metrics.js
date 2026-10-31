export const WORK_METRICS = Object.freeze({
  wakeup: 'continuous renderer callback, RAF or timer',
  refreshWakeup: 'once-off event/layout RAF callback',
  scrollWakeup: 'scroll quiet-interval timer callback',
  advance: 'simulation advance body',
  motionStep: 'executed physical integration tick (standard 1/60, economy 1/30 second)',
  waterUpdate: 'water effect update',
  atmosphereUpdate: 'atmosphere effect update',
  rainUpdate: 'rain update after valid delta/size guard',
  rainStep: 'executed internal rain advance',
  spoutUpdate: 'spout paint/update invocation including disabled guard',
  draw: 'completed renderer pass',
  layout: 'renderer geometry/text measurement pass',
});

export function createWorkMetrics({ now = () => performance.now(), limit = 10000 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new Error('Invalid metrics limit');
  const counters = Object.fromEntries(Object.keys(WORK_METRICS).map(key => [key, { count: 0, durationMs: 0 }]));
  let timeline = [], dropped = 0, origin = now();
  return {
    begin: now,
    end(name, started, cause = null) {
      const atMs = now(), durationMs = atMs - started;
      if (!Object.hasOwn(counters, name) || !Number.isFinite(durationMs) || durationMs < 0) throw new Error(`Invalid work metric ${name}`);
      counters[name].count++;
      counters[name].durationMs += durationMs;
      if (name === 'draw' || name === 'layout') {
        if (timeline.length < limit) timeline.push(Object.freeze({ name, atMs: atMs - origin, durationMs, cause }));
        else dropped++;
      }
    },
    reset() {
      for (const value of Object.values(counters)) { value.count = 0; value.durationMs = 0; }
      timeline = []; dropped = 0; origin = now();
    },
    snapshot() {
      return Object.freeze({ counters: Object.freeze(Object.fromEntries(Object.entries(counters).map(([key, value]) => [key, Object.freeze({ ...value })]))),
        timeline: Object.freeze([...timeline]), dropped });
    },
  };
}
