import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPreset, matchPreset } from '../src/presets.js';
import { DEFAULTS } from '../src/model.js';

const scenes = {
  default: { count: 3, speed: 0.65, opacity: 0.60, color: 'ocean', wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45 },
  rainy: { count: 3, speed: 0.55, opacity: 0.55, color: 'ocean', wind: true, clouds: true, ripples: true, spout: false, rain: true, rainIntensity: 0.35 },
  minimal: { count: 1, speed: 0.40, opacity: 0.35, color: 'ocean', wind: false, clouds: false, ripples: false, spout: false, rain: false, rainIntensity: 0.45 },
  night: { count: 3, speed: 0.50, opacity: 0.45, color: 'indigo', wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45 },
};

test('each scene applies the full approved combination regardless of previous scenes and preserves every other draft value', () => {
  const draft = { ...DEFAULTS, enabled: false, text: '我的鲸', fillMode: 'ascii', species: 'blue', renderStyle: 'cells',
    glyphSize: 8, whaleSize: 1.2, leftInset: 140, activity: false, quietCenter: false, readingEffect: 'blur',
    glass: false, glassStrength: 0.7, composerAvoid: true, pauseOnScroll: true, resourceMode: 'eco',
    // 1.0 fields are protected draft values, not scene-owned parameters: an
    // off switch must survive every scene combination.
    seaGrid: false, dictationEcho: false, future: { untouched: true } };
  const original = structuredClone(draft);
  for (const [target, values] of Object.entries(scenes)) {
    for (const previous of Object.keys(scenes)) {
      const result = applyPreset(applyPreset(draft, previous), target);
      assert.deepEqual(result, { ...draft, ...values });
      assert.equal(matchPreset(result), target);
      assert.equal(result.future, draft.future);
    }
  }
  assert.deepEqual(draft, original, 'applying a scene never mutates its source');
});

test('scene names use normalized owned values at field steps while personal and reading preferences never change the match', () => {
  assert.equal(matchPreset({}), 'default', 'missing values use config defaults without applying a scene');
  assert.equal(matchPreset({ ...scenes.night, speed: 0.50000000001, opacity: 0.454, rainIntensity: 0.449 }), 'night');
  assert.equal(matchPreset({ ...scenes.night, speed: '0.50' }), 'night', 'numeric draft values match their saved form');
  assert.equal(matchPreset({ ...scenes.night, count: 3.2 }), 'night', 'count follows existing normalization');
  assert.equal(matchPreset({ ...scenes.night, speed: 0.53 }), 'custom');
  assert.equal(matchPreset({ ...scenes.night, opacity: 0.456 }), 'custom');
  assert.equal(matchPreset({ ...scenes.night, rainIntensity: 0.46 }), 'custom', 'disabled rain still owns intensity');
  for (const invalid of ['', NaN, Infinity]) assert.equal(matchPreset({ ...scenes.default, speed: invalid }), 'custom');
  for (const [id, values] of Object.entries(scenes)) {
    assert.equal(matchPreset({ ...values, text: '夜航文字', glass: false, composerAvoid: true, readingEffect: 'none',
      pauseOnScroll: true, resourceMode: 'future-mode', activity: false }), id);
    for (const [key, value] of Object.entries(values)) {
      const changed = typeof value === 'boolean' ? !value : typeof value === 'number' ? value + (key === 'count' ? 1 : 0.1) : 'azure';
      assert.equal(matchPreset({ ...values, [key]: changed }), 'custom', `${id}.${key} participates in matching`);
    }
  }
  assert.throws(() => applyPreset(DEFAULTS, 'unknown'), RangeError);
});
