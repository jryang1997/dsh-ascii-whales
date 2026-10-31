const POLICIES = Object.freeze({
  standard: Object.freeze({ scheduler: 'raf', drawIntervalMs: 1000 / 30, motionTick: 1 / 60,
    rainHz: 60, swimMultiplier: 1 }),
  economy: Object.freeze({ scheduler: 'timer', drawIntervalMs: 1000 / 15, motionTick: 1 / 30,
    rainHz: 15, swimMultiplier: 0.75 }),
});

export function resourcePolicy(mode) {
  return POLICIES[mode] || POLICIES.standard;
}
