import test from 'node:test';
import assert from 'node:assert/strict';
import { glassContentPanes, glassContentTone, glassTone, glassSeaFactor, glassSeaBuffer } from '../src/glass.js';
import { createCellPalette } from '../src/surface.js';
import { createInkPalette } from '../src/shading.js';

const canvas = { left: 280, top: 40, width: 1000, height: 800 };
const box = (left, top, width, height, radius = 20) => ({ left, top, width, height, radius });

test('every opaque box becomes exactly its own pane, clipped only by the canvas', () => {
  const panes = glassContentPanes({ canvas, boxes: [box(400, 300, 700, 120)] });
  assert.equal(panes.length, 1);
  assert.deepEqual(panes[0], { x: 120, y: 260, width: 700, height: 120, radius: 20, feather: 10, nested: false });
  // Pane rect equals the clipped box rect: no inset, no padding, ever.
  for (const [source, expected] of [
    [box(200, 20, 700, 120, 28), { x: 0, y: 0, width: 620, height: 100 }],
    [box(900, 700, 400, 200, 28), { x: 620, y: 660, width: 380, height: 140 }],
  ]) {
    const [pane] = glassContentPanes({ canvas, boxes: [source] });
    assert.equal(pane.x, expected.x);
    assert.equal(pane.y, expected.y);
    assert.equal(pane.width, expected.width);
    assert.equal(pane.height, expected.height);
    assert.ok(pane.radius <= Math.min(pane.width, pane.height) / 2);
  }
  // The radius belongs to each box; a larger radius is clamped to half the side.
  const [round] = glassContentPanes({ canvas, boxes: [box(400, 300, 100, 60, 99)] });
  assert.equal(round.radius, 30);
  const [sharp] = glassContentPanes({ canvas, boxes: [box(400, 300, 100, 60, 0)] });
  assert.equal(sharp.radius, 0);
});

test('boxes too small, off the canvas or unmeasurable are dropped', () => {
  const panes = glassContentPanes({ canvas, boxes: [
    box(400, 300, 39, 120),          // narrower than the minimum
    box(400, 300, 200, 23),          // shorter than the minimum
    box(2000, 300, 700, 120),        // entirely right of the canvas
    box(400, 1400, 700, 120),        // entirely below the canvas
    { left: NaN, top: 0, width: 700, height: 120, radius: 10 },
    box(400, 300, 700, 120),         // the only usable one
  ] });
  assert.equal(panes.length, 1);
  assert.equal(panes[0].width, 700);
  assert.deepEqual(glassContentPanes({ canvas, boxes: [] }), []);
  assert.deepEqual(glassContentPanes({}), []);
  assert.deepEqual(glassContentPanes({ canvas: { ...canvas, width: 0, height: 0 }, boxes: [box(1, 1, 700, 120)] }), []);
});

test('near-identical boxes collapse to one pane while real nesting keeps both', () => {
  // Wrapper and card measured 1px apart: one surface, first wins.
  const duplicate = glassContentPanes({ canvas, boxes: [box(400, 300, 700, 120, 20), box(401, 300, 700, 120, 20)] });
  assert.equal(duplicate.length, 1);
  assert.equal(duplicate[0].x, 120);
  // A code block inset 40px inside a card keeps its own pane and is marked nested;
  // the outer pane is returned first so it is painted underneath.
  const nested = glassContentPanes({ canvas, boxes: [box(400, 300, 700, 200, 20), box(440, 340, 620, 120, 12)] });
  assert.equal(nested.length, 2);
  assert.equal(nested[0].nested, false);
  assert.equal(nested[1].nested, true);
  assert.ok(nested[0].y < nested[1].y);
  // A 5px inset is the same frame, not a nested surface.
  const tight = glassContentPanes({ canvas, boxes: [box(400, 300, 700, 200, 20), box(405, 305, 690, 190, 18)] });
  assert.equal(tight.length, 2);
  assert.equal(tight[1].nested, false);
});

test('the pane budget keeps the largest boxes and paints in document order', () => {
  const boxes = Array.from({ length: 20 }, (_, index) => box(300, 60 + index * 30, 400 + index * 10, 26, 8));
  const panes = glassContentPanes({ canvas, boxes, max: 16 });
  assert.equal(panes.length, 16);
  const areas = panes.map(pane => pane.width * pane.height);
  const smallestKept = Math.min(...areas);
  for (let index = 0; index < boxes.length; index++) {
    const area = boxes[index].width * boxes[index].height;
    if (area >= smallestKept) continue;
    // Every dropped box is smaller than every kept one.
    assert.ok(panes.every(pane => pane.width * pane.height >= area), 'the cut keeps the larger boxes');
  }
  // Kept panes stay in document order (here: increasing x with the input order).
  for (let i = 1; i < panes.length; i++) assert.ok(panes[i].x >= panes[i - 1].x);
  // A smaller explicit cap is honoured too.
  assert.equal(glassContentPanes({ canvas, boxes, max: 3 }).length, 3);
});

test('the shared sea is downsampled 4–6× and padded for the blur', () => {
  for (const strength of [0, 0.25, 0.55, 0.75, 1]) {
    const factor = glassSeaFactor(strength);
    assert.ok(factor >= 4 && factor <= 6, `factor ${factor} at ${strength}`);
  }
  assert.ok(glassSeaFactor(1) >= glassSeaFactor(0), 'more strength never sharpens the sea');
  const buffer = glassSeaBuffer(1600, 900, { factor: 5, blur: 16 });
  assert.equal(buffer.factor, 5);
  assert.equal(buffer.blurRadius, 16 / 5);
  assert.ok(buffer.pad >= buffer.blurRadius * 2, 'padding gives the blur real pixels from outside the pane');
  assert.equal(buffer.width, Math.ceil(1600 / 5) + buffer.pad * 2);
  assert.equal(buffer.height, Math.ceil(900 / 5) + buffer.pad * 2);
  // A 1920x1080 sea at factor 4 is a fraction of a full-resolution buffer.
  const wide = glassSeaBuffer(1920, 1080, { factor: 4, blur: 18 });
  assert.ok(wide.width * wide.height < 1920 * 1080 / 8, 'the shared blur buffer is small');
  // Degenerate sizes and factors stay usable.
  assert.equal(glassSeaBuffer(0, 0, { factor: 1, blur: 0 }).factor, 2);
  assert.equal(glassSeaBuffer(100, 100, { factor: 99, blur: 0 }).factor, 8);
});

test('content material reuses the base layers and keeps its own visible sea', () => {
  for (const dark of [false, true]) {
    for (const strength of [0, 0.55, 1]) {
      const reading = glassTone(strength, { dark });
      const content = glassContentTone(strength, { dark });
      // The contrast-bearing layers are shared: no second, heavier material.
      for (const key of ['tint', 'veil', 'silhouette']) {
        assert.equal(content[key], reading[key], `${key} is reused from the base material`);
      }
      // The outline belongs to the DOM card: the material carries no stroke
      // colour at all, so this canvas can never draw a second rounded frame with
      // a slightly different radius than the card's own ring.
      assert.equal(content.stroke, undefined);
      assert.equal(reading.stroke, undefined);
      // The blurred sea is stronger than the old pale silhouette (that is what
      // made 0.10.0 invisible) but capped by the budget below.
      assert.ok(content.mist > reading.mist);
      assert.ok(content.mist >= 0.30 && content.mist <= 0.36, `mist ${content.mist}`);
      assert.ok(content.blur >= 9 && content.blur <= 21);
      // The top highlight is a quarter of the reading pane's and a short band.
      const crestAlpha = Number(content.crest.slice(content.crest.lastIndexOf(',') + 1).replace(')', ''));
      const readingCrest = Number(reading.crest.slice(reading.crest.lastIndexOf(',') + 1).replace(')', ''));
      assert.ok(crestAlpha <= readingCrest * 0.25);
      assert.ok(crestAlpha > 0);
      assert.ok(content.crestHeight <= 18);
      assert.ok(content.feather >= 12 && content.feather <= 16);
    }
  }
  assert.equal(glassContentTone(0.55, { reducedTransparency: true }).mode, 'clear');
  assert.equal(glassContentTone(0.55, { enabled: false }).mode, 'clear');
});

/**
 * The pane sits above the DOM text, and the blurred sea now carries real colour
 * (cells) or dark ink (glyphs). Compose the worst case band by band — surface
 * sea, then the flat tint (which the renderer now applies on top of the shared
 * image), then the top highlight or the bottom shade — and require body text to
 * stay above the WCAG AA floor.
 */
test('the content material keeps body text above 4.5:1 over the darkest blurred sea', () => {
  const over = (under, layer, alpha) => under.map((channel, i) => channel * (1 - alpha) + layer[i] * alpha);
  const luminance = rgb => {
    const [r, g, b] = rgb.map(value => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  const parse = text => text.split(',').map(Number);
  const alphaOf = text => Number(text.slice(text.lastIndexOf(',') + 1).replace(')', ''));

  // Darkest colours the blurred sea can contain.
  const cellPalette = createCellPalette('ocean');
  let darkestCell = cellPalette[0];
  for (const entry of cellPalette) if (entry.luminance < darkestCell.luminance) darkestCell = entry;
  const cellsSea = parse(darkestCell.background.slice(darkestCell.background.indexOf('(') + 1, darkestCell.background.indexOf(')')));
  const inkSea = parse(createInkPalette('ocean')[0].slice(createInkPalette('ocean')[0].indexOf('(') + 1,
    createInkPalette('ocean')[0].indexOf(')')));
  const asciiSea = [18, 38, 53];
  const seas = [cellsSea, inkSea, asciiSea];
  let worst = { ratio: Infinity };
  for (const dark of [false, true]) {
    for (const strength of [0, 0.55, 1]) {
      const tone = glassContentTone(strength, { dark });
      const text = dark ? [242, 243, 245] : [15, 15, 15];
      const page = dark ? [21, 21, 23] : [255, 255, 255];
      const tint = parse(tone.tint);
      const crest = alphaOf(tone.crest);
      const shade = alphaOf(tone.shade);
      for (const sea of seas) {
        // The renderer composites one shared sea image, then the per-pane tint on
        // top of it (that is what lets tint + crest + shade share one clip).
        const body = base => over(over(base, sea, tone.mist), tint, tone.veil);
        const withCrest = base => over(body(base), [255, 255, 255], crest);
        const withShade = base => over(body(base), [0, 0, 0], shade);
        for (const [band, layer] of [['body', body], ['crest', withCrest], ['shade', withShade]]) {
          const value = ratio(layer(text), layer(page));
          if (value < worst.ratio) worst = { ratio: value, dark, strength, band, sea };
          assert.ok(value >= 4.5, `${dark ? 'dark' : 'light'} at ${strength} (${band}, sea ${sea}): ${value.toFixed(2)}:1`);
        }
      }
    }
  }
  // Report the binding case through the assertion message if it ever regresses.
  assert.ok(worst.ratio >= 4.5, `worst ${worst.ratio.toFixed(2)}:1 at ${JSON.stringify(worst)}`);
});
