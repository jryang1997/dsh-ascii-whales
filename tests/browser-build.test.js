import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext, Script } from 'node:vm';
import { assembleBrowser, writeArtifact } from '../scripts/browser-build.mjs';
import { createHash } from 'node:crypto';
import { createArtifactPair } from './helpers/artifact-render-harness.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'whale-build-'));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  return { directory, root: pathToFileURL(directory + sep) };
}

test('both browser entry graphs produce stable self-contained scripts', async () => {
  const a = await assembleBrowser('src/browser-entry.js');
  assert.equal(a, await assembleBrowser('src/browser-entry.js'));
  assert.equal(a, await readFile(new URL('../client.js', import.meta.url), 'utf8'));
  new Script(a);
  const preview = await assembleBrowser('preview/preview-client.js');
  assert.equal(preview, await assembleBrowser('preview/preview-client.js'));
  new Script(preview);
  const html = await readFile(new URL('../preview/whale-preview.html', import.meta.url), 'utf8');
  assert.ok(html.includes(preview.replace(/<\/script/gi, '<\\/script')));
});

test('the shipped plugin registers host slots and both dictionaries through its real factory', async () => {
  let registration;
  runInNewContext(await assembleBrowser('src/browser-entry.js'), {
    window: { __ModuleLoader__: { load(value) { registration = value; } } },
  });
  assert.equal(registration.id, '@local/dsh-ascii-ocean');
  const plugin = registration.factory(name => {
    assert.equal(name, 'react');
    return { createElement() {} };
  });
  assert.deepEqual(Array.from(plugin.inject), ['slots', 'locale', 'configForms']);
  const locales = [], slots = [], forms = [];
  plugin.apply({
    configForms: { get(id) { forms.push(id); return {}; } },
    effect: callback => callback(),
    locale: { register: (...args) => locales.push(args), bind: () => key => key },
    slots: { inject: (_name, callback) => callback(), register: (slot, view) => slots.push({ slot, view }) },
  });
  assert.deepEqual(forms, ['ascii-whale-background']);
  assert.deepEqual(locales.map(item => item[1]), ['en', 'zh']);
  assert.ok(locales.every(item => item[2].save && item[2].stylePreview));
  assert.deepEqual(slots.map(item => item.slot.name), ['shell.overlay', 'plugins.bundle.config']);
  assert.ok(slots.every(item => typeof item.view === 'function'));
});

test('dependency resolution handles multiline aliases and colliding private helper names', async t => {
  const { directory, root } = await fixture(t);
  await writeFile(join(directory, 'a.js'), 'const helper = 3; export const value = helper;');
  await writeFile(join(directory, 'b.js'), 'const helper = 7; export const value = helper;');
  await writeFile(join(directory, 'entry.js'), "import {\n value as a\n} from './a.js';\nimport {value as b} from './b.js'; window.result = [a, b];");
  const window = {};
  runInNewContext(await assembleBrowser('entry.js', root), { window });
  assert.deepEqual(Array.from(window.result), [3, 7]);
});

test('artifact checks never overwrite stale files and identical builds preserve timestamps', async t => {
  const { directory } = await fixture(t), target = pathToFileURL(join(directory, 'artifact.js'));
  assert.equal(await writeArtifact(target, 'one'), true);
  const before = (await stat(target)).mtimeMs;
  assert.equal(await writeArtifact(target, 'one'), false);
  assert.equal((await stat(target)).mtimeMs, before);
  await writeArtifact(target, 'one', { check: true });
  await assert.rejects(writeArtifact(target, 'two', { check: true }), /stale/);
  assert.equal(await readFile(target, 'utf8'), 'one');
  assert.equal((await stat(target)).mtimeMs, before);
});

async function shippedArtifacts() {
  const root = new URL('../', import.meta.url);
  const [client, previewHtml] = await Promise.all(['client.js', 'preview/whale-preview.html']
    .map(name => readFile(new URL(name, root), 'utf8')));
  return { client, previewHtml };
}

const drawingHash = frame => createHash('sha256').update(JSON.stringify(frame)).digest('hex');
function assertDrawingEqual(pair, message) {
  const configs = pair.configs();
  assert.deepEqual(configs.host, configs.preview, 'both public entries received the intended supported configuration');
  const { host, preview } = pair.snapshots();
  for (const [entry, frame] of Object.entries({ host, preview })) {
    assert.ok(frame.commands.filter(command => command.op === 'fillText').length > 25,
      `${entry} must draw actual live glyphs before command streams are compared`);
  }
  assert.equal(drawingHash(host), drawingHash(preview), message);
  return host;
}
function commandsIn(frame) {
  return frame.commands.flatMap(command => [command,
    ...(command.op === 'drawImage' ? commandsIn(command.args[0]) : [])]);
}
// The glass buffer contains the glyph sea; cloud buffers contain only texel fills.
const glassImagesIn = frame => frame.commands.filter(command => command.op === 'drawImage'
  && commandsIn(command.args[0]).some(nested => nested.op === 'fillText'));

test('shipped entries draw the same moving school across custom/ascii edits and a shared pause', async t => {
  const pair = createArtifactPair(await shippedArtifacts(), {
    species: 'blue', count: 2, glass: false, composerAvoid: false,
    renderStyle: 'glyphs', fillMode: 'custom', text: '鲸海', whaleSize: 1,
  });
  t.after(() => pair.dispose());
  const initial = assertDrawingEqual(pair, 'initial public mounts draw the same glyphs, coordinates and styles');
  assert.equal(pair.config().clouds, true, 'the default moving-school comparison includes cloud shadows');
  assert.ok(initial.commands.some(command => command.op === 'drawImage'), 'the default cloud image reaches both public entries');
  assert.ok(initial.commands.filter(command => command.op === 'fillText').length > 100);
  assert.ok(initial.commands.some(command => command.op === 'fillText' && command.args[0] === '鲸'));
  pair.advance(24);
  const moving = assertDrawingEqual(pair, 'controlled clocks advance both generated renderers identically');
  assert.notEqual(drawingHash(moving), drawingHash(initial), 'the comparison observes an actually moving school');
  pair.update({ text: '深鲸', fillMode: 'ascii', renderStyle: 'cells', whaleSize: 1.2 });
  const updated = assertDrawingEqual(pair, 'form snapshots and real preview input handlers produce equivalent updates');
  assert.notEqual(drawingHash(updated), drawingHash(moving), 'edits change actual output rather than only the controls');
  assert.ok(updated.commands.some(command => command.op === 'fillRect'), 'ASCII cells really reach the drawing sink');
  assert.ok(pair.retainedCanvases(), 'updates retain the mounted public Canvas instances');
  pair.pause();
  const paused = assertDrawingEqual(pair, 'reduced motion is the shared supported pause condition');
  pair.advance(60);
  assert.equal(drawingHash(assertDrawingEqual(pair, 'both artifacts remain paused')), drawingHash(paused));
  pair.update({ species: 'humpback' });
  const pausedEdit = assertDrawingEqual(pair, 'configuration changes still redraw a paused mounted layer');
  assert.notEqual(drawingHash(pausedEdit), drawingHash(paused), 'pause does not suppress real configuration edits');
});

test('shipped entries share dark/light glass buffers, card masking and avoidance transitions', async t => {
  const pair = createArtifactPair(await shippedArtifacts(), {
    species: 'blue', count: 1, glass: true, composerAvoid: false,
    renderStyle: 'glyphs', fillMode: 'custom', text: '鲸', dark: true,
  });
  t.after(() => pair.dispose());
  const initial = assertDrawingEqual(pair, 'dark glass composites the same offscreen sea through both entries');
  const all = commandsIn(initial);
  assert.equal(glassImagesIn(initial).length, 1, 'glass composites one shared glyph-sea image');
  assert.ok(all.filter(command => command.op === 'fillText').length > 100, 'nested sea glyphs are recorded too');
  assert.ok(all.some(command => command.state.fillStyle?.kind === 'linear-gradient'), 'glass gradient colors/stops are observed');
  pair.advance(12);
  assertDrawingEqual(pair, 'glass uses the same advancing sea, not a static registration-only check');
  pair.update({ composerAvoid: true });
  const avoided = assertDrawingEqual(pair, 'last-enabled avoidance disables glass consistently');
  assert.equal(pair.config().glass, false);
  assert.equal(glassImagesIn(avoided).length, 0, 'avoidance removes the glass image');
  assert.ok(avoided.commands.some(command => command.op === 'drawImage'), 'cloud shadows remain active without glass');
  pair.update({ dark: false });
  const light = assertDrawingEqual(pair, 'theme observers and DOM handlers reach the live renderer');
  assert.notEqual(drawingHash(light), drawingHash(avoided), 'theme changes actual drawing styles');
  pair.update({ glass: true });
  const frosted = assertDrawingEqual(pair, 'glass can be enabled again after avoidance');
  assert.equal(pair.config().composerAvoid, false);
  assert.equal(glassImagesIn(frosted).length, 1, 'reenabling glass restores its shared glyph-sea image');
});

test('drawing comparison detects an output mutation in only one in-memory shipped artifact', async t => {
  const artifacts = await shippedArtifacts();
  // A public Canvas sink mutation changes the preview glyphs. Neither the disk
  // artifact, host renderer nor comparison/recording adapter is changed.
  const mutated = artifacts.previewHtml.replace(/(<script\b[^>]*>)/i, `$1\n{
    const ink = document.getElementById('live').getContext('2d');
    const original = ink.fillText;
    ink.fillText = function(glyph, ...args) { return original.call(this, String(glyph) + '!', ...args); };
  }\n`);
  assert.notEqual(mutated, artifacts.previewHtml);
  const pair = createArtifactPair({ ...artifacts, previewHtml: mutated }, { glass: false, fillMode: 'custom', text: '鲸' });
  t.after(() => pair.dispose());
  const { host, preview } = pair.snapshots();
  assert.ok(host.commands.some(command => command.op === 'fillText' && command.args[0] === '鲸'));
  assert.ok(preview.commands.some(command => command.op === 'fillText' && command.args[0] === '鲸!'));
  assert.deepEqual(pair.configs().host, pair.configs().preview);
  assert.throws(() => assertDrawingEqual(pair, 'one artifact emits altered glyphs'), { code: 'ERR_ASSERTION' });
});
