import { createScene, resizeScene, stepScene } from './model.js';
import { adoptSceneState, setSceneObstacles } from './motion.js';
import { createWaterField, resetWaterField, stepWater } from './water.js';
import { createAtmosphereField, resizeAtmosphereField, stepAtmosphere } from './atmosphere.js';

const sceneConfigKeys = Object.freeze(['count', 'text', 'species', 'whaleSize']);

/** Shared prediction for renderer invalidation; update() reports actual replacement. */
export function sceneConfigChanged(previous = {}, next = {}) {
  return sceneConfigKeys.some(key => previous[key] !== next[key]);
}

/** Owns the simulation clock, replacement ordering and surface effect history. */
export function createWhaleSimulation(initialConfig, { seed = 0 } = {}) {
  let disposed = false;
  let config = { ...initialConfig };
  let scene = createScene(config.count, config.text, config.species, config.whaleSize);
  scene.diveSeed = seed;
  const water = createWaterField();
  const atmosphere = createAtmosphereField({ seed });
  return {
    get scene() { return scene; },
    water, atmosphere,
    update(next) {
      if (disposed) return false;
      const rebuild = sceneConfigChanged(config, next);
      if (rebuild) {
        const previous = scene;
        scene = createScene(next.count, next.text, next.species, next.whaleSize);
        scene.diveSeed = seed;
        resizeScene(scene, previous.width > 0 ? previous.width : 1600,
          previous.height > 0 ? previous.height : 900);
        adoptSceneState(previous, scene);
      }
      if (rebuild || config.ripples !== next.ripples) resetWaterField(water);
      config = { ...next };
      return rebuild;
    },
    resize(width, height) {
      if (disposed) return;
      resizeScene(scene, width, height);
      resizeAtmosphereField(atmosphere, width, height);
      if (width > 0 && height > 0) resetWaterField(water);
    },
    setObstacles(obstacles) { if (!disposed) setSceneObstacles(scene, obstacles); },
    advance(delta) {
      if (disposed) return 0;
      const before = scene.time;
      stepScene(scene, delta, config.speed);
      const elapsed = scene.time - before;
      if (config.ripples) stepWater(water, scene, elapsed);
      stepAtmosphere(atmosphere, elapsed);
      return elapsed;
    },
    dispose() { disposed = true; resetWaterField(water); scene = null; },
  };
}
