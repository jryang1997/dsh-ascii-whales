import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

const artifacts = {
  client: await readFile(new URL('../client.js', import.meta.url), 'utf8'),
  previewHtml: await readFile(new URL('../preview/whale-preview.html', import.meta.url), 'utf8'),
};
const list = id => ({ byId: { [id]: { id, displayTitle: '主会话', retainedBy: { mainView: 1 }, running: false } } });
const text = pair => pair.snapshots().host.commands.filter(c => c.op === 'fillText').map(c => c.args[0]);

test('the shipped overlay receives root pending-interaction updates without remounting and releases job rosters', () => {
  const pair = createArtifactPair(artifacts, { glass: false, quietCenter: false, spout: false }, {
    reducedMotion: true, activity: { list: list('main') },
  });
  try {
    const original = pair.snapshots().host;
    assert.deepEqual(pair.watchedJobs(), ['main']);
    pair.setHostActivity({ statuses: new Map([['main', { running: true, pendingInteraction: { kind: 'approval' } }]]) });
    assert.ok(text(pair).some(t => t === '! 主会话'));
    const after = pair.snapshots().host;
    assert.deepEqual(after.commands.filter(c => c.op === 'fillText' && c.args[0] !== '! 主会话'),
      original.commands.filter(c => c.op === 'fillText'), 'reduced motion still repaints status while preserving the exact whale pose');
    assert.equal(pair.retainedCanvases(), true);
    pair.update({ activity: false });
    assert.ok(!text(pair).some(t => t.startsWith('! ')));
    assert.deepEqual(pair.watchedJobs(), []);
    pair.update({ activity: true });
    assert.deepEqual(pair.watchedJobs(), ['main']);
    pair.setHostActivity({ list: list('other'), statuses: new Map() });
    assert.deepEqual(pair.watchedJobs(), ['other']);
    assert.ok(!text(pair).some(t => t.startsWith('! ')));
  } finally { pair.dispose(); }
  assert.deepEqual(pair.watchedJobs(), []);
});

test('the shipped overlay shows a real job transition once, then removes its result after six simulation seconds', () => {
  const pair = createArtifactPair(artifacts, { glass: false, quietCenter: false, spout: false }, {
    activity: { list: list('main'), rows: { main: [{ id: 'old', label: '旧任务', status: 'completed' }] } },
  });
  try {
    assert.ok(!text(pair).some(t => t.includes('旧任务')));
    pair.setHostActivity({ rows: { main: [{ id: 'build', label: '构建', status: 'running' }] } });
    assert.ok(text(pair).includes('···'));
    pair.setHostActivity({ rows: { main: [{ id: 'build', label: '构建', status: 'completed' }] } });
    assert.ok(text(pair).includes('✓ 构建'));
    pair.advance(400);
    assert.ok(!text(pair).includes('✓ 构建'));
    pair.setHostActivity({ rows: { main: [{ id: 'build', label: '构建', status: 'completed' }] } });
    assert.ok(!text(pair).includes('✓ 构建'));
    assert.equal(pair.retainedCanvases(), true);
  } finally { pair.dispose(); }
});
