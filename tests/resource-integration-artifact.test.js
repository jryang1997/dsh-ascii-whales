import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

const artifacts = {
  client: await readFile(new URL('../client.js', import.meta.url), 'utf8'),
  previewHtml: await readFile(new URL('../preview/whale-preview.html', import.meta.url), 'utf8'),
};
const list = { byId: { main: { id: 'main', displayTitle: 'Main', retainedBy: { mainView: 1 }, running: true } } };
const jobs = status => ({ main: [{ id: 'build', label: 'Bound build', status }] });
const glyphs = pair => pair.snapshots().host.commands.filter(command => command.op === 'fillText').map(command => command.args[0]);
const preset = (pair, value) => pair.hostElements().find(element => element.type === 'select'
  && element.props['aria-describedby']?.endsWith('preset-hint')).props.onChange({ target: { value } });
const pressed = (pair, option) => pair.hostElements().find(element => element.type === 'button' && element.props.children.includes(option)).props['aria-pressed'];

test('mounted presets, reset and legend acknowledgment preserve economy and personal preferences through saves', async () => {
  const pair = createArtifactPair(artifacts, { resourceMode: 'economy', text: 'Personal whale', leftInset: 137, glass: false, composerAvoid: true },
    { reducedMotion: true, settings: true, activity: { list } });
  try {
    for (const scene of ['rainy', 'minimal', 'night', 'default']) {
      preset(pair, scene);
      assert.equal(pressed(pair, 'economy'), true);
      assert.equal(pair.form.getSnapshot().value.resourceMode, 'economy');
    }
    await pair.click('activityLegendClose');
    await pair.submitSettings();
    assert.equal(pair.form.getSnapshot().value.resourceMode, 'economy');
    assert.equal(pair.form.getSnapshot().value.text, 'Personal whale');
    assert.equal(pair.form.getSnapshot().value.leftInset, 137);
    assert.equal(pair.form.getSnapshot().value.composerAvoid, true);
    assert.equal(pair.form.getSnapshot().value.legendSeen, true);
    await pair.click('reset');
    assert.equal(pair.form.getSnapshot().value.resourceMode, 'economy', 'reset changes only the draft');
    assert.equal(pressed(pair, 'standard'), true);
    await pair.submitSettings();
    assert.equal(pair.form.getSnapshot().value.resourceMode, 'standard');
    assert.equal(pair.form.getSnapshot().value.legendSeen, true);
    assert.ok(pair.formWrites.slice(1).flat().every(operation => operation.path[0] !== 'legendSeen'));
  } finally { pair.dispose(); }
});

test('mounted economy scene draft survives failed saves and conflicting host revisions until explicit reload', async () => {
  const pair = createArtifactPair(artifacts, {}, { reducedMotion: true, settings: true, legendSeen: true, activity: { list } });
  try {
    await pair.click('economy');
    preset(pair, 'rainy');
    pair.editSetting('text', 'Unsaved personal whale');
    const mutate = pair.form.mutate;
    pair.form.mutate = async () => { throw new Error('Host write offline'); };
    await pair.submitSettings();
    assert.match(pair.hostText(), /failed/);
    assert.equal(pressed(pair, 'economy'), true);
    assert.equal(pair.form.getSnapshot().value.resourceMode, 'standard');
    pair.form.mutate = mutate;
    await pair.form.mutate([{ op: 'set', path: ['opacity'], value: 0.33 }], pair.form.getSnapshot().revision);
    await pair.submitSettings();
    assert.match(pair.hostText(), /conflict/);
    assert.equal(pressed(pair, 'economy'), true);
    assert.equal(pair.hostElements().find(element => element.type === 'input' && element.props.type === 'text').props.value, 'Unsaved personal whale');
    assert.equal(pair.form.getSnapshot().value.opacity, 0.33);
    assert.equal(pair.form.getSnapshot().value.rain, false);
    await pair.click('discard');
    assert.equal(pressed(pair, 'standard'), true);
    assert.equal(pair.hostElements().find(element => element.type === 'input' && element.props.type === 'text').props.value, pair.form.getSnapshot().value.text);
    assert.equal(pair.form.getSnapshot().value.legendSeen, true);
  } finally { pair.dispose(); }
});

test('shipped mode changes keep job identity and the original six seconds without replaying announcements', () => {
  const pair = createArtifactPair(artifacts, { count: 2, glass: false, resourceMode: 'standard' }, { activity: { list } });
  try {
    pair.setHostActivity({ rows: jobs('running') });
    pair.setHostActivity({ rows: jobs('completed') });
    pair.advance(120);
    assert.match(pair.hostText({ summary: true }), /Bound build.*activityCompleted/);
    const spoken = pair.hostText({ live: true });
    pair.update({ resourceMode: 'economy', text: 'Retained school' });
    pair.advance(200);
    assert.match(pair.hostText({ summary: true }), /Bound build.*activityCompleted/);
    assert.ok(glyphs(pair).some(glyph => glyph.startsWith('✓ Bound build')));
    assert.equal(pair.hostText({ live: true }), spoken);
    assert.deepEqual(pair.watchedJobs(), ['main']);
    assert.equal(pair.retainedCanvases(), true);
    pair.update({ resourceMode: 'standard' });
    pair.advance(50);
    assert.doesNotMatch(pair.hostText({ summary: true }), /activityCompleted/);
    assert.ok(!glyphs(pair).some(glyph => glyph.startsWith('✓ Bound build')));
    assert.equal(pair.hostText({ live: true }), spoken);
  } finally { pair.dispose(); }
  assert.deepEqual(pair.watchedJobs(), []);
});

test('shipped economy summary and Canvas meet the logical 250ms fixture budget with simulated React and time', () => {
  for (const reducedMotion of [false, true]) {
    const pair = createArtifactPair(artifacts, { resourceMode: 'economy', glass: false }, { reducedMotion, activity: { list } });
    try {
      pair.setHostActivity({ rows: jobs('running') });
      for (let index = 0; index < 50; index++) pair.setHostActivity({ statuses: new Map([['main', { running: true, ...(index % 2 ? { pendingInteraction: { kind: 'approval' } } : {}) }]]) });
      assert.match(pair.hostText({ summary: true }), /Main.*activityWaiting/);
      pair.advance(1);
      assert.ok(glyphs(pair).some(glyph => glyph.startsWith('! Main')), 'Canvas endpoint completes on the first 16.7ms fixture frame');
      pair.advance(13);
      assert.match(pair.hostText({ live: true }), /Main.*activityWaiting/);
      const spoken = pair.hostText({ live: true });
      pair.update({ resourceMode: 'standard' });
      pair.advance(30);
      assert.equal(pair.hostText({ live: true }), spoken);
    } finally { pair.dispose(); }
  }
});
