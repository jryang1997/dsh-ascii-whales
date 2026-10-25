import { createScene, resizeScene, stepScene } from './model.js';
import { adoptSceneState, setSceneObstacles } from './motion.js';
import { createWaterField, resetWaterField, stepWater } from './water.js';
import { createAtmosphereField, resizeAtmosphereField, stepAtmosphere } from './atmosphere.js';
import { createActivityTracker } from './activity.js';
import { createRainField, resizeRainField, stepRain, resetRainField } from './rain.js';

const sceneConfigKeys = Object.freeze(['count', 'text', 'species', 'whaleSize']);

/** Shared prediction for renderer invalidation; update() reports actual replacement. */
export function sceneConfigChanged(previous = {}, next = {}) {
  return sceneConfigKeys.some(key => previous[key] !== next[key]);
}

/** Owns the simulation clock, replacement ordering and surface effect history. */
export function createWhaleSimulation(initialConfig, { seed = 0, metrics = null } = {}) {
  let disposed = false;
  let activityTime = 0;
  let config = { ...initialConfig };
  let scene = createScene(config.count, config.text, config.species, config.whaleSize, seed);
  scene.diveSeed = seed;
  const water = createWaterField();
  const atmosphere = createAtmosphereField({ seed });
  const rain = createRainField({ seed });
  const activity = createActivityTracker();
  return {
    get scene() { return scene; },
    water, atmosphere, rain,
    update(next) {
      if (disposed) return false;
      const rebuild = sceneConfigChanged(config, next);
      if (rebuild) {
        const previous = scene;
        scene = createScene(next.count, next.text, next.species, next.whaleSize, previous.colorSeed);
        scene.diveSeed = seed;
        resizeScene(scene, previous.width > 0 ? previous.width : 1600,
          previous.height > 0 ? previous.height : 900);
        adoptSceneState(previous, scene);
      }
      if (rebuild || config.ripples !== next.ripples) resetWaterField(water);
      config = { ...next };
      activity.apply(scene.whales, activityTime, config.activity);
      return rebuild;
    },
    setActivity(snapshot) {
      if (disposed) return;
      activity.update(snapshot);
      activity.apply(scene.whales, activityTime, config.activity);
    },
    resize(width, height) {
      if (disposed) return;
      resizeScene(scene, width, height);
      resizeAtmosphereField(atmosphere, width, height);
      resizeRainField(rain, width, height);
      if (width > 0 && height > 0) resetWaterField(water);
    },
    setObstacles(obstacles) { if (!disposed) setSceneObstacles(scene, obstacles); },
    advance(delta) {
      if (disposed) return 0;
      const started = metrics?.begin();
      const before = scene.time;
      activity.apply(scene.whales, activityTime, config.activity);
      stepScene(scene, delta, config.speed, metrics);
      const elapsed = scene.time - before;
      activityTime += elapsed;
      if (config.ripples) {
        const waterStarted = metrics?.begin();
        stepWater(water, scene, elapsed);
        metrics?.end('waterUpdate', waterStarted);
      }
      stepAtmosphere(atmosphere, elapsed, metrics);
      stepRain(rain, elapsed, { enabled: config.rain, intensity: config.rainIntensity,
        wind: config.wind, atmosphere, metrics });
      metrics?.end('advance', started);
      return elapsed;
    },
    dispose() { disposed = true; resetWaterField(water); resetRainField(rain); scene = null; },
  };
}
