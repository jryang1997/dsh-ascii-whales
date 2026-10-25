import { createScene, resizeScene, stepScene } from './model.js';
import { adoptSceneState, setSceneObstacles } from './motion.js';
import { createWaterField, resetWaterField, stepWater } from './water.js';
import { createAtmosphereField, resizeAtmosphereField, stepAtmosphere } from './atmosphere.js';
import { createActivityTracker } from './activity.js';
import { createRainField, resizeRainField, stepRain, resetRainField } from './rain.js';
import { EMPTY_DICTATION, gatherActive, normalizeDictation } from './dictation.js';
import { createVoiceSeaField, resetVoiceSeaField, stepVoiceSea } from './voice-sea.js';

const sceneConfigKeys = Object.freeze(['count', 'text', 'species', 'whaleSize']);

/** Shared prediction for renderer invalidation; update() reports actual replacement. */
export function sceneConfigChanged(previous = {}, next = {}) {
  return sceneConfigKeys.some(key => previous[key] !== next[key]);
}

const dictationAnchorOf = value => value && ['left', 'top', 'width', 'height']
  .every(key => Number.isFinite(value[key])) && value.width > 0 && value.height > 0
  ? { left: value.left, top: value.top, width: value.width, height: value.height }
  : null;

/** Owns the simulation clock, replacement ordering and surface effect history. */
export function createWhaleSimulation(initialConfig, { seed = 0 } = {}) {
  let disposed = false;
  let activityTime = 0;
  let config = { ...initialConfig };
  let scene = createScene(config.count, config.text, config.species, config.whaleSize, seed);
  scene.diveSeed = seed;
  const water = createWaterField();
  const atmosphere = createAtmosphereField({ seed });
  const rain = createRainField({ seed });
  const voiceSea = createVoiceSeaField();
  const activity = createActivityTracker();
  // Dictation is an externally driven UI state, not a task entity: it lives on
  // the scene as a small directive the motion layer reads, and it never feeds
  // the activity seats or badges.
  let dictation = EMPTY_DICTATION;
  let dictationAnchor = null;
  let dictationLevel = () => 0;
  let dictationEnabled = config.dictationEcho !== false;

  /** Rebuild the scene directive while keeping the ease and slot cache alive. */
  function applyDictation(previous = null) {
    if (!scene) return;
    const before = previous || scene.dictation || null;
    scene.dictation = {
      active: dictationEnabled && gatherActive(dictation),
      anchor: dictationEnabled ? dictationAnchor : null,
      composerAvoid: config.composerAvoid === true,
      engage: before && Number.isFinite(before.engage) ? before.engage : 0,
      slots: before ? before.slots : null,
      layoutKey: before ? before.layoutKey : '',
      level: 0,
    };
  }

  applyDictation();

  return {
    get scene() { return scene; },
    water, atmosphere, rain, voiceSea,
    get dictation() { return dictation; },
    update(next) {
      if (disposed) return false;
      const rebuild = sceneConfigChanged(config, next);
      const previousDictation = scene.dictation || null;
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
      dictationEnabled = config.dictationEcho !== false;
      applyDictation(rebuild ? previousDictation : scene.dictation);
      activity.apply(scene.whales, activityTime, config.activity);
      return rebuild;
    },
    setActivity(snapshot) {
      if (disposed) return;
      activity.update(snapshot);
      activity.apply(scene.whales, activityTime, config.activity);
    },
    setDictation(snapshot, levelSource) {
      if (disposed) return;
      dictation = normalizeDictation(snapshot);
      dictationLevel = typeof levelSource === 'function' ? levelSource : () => 0;
      applyDictation(scene.dictation);
    },
    setDictationAnchor(anchor) {
      if (disposed) return;
      const next = dictationAnchorOf(anchor);
      if (next === null && dictationAnchor === null) return;
      if (next !== null && dictationAnchor !== null
        && next.left === dictationAnchor.left && next.top === dictationAnchor.top
        && next.width === dictationAnchor.width && next.height === dictationAnchor.height) return;
      dictationAnchor = next;
      applyDictation(scene.dictation);
    },
    dictationLevel() { return disposed ? 0 : dictationLevel(); },
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
      const before = scene.time;
      activity.apply(scene.whales, activityTime, config.activity);
      stepScene(scene, delta, config.speed);
      const elapsed = scene.time - before;
      activityTime += elapsed;
      if (config.ripples) stepWater(water, scene, elapsed);
      stepAtmosphere(atmosphere, elapsed);
      stepRain(rain, elapsed, { enabled: config.rain, intensity: config.rainIntensity,
        wind: config.wind, atmosphere });
      // The voice swell follows the same simulation clock; a disabled switch lets
      // the live rings drain naturally instead of freezing them mid-swell.
      stepVoiceSea(voiceSea, elapsed, dictationLevel(), {
        enabled: dictationEnabled && gatherActive(dictation),
        x: dictationAnchor ? dictationAnchor.left + dictationAnchor.width / 2 : 0,
        y: dictationAnchor ? dictationAnchor.top + dictationAnchor.height / 2 : 0,
        width: scene.width, height: scene.height });
      return elapsed;
    },
    dispose() { disposed = true; resetWaterField(water); resetRainField(rain); resetVoiceSeaField(voiceSea); scene = null; dictationAnchor = null; dictationLevel = () => 0; },
  };
}
