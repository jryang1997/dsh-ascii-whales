import { FIELDS, normalizeConfig } from './model.js';

export const PRESETS = Object.freeze({
  default: Object.freeze({ count: 3, speed: 0.65, opacity: 0.60, color: 'ocean', wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45 }),
  rainy: Object.freeze({ count: 3, speed: 0.55, opacity: 0.55, color: 'ocean', wind: true, clouds: true, ripples: true, spout: false, rain: true, rainIntensity: 0.35 }),
  minimal: Object.freeze({ count: 1, speed: 0.40, opacity: 0.35, color: 'ocean', wind: false, clouds: false, ripples: false, spout: false, rain: false, rainIntensity: 0.45 }),
  night: Object.freeze({ count: 3, speed: 0.50, opacity: 0.45, color: 'indigo', wind: true, clouds: true, ripples: true, spout: true, rain: false, rainIntensity: 0.45 }),
});

export function applyPreset(draft, id) {
  if (!Object.hasOwn(PRESETS, id)) throw new RangeError(`Unknown scene: ${id}`);
  return { ...draft, ...PRESETS[id] };
}

export function matchPreset(draft) {
  const values = { ...draft };
  for (const key of Object.keys(PRESETS.default)) {
    if (FIELDS[key].kind !== 'number' || values[key] === undefined) continue;
    if (values[key] === '' || !Number.isFinite(Number(values[key]))) return 'custom';
    values[key] = Number(values[key]);
  }
  const config = normalizeConfig(values);
  return Object.entries(PRESETS).find(([, scene]) => Object.entries(scene).every(([key, value]) => {
    const field = FIELDS[key];
    return field.kind === 'number'
      ? Math.round((config[key] - field.min) / field.step) === Math.round((value - field.min) / field.step)
      : config[key] === value;
  }))?.[0] ?? 'custom';
}
