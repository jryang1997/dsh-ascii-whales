// Proportions are drawing parameters informed by the sources in WHALE-REFERENCES.md.
// x runs from the fluke trailing edge (-1.2) to the nose (1.04); y is depth.
export const WHALE_SPECIES = Object.freeze({
  blue: {
    name: '蓝鲸', height: 1.05, pleats: true,
    profile: [[-1, 0.018], [-0.82, 0.035], [-0.58, 0.073], [-0.28, 0.13], [0.08, 0.177], [0.4, 0.193], [0.64, 0.171], [0.84, 0.135], [0.97, 0.105], [1.025, 0.061], [1.04, 0]],
    flipper: { root: [0.34, 0.078, 0.153], tip: [0.01, 0.115, 0.39], width: 0.052, thickness: 0.012 },
    fluke: { span: 0.35, tipX: -1.115, leadingX: -0.9, trailingX: -1.2, notch: 0.072, width: 0.018 },
    dorsal: { root: [-0.62, -0.064, 0], tip: [-0.71, -0.16, 0], width: 0.055 },
    cruise: 25, turnRate: 0.22, beat: 1.45, amplitude: 0.1, glide: 0.32, size: 1,
  },
  humpback: {
    name: '座头鲸', height: 1.02, pleats: true,
    profile: [[-1, 0.021], [-0.82, 0.043], [-0.58, 0.09], [-0.28, 0.17], [0.08, 0.227], [0.36, 0.244], [0.62, 0.209], [0.8, 0.158], [0.95, 0.113], [1.025, 0.054], [1.04, 0]],
    flipper: { root: [0.35, 0.1, 0.194], tip: [-0.12, 0.14, 0.79], width: 0.079, thickness: 0.014 },
    fluke: { span: 0.435, tipX: -1.115, leadingX: -0.855, trailingX: -1.2, notch: 0.095, width: 0.021 },
    dorsal: { root: [-0.36, -0.145, 0], tip: [-0.45, -0.3, 0], width: 0.085 },
    cruise: 22, turnRate: 0.25, beat: 1.65, amplitude: 0.12, glide: 0.28, size: 0.93,
  },
  sperm: {
    name: '抹香鲸', height: 1.15, pleats: false,
    profile: [[-1, 0.024], [-0.82, 0.05], [-0.59, 0.099], [-0.28, 0.16], [0.05, 0.209], [0.36, 0.237], [0.62, 0.249], [0.9, 0.247], [1.015, 0.231], [1.04, 0.172]],
    flipper: { root: [0.29, 0.125, 0.193], tip: [-0.025, 0.16, 0.39], width: 0.075, thickness: 0.015 },
    fluke: { span: 0.37, tipX: -1.09, leadingX: -0.855, trailingX: -1.2, notch: 0.09, width: 0.023 },
    dorsal: { root: [-0.39, -0.16, 0], tip: [-0.44, -0.245, 0], width: 0.13 },
    cruise: 21, turnRate: 0.19, beat: 1.35, amplitude: 0.1, glide: 0.4, size: 0.96,
  },
  fin: {
    name: '长须鲸', height: 1.1, pleats: true,
    profile: [[-1, 0.017], [-0.82, 0.031], [-0.58, 0.065], [-0.28, 0.115], [0.08, 0.163], [0.38, 0.178], [0.6, 0.157], [0.8, 0.111], [0.96, 0.049], [1.04, 0]],
    flipper: { root: [0.35, 0.08, 0.14], tip: [0.02, 0.12, 0.345], width: 0.045, thickness: 0.011 },
    fluke: { span: 0.315, tipX: -1.135, leadingX: -0.92, trailingX: -1.2, notch: 0.06, width: 0.017 },
    dorsal: { root: [-0.41, -0.11, 0], tip: [-0.52, -0.27, 0], width: 0.065 },
    cruise: 29, turnRate: 0.24, beat: 1.6, amplitude: 0.092, glide: 0.3, size: 0.98,
  },
  bowhead: {
    name: '弓头鲸', height: 1.08, pleats: false,
    profile: [[-1, 0.025], [-0.82, 0.053], [-0.59, 0.116], [-0.28, 0.215], [0.02, 0.284], [0.3, 0.295], [0.53, 0.259], [0.76, 0.198], [0.94, 0.116], [1.025, 0.052], [1.04, 0]],
    flipper: { root: [0.27, 0.14, 0.238], tip: [-0.11, 0.18, 0.55], width: 0.123, thickness: 0.019 },
    fluke: { span: 0.445, tipX: -1.08, leadingX: -0.83, trailingX: -1.2, notch: 0.1, width: 0.025 },
    dorsal: null,
    cruise: 18, turnRate: 0.18, beat: 1.2, amplitude: 0.11, glide: 0.43, size: 0.94,
  },
});

export const SPECIES_IDS = Object.freeze(Object.keys(WHALE_SPECIES));
export function whaleSpecies(id) { return WHALE_SPECIES[id] || WHALE_SPECIES.blue; }
