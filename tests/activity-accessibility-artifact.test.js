import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

const artifacts = {
  client: await readFile(new URL('../client.js', import.meta.url), 'utf8'),
  previewHtml: await readFile(new URL('../preview/whale-preview.html', import.meta.url), 'utf8'),
};
const list = id => ({ byId: { [id]: { id, displayTitle: '<b>完整会话名</b>', retainedBy: { mainView: 1 }, running: true } } });
const rows = status => ({ main: [{ id: 'build', label: '完整构建任务名称超过十八字仍然可查询而非被截断', status }] });
const badges = pair => pair.snapshots().host.commands.filter(c => c.op === 'fillText').map(c => c.args[0]);

test('first-use legend is non-modal, persists only an explicit dismissal and tolerates unavailable storage', () => {
  const storage = new Map();
  const open = (extra = {}) => createArtifactPair(artifacts, {}, { reducedMotion: true, storage, ...extra,
    activity: { list: list('main') } });
  let pair = open();
  assert.match(pair.hostText(), /activityLegendNote/);
  assert.ok(pair.hostElements().every(e => e.props.autoFocus !== true && e.props.role !== 'dialog'));
  pair.dispose();
  pair = open();
  assert.match(pair.hostText(), /activityLegendNote/, 'navigation is not acknowledgment');
  pair.click('activityLegendClose');
  assert.doesNotMatch(pair.hostText(), /activityLegendNote/);
  pair.dispose();
  pair = open();
  assert.doesNotMatch(pair.hostText(), /activityLegendNote/);
  pair.dispose();
  pair = open({ origin: 'http://another-host.invalid' });
  assert.match(pair.hostText(), /activityLegendNote/);
  pair.dispose();
  pair = open({ storageFailure: true });
  pair.click('activityLegendClose');
  pair.update({ speed: 0.8 });
  assert.equal(pair.configs().host.speed, 0.8);
  pair.dispose();
});

test('availability is per source, empty job rosters are valid, and unknown scope never adopts other sessions', () => {
  const pair = createArtifactPair(artifacts, {}, { reducedMotion: true, activity: {
    list: { byId: { ...list('main').byId, child: { id: 'child', parentId: 'main', displayTitle: '' } } },
    statusUnavailable: true, jobsUnavailable: true,
  } });
  try {
    assert.match(pair.hostText({ summary: true }), /activityJobsUnavailable/);
    assert.match(pair.hostText({ summary: true }), /activityWaitingUnavailable/);
    assert.match(pair.hostText({ summary: true }), /<b>完整会话名<\/b>.*activityRunning/);
    assert.match(pair.hostText({ summary: true }), /activitySubagent.*activityUnavailable/);
    pair.setHostActivity({ list: { byId: { unrelated: { id: 'unrelated', displayTitle: 'Other', running: true } } } });
    assert.match(pair.hostText({ summary: true }), /activityScopeUnavailable/);
    assert.doesNotMatch(pair.hostText({ summary: true }), /Other|完整会话名/);
    pair.update({ activity: false });
    assert.equal(pair.hostText({ summary: true }), '');
    assert.equal(pair.hostText({ live: true }), '');
  } finally { pair.dispose(); }
  const available = createArtifactPair(artifacts, {}, { reducedMotion: true, activity: { list: list('main') } });
  assert.doesNotMatch(available.hostText({ summary: true }), /activityJobsUnavailable/);
  available.dispose();
});

test('new waiting transitions coalesce, names do not replay, and scope changes cancel pending speech', () => {
  const pair = createArtifactPair(artifacts, {}, { reducedMotion: true, activity: { list: list('main') } });
  const waiting = { running: true, pendingInteraction: { kind: 'approval' } };
  try {
    pair.setHostActivity({ statuses: new Map([['main', waiting]]) });
    pair.setHostActivity({ rows: rows('running') });
    pair.setHostActivity({ rows: rows('failed') });
    pair.advance(8);
    assert.match(pair.hostText({ live: true }), /完整会话名.*activityWaiting.*完整构建任务名称.*activityFailed/);
    const utterance = pair.hostText({ live: true });
    pair.setHostActivity({ list: { byId: { main: { ...list('main').byId.main, displayTitle: 'Renamed' } } } });
    pair.advance(10);
    assert.equal(pair.hostText({ live: true }), utterance);
    pair.setHostActivity({ statuses: new Map([['main', { running: true }]]) });
    pair.setHostActivity({ statuses: new Map([['main', waiting]]) });
    pair.setHostActivity({ list: list('other'), statuses: new Map() });
    pair.advance(10);
    assert.equal(pair.hostText({ live: true }), '');
    assert.deepEqual(pair.watchedJobs(), ['other']);
  } finally { pair.dispose(); }
  assert.deepEqual(pair.watchedJobs(), []);
});

test('hidden pages freeze result life while new events still update the accessible summary', () => {
  const pair = createArtifactPair(artifacts, { count: 1, glass: false }, {
    reducedMotion: true, activity: { list: list('main') },
  });
  try {
    pair.setHostActivity({ rows: rows('running') });
    pair.setReducedMotion(false);
    pair.setHidden(true);
    pair.setHostActivity({ rows: rows('failed') });
    assert.match(pair.hostText({ summary: true }), /activityFailed/);
    pair.advance(500);
    assert.match(pair.hostText({ summary: true }), /activityFailed/);
    pair.setReducedMotion(true);
    pair.setHidden(false);
    assert.ok(badges(pair).some(t => t.startsWith('× ')), 'visibility restore paints the newest static result');
    assert.match(pair.hostText({ summary: true }), /activityFailed/);
  } finally { pair.dispose(); }
});

test('shipped accessible text shares badge semantics, full names, overflow and bounded polite announcements', () => {
  const pair = createArtifactPair(artifacts, { count: 1, glass: false, quietCenter: false }, {
    reducedMotion: true, activity: { list: list('main') },
  });
  try {
    assert.match(pair.hostText(), /<b>完整会话名<\/b>.*activityRunning/);
    assert.equal(pair.hostText({ live: true }), '');
    pair.setHostActivity({ rows: rows('running') });
    assert.match(pair.hostText(), /完整构建任务名称超过十八字仍然可查询而非被截断/);
    assert.match(pair.hostText(), /activityOverflow 1/);
    pair.setHostActivity({ rows: rows('completed') });
    assert.ok(badges(pair).some(t => t.startsWith('✓ ')));
    pair.advance(8);
    assert.match(pair.hostText({ live: true }), /完整构建任务名称超过十八字仍然可查询而非被截断.*activityCompleted/);
    const spoken = pair.hostText({ live: true });
    pair.advance(800);
    assert.equal(pair.hostText({ live: true }), spoken, 'reduced motion freezes the result without frame announcements');
    assert.match(pair.hostText(), /activityCompleted/);
    pair.setReducedMotion(false);
    pair.advance(365);
    assert.doesNotMatch(pair.hostText({ summary: true }), /activityCompleted/);
    assert.ok(!badges(pair).some(t => t.startsWith('✓ ')));
    pair.setHostActivity({ rows: rows('completed') });
    assert.equal(pair.hostText({ live: true }), spoken, 'duplicate completion never replays');
    pair.setHostActivity({ statuses: new Map([['main', { running: true, pendingInteraction: {} }]]) });
    pair.update({ activity: false });
    pair.advance(10);
    assert.equal(pair.hostText({ live: true }), '');
    assert.deepEqual(pair.watchedJobs(), []);
    assert.doesNotMatch(pair.hostText(), /activityUnavailable|activityWaiting/);
  } finally { pair.dispose(); }
});
