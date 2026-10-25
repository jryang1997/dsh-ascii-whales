import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

const artifacts = {
  client: await readFile(new URL('../client.js', import.meta.url), 'utf8'),
  previewHtml: await readFile(new URL('../preview/whale-preview.html', import.meta.url), 'utf8'),
};
const waveGlyphs = new Set(['~', '·', '˙', "'", ';']);
const waves = pair => pair.snapshots().host.commands.filter(command => command.op === 'fillText'
  && waveGlyphs.has(command.args[0]));
const initial = { count: 1, text: '鲸', glyphSize: 16, glass: false, composerAvoid: false,
  quietCenter: false, wind: false, clouds: false, rain: false, ripples: false, spout: false, activity: false };

for (const channel of ['primary', 'fallback']) {
  test(`shipped overlay reads ${channel} microphone levels into live waves without remounting`, () => {
    const pair = createArtifactPair(artifacts, initial, { dictation: channel });
    try {
      assert.equal(waves(pair).length, 0);
      pair.setDictation({ phase: 'recording', seq: 1 }, 0.005);
      pair.advance(65);
      assert.ok(waves(pair).length > 0, 'quiet microphone input reaches actual shipped Canvas commands');
      pair.setDictationLevel(0.08);
      pair.advance(35);
      assert.ok(waves(pair).length > 0, 'a live level pull works without a semantic notification');
      assert.equal(pair.retainedCanvases(), true);
      pair.setDictation({ phase: 'processing', seq: 2 }, 0.08);
      pair.advance(35);
      assert.equal(waves(pair).length, 0, 'transcription never keeps shaking the sea');
      pair.setDictation({ phase: 'done', seq: 3 }, 0);
      assert.equal(pair.retainedCanvases(), true);
    } finally { pair.dispose(); }
  });
}

test('switching a recording overlay to reduced motion removes existing waves immediately', () => {
  const pair = createArtifactPair(artifacts, initial, { dictation: 'primary' });
  try {
    pair.setDictation({ phase: 'recording', seq: 1 }, 0.08);
    pair.advance(65);
    assert.ok(waves(pair).length > 0);
    pair.pause();
    assert.equal(waves(pair).length, 0, 'existing live fronts must disappear on the static repaint');
    pair.advance(20);
    assert.equal(waves(pair).length, 0);
    assert.equal(pair.retainedCanvases(), true);
  } finally { pair.dispose(); }
});

test('shipped reduced-motion overlay stays still while receiving microphone levels', () => {
  const pair = createArtifactPair(artifacts, initial, { dictation: 'primary', reducedMotion: true });
  try {
    pair.setDictation({ phase: 'recording', seq: 1 }, 0.08);
    pair.advance(65);
    assert.equal(waves(pair).length, 0);
    assert.equal(pair.retainedCanvases(), true);
  } finally { pair.dispose(); }
});
