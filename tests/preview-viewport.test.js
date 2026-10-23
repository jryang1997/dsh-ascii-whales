import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhaleLayer } from '../src/engine.js';
import { DEFAULTS } from '../src/model.js';

function environment(t) {
  const saved = new Map();
  const install = (key, value) => { saved.set(key, globalThis[key]); globalThis[key] = value; };
  const observers = [];
  install('window', { devicePixelRatio: 1, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} });
  install('document', { hidden: false, body: { hasAttribute: () => false }, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} });
  install('ResizeObserver', class { constructor(callback) { observers.push(callback); } observe() {} disconnect() {} });
  install('MutationObserver', class { observe() {} disconnect() {} });
  install('requestAnimationFrame', () => 1);
  install('cancelAnimationFrame', () => {});
  t.after(() => { for (const [key,value] of saved) value === undefined ? delete globalThis[key] : globalThis[key] = value; });
  function canvas(width, height) {
    const box = { left: 0, top: 0, width, height };
    const glyphs = [], clears = [];
    let transform = [1,0,0,1,0,0];
    const ink = {
      font: '', globalAlpha: 1,
      setTransform(...values) { transform = values; },
      clearRect(...values) { glyphs.length = 0; clears.push({ values, transform: [...transform] }); },
      measureText() { const size = Number(this.font.match(/([\d.]+)px/)[1]); return { width: size, actualBoundingBoxAscent: size * .8, actualBoundingBoxDescent: size * .2 }; },
      fillText(text,x,y) { glyphs.push({text,x,y,font:this.font,transform:[...transform]}); },
      fillRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, fill() {}, clip() {},
    };
    const element = {width:300,height:150,getContext:()=>ink,getBoundingClientRect:()=>box};
    return {element,box,glyphs,clears,resize(w,h){box.width=w;box.height=h;for(const callback of observers)callback();}};
  }
  return canvas;
}
const config = { ...DEFAULTS, count: 1, species: 'blue', glass: false, composerAvoid: false, reefs: false, ripples: false, wind: false, clouds: false, spout: false, quietCenter: false };

test('preview preserves the background glyph density at character sizes 4, 11 and 16', t => {
  const canvas = environment(t);
  for (const glyphSize of [4,11,16]) {
    const background = canvas(1640,937), preview = canvas(556,432);
    const a = createWhaleLayer(background.element,{...config,glyphSize});
    const b = createWhaleLayer(preview.element,{...config,glyphSize},{viewport:()=>({width:1640,height:937})});
    assert.ok(background.glyphs.length > 30);
    assert.equal(preview.glyphs.length,background.glyphs.length,`glyph ${glyphSize}: preview shrank the whale but kept full-size glyphs`);
    assert.deepEqual(preview.glyphs.map(p=>p.text),background.glyphs.map(p=>p.text));
    const transform=preview.glyphs[0].transform, scale=556/1640;
    assert.ok(Math.abs(transform[0]-scale)<1e-9 && transform[0]===transform[3], 'whales and characters need one uniform scale');
    assert.ok(Math.abs(transform[5]-(432-937*scale)/2)<1e-8);
    assert.equal(preview.element.width,556);
    assert.equal(preview.element.height,432);
    assert.equal(preview.glyphs[0].font,background.glyphs[0].font);
    a.dispose();b.dispose();
  }
});

test('a portrait preview letterboxes, clears its whole bitmap and keeps glyph density after resize/update', t => {
  const canvas=environment(t), preview=canvas(280,520);
  const viewport={width:1200,height:800};
  const layer=createWhaleLayer(preview.element,config,{viewport:()=>viewport});
  const count=preview.glyphs.length;
  assert.ok(preview.glyphs[0].transform[0]<.3);
  preview.resize(600,300);
  assert.equal(preview.glyphs.length,count);
  assert.equal(preview.glyphs[0].transform[0],.375);
  assert.equal(preview.glyphs[0].transform[4],75);
  assert.deepEqual(preview.clears.at(-1),{values:[0,0,600,300],transform:[1,0,0,1,0,0]});
  layer.update({...config,glyphSize:16});
  assert.match(preview.glyphs[0].font,/16px/);
  assert.ok(preview.glyphs.length<count);
  layer.dispose();
  assert.equal(preview.element.width,1);
});
