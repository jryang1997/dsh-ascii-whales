import test from 'node:test';
import assert from 'node:assert/strict';
import { createInkPalette, glyphInkIndex } from './shading.js';

const palettes = ['ocean', 'azure', 'indigo'];
const near = 0.14;
const far = 1.35;

function rgb(css) {
  const match = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(css);
  assert.ok(match, `Opaque RGB required: ${css}`);
  const channels = match.slice(1).map(Number);
  for (const channel of channels) assert.ok(channel >= 0 && channel <= 255);
  return channels;
}

function luminance(channels) {
  const linear = channels.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function ink(name, light, depth) {
  return rgb(createInkPalette(name)[glyphInkIndex(light, depth)]);
}

function compositeOnWhite(channels, opacity) {
  return channels.map(channel => 255 + (channel - 255) * opacity);
}

test('all palettes are cached opaque RGB tables with 32 shades in 16 depth rows', () => {
  for (const name of palettes) {
    const palette = createInkPalette(name);
    assert.equal(palette.length, 512);
    assert.strictEqual(createInkPalette(name), palette);
    assert.ok(Object.isFrozen(palette));
    palette.forEach(rgb);
  }
  assert.notDeepEqual(createInkPalette('ocean'), createInkPalette('azure'));
  assert.notDeepEqual(createInkPalette('azure'), createInkPalette('indigo'));
  for (const name of [undefined, null, '', 'unknown', '__proto__', 'constructor', {}, Symbol()]) {
    assert.strictEqual(createInkPalette(name), createInkPalette('ocean'));
  }
  assert.deepEqual(ink('ocean', 0, near), [38, 63, 88]);
});

test('light and depth bin centers address every entry without drift', () => {
  const visited = new Set();
  for (let distance = 0; distance < 16; distance++) {
    const depth = near + (far - near) * distance / 15;
    for (let shade = 0; shade < 32; shade++) {
      const index = glyphInkIndex(shade / 31, depth);
      assert.equal(index, distance * 32 + shade);
      assert.equal(glyphInkIndex(shade / 31, depth), index);
      visited.add(index);
    }
  }
  assert.equal(visited.size, 512);
  assert.equal(glyphInkIndex(0.5, near), 16);
  assert.equal(glyphInkIndex(1, far), 511);
});

test('invalid inputs stay safe, while numeric extremes clamp at each endpoint', () => {
  const values = [undefined, null, NaN, Infinity, -Infinity, -100, 0, near,
    0.5, far, 100, '0.5', {}, [], Symbol(), 1n];
  for (const light of values) for (const depth of values) {
    const index = glyphInkIndex(light, depth);
    assert.ok(Number.isInteger(index));
    assert.ok(index >= 0 && index < 512);
    assert.equal(index, glyphInkIndex(light, depth));
    for (const name of palettes) rgb(createInkPalette(name)[index]);
  }
  assert.equal(glyphInkIndex(-Infinity, -Infinity), 0);
  assert.equal(glyphInkIndex(Infinity, Infinity), 511);
  assert.equal(glyphInkIndex(NaN, NaN), glyphInkIndex(0.5, near));
  assert.equal(glyphInkIndex(-10, -10), glyphInkIndex(0, near));
  assert.equal(glyphInkIndex(10, 10), glyphInkIndex(1, far));
});

test('normal lighting has a broad, smooth luminance range even at global opacity 0.6', () => {
  for (const name of palettes) {
    const shadow = ink(name, 0.18, near);
    const highlight = ink(name, 1, near);
    assert.ok(luminance(highlight) - luminance(shadow) > 0.4, name);
    const visibleRange = luminance(compositeOnWhite(highlight, 0.6))
      - luminance(compositeOnWhite(shadow, 0.6));
    assert.ok(visibleRange > 0.25, `${name}: visible normal contrast`);
    assert.notDeepEqual(ink(name, 0.35, near), ink(name, 0.65, near));
    for (let distance = 0; distance < 16; distance++) {
      let previous = rgb(createInkPalette(name)[distance * 32]);
      for (let shade = 1; shade < 32; shade++) {
        const current = rgb(createInkPalette(name)[distance * 32 + shade]);
        assert.ok(luminance(current) > luminance(previous), name);
        current.forEach((channel, axis) => {
          assert.ok(channel >= previous[axis]);
          assert.ok(channel - previous[axis] <= 7, `${name}: no large shade step`);
        });
        previous = current;
      }
    }
  }
});

test('distant ink grows paler but retains about 66 percent of its contrast on white', () => {
  for (const name of palettes) {
    for (let shade = 0; shade < 32; shade++) {
      const light = shade / 31;
      const nearInk = ink(name, light, near);
      const farInk = ink(name, light, far);
      assert.ok(luminance(farInk) > luminance(nearInk), name);
      farInk.forEach((channel, axis) => {
        const retainedContrast = (255 - channel) / (255 - nearInk[axis]);
        assert.ok(retainedContrast >= 0.63 && retainedContrast <= 0.69, name);
        assert.ok(channel < 240, `${name}: highlight remains visible`);
      });
      let previous = nearInk;
      for (let distance = 1; distance < 16; distance++) {
        const current = ink(name, light, near + (far - near) * distance / 15);
        current.forEach((channel, axis) => assert.ok(channel >= previous[axis]));
        previous = current;
      }
      const nearVisible = compositeOnWhite(nearInk, 0.6);
      const farVisible = compositeOnWhite(farInk, 0.6);
      farVisible.forEach((channel, axis) => {
        const retainedContrast = (255 - channel) / (255 - nearVisible[axis]);
        assert.ok(retainedContrast >= 0.63 && retainedContrast <= 0.69);
      });
    }
    assert.ok(luminance(ink(name, 1, far)) - luminance(ink(name, 0.18, far)) > 0.3);
  }
});
