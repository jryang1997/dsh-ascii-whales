// Keep these names distinct when the renderer modules are concatenated.
const GLYPH_INK_LIGHT_LEVELS = 32;
const GLYPH_INK_DEPTH_LEVELS = 16;
const GLYPH_INK_NEAR_DEPTH = 0.14;
const GLYPH_INK_FAR_DEPTH = 1.35;

// Each depth row contains a complete shadow-to-highlight ramp. Construct the
// CSS strings once; drawing only selects an integer index into a cached array.
const GLYPH_INK_PALETTES = (() => {
  const ramps = {
    ocean: [[38, 63, 88], [94, 119, 141], [187, 205, 218]],
    azure: [[32, 62, 88], [76, 127, 158], [169, 207, 226]],
    indigo: [[48, 55, 83], [109, 116, 153], [199, 202, 224]],
  };
  const palettes = {};
  for (const [name, [shadow, mid, highlight]] of Object.entries(ramps)) {
    const palette = [];
    for (let distance = 0; distance < GLYPH_INK_DEPTH_LEVELS; distance++) {
      const depth = distance / (GLYPH_INK_DEPTH_LEVELS - 1);
      const haze = 0.34 * depth * depth * (3 - 2 * depth);
      for (let shade = 0; shade < GLYPH_INK_LIGHT_LEVELS; shade++) {
        const light = shade / (GLYPH_INK_LIGHT_LEVELS - 1);
        const unlit = 1 - light;
        // A quadratic ramp keeps the slope continuous as bending normals
        // change their light, without random hue changes or extra opacity.
        const channels = shadow.map((start, channel) => {
          const ink = unlit * unlit * start + 2 * unlit * light * mid[channel]
            + light * light * highlight[channel];
          return Math.round(ink + (255 - ink) * haze);
        });
        palette.push(`rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`);
      }
    }
    palettes[name] = Object.freeze(palette);
  }
  return Object.freeze(palettes);
})();

/** Return the shared opaque 32-light × 16-distance LUT, with ocean as fallback. */
export function createInkPalette(name) {
  return name === 'azure' ? GLYPH_INK_PALETTES.azure
    : name === 'indigo' ? GLYPH_INK_PALETTES.indigo : GLYPH_INK_PALETTES.ocean;
}

/**
 * light is 0..1; depth is cameraZ / focal, with full ink at 0.14 and maximum
 * haze at 1.35. Both axes use the nearest bin. Index = depthBin * 32 + lightBin.
 * NaN/non-numbers default to mid-light and near depth; infinities clamp to ends.
 * This per-cell path allocates nothing and never constructs a CSS color.
 */
export function glyphInkIndex(light, depth) {
  if (typeof light !== 'number' || light !== light) light = 0.5;
  if (typeof depth !== 'number' || depth !== depth) depth = GLYPH_INK_NEAR_DEPTH;
  const shade = light <= 0 ? 0 : light >= 1 ? GLYPH_INK_LIGHT_LEVELS - 1
    : Math.round(light * (GLYPH_INK_LIGHT_LEVELS - 1));
  const distance = depth <= GLYPH_INK_NEAR_DEPTH ? 0
    : depth >= GLYPH_INK_FAR_DEPTH ? GLYPH_INK_DEPTH_LEVELS - 1
      : Math.round((depth - GLYPH_INK_NEAR_DEPTH) * (GLYPH_INK_DEPTH_LEVELS - 1)
        / (GLYPH_INK_FAR_DEPTH - GLYPH_INK_NEAR_DEPTH));
  return distance * GLYPH_INK_LIGHT_LEVELS + shade;
}

/** Dark ink describes the raised back seen through a shorter water column. */
export function surfaceInkTone(elevation, upness, sideFacing, material = 'skin', seed = 0.5) {
  const raised = Math.max(0, Math.min(1.25, elevation / 0.235));
  const crown = Math.max(0, Math.min(1, upness));
  const aspect = Math.max(-1, Math.min(1, sideFacing));
  const relief = raised * 0.82 + crown * 0.18;
  let tone = 0.86 - relief * 0.66 + aspect * 0.025 + (seed - 0.5) * 0.025;
  if (material === 'fin') tone += 0.02 + Math.max(0, Math.min(1, -elevation / 0.25)) * 0.04;
  else if (material === 'pleat') tone -= 0.035;
  else if (material === 'eye') tone = Math.min(tone, 0.18);
  return Math.max(0.14, Math.min(0.9, tone));
}
