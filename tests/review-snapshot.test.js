import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, readdir, lstat, readlink, realpath, rm, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewSnapshot } from '../scripts/review-snapshot.mjs';
import { readProbe } from '../scripts/read-probe.mjs';

const execute = promisify(execFile);
const reviewCLI = fileURLToPath(new URL('../scripts/review-snapshot.mjs', import.meta.url));
const probeCLI = fileURLToPath(new URL('../scripts/read-probe.mjs', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function command(file, args, cwd) {
  return execute(file, args, { cwd, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
}
async function git(root, ...args) { return (await command('git', args, root)).stdout.replace(/\r?\n$/, ''); }
async function commit(root, title) {
  await git(root, '-c', 'user.name=Review Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '-m', title);
  return git(root, 'rev-parse', 'HEAD');
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'whale-review-tools-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('whale-review-tools-'));
    await rm(root, { recursive: true, force: true });
  });
  await git(root, 'init', '--initial-branch=main');
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'preview'));
  for (const [name, body] of Object.entries({ 'AGENTS.md': '# Rules\n', 'src/engine.js': 'export const engine = 1;\n',
    '.gitignore': '.scratch/\n', 'mixed.txt': 'original mixed\n', 'staged.txt': 'original staged\n',
    'deleted.txt': 'remove me\n', 'old 中文 name.txt': 'rename content\n', 'client.js': 'old generated\n' })) {
    await writeFile(join(root, name), body);
  }
  await git(root, 'add', '.');
  const base = await commit(root, 'initial fixture');
  return { root, base };
}
async function repoState(root) {
  const files = {};
  async function visit(directory, prefix = '') {
    for (const name of (await readdir(directory)).sort()) {
      const relative = prefix + name, path = join(directory, name), info = await lstat(path);
      if (info.isDirectory()) await visit(path, relative + '/');
      else files[relative] = { hash: sha256(info.isSymbolicLink() ? Buffer.from(await readlink(path)) : await readFile(path)),
        mtimeMs: info.mtimeMs };
    }
  }
  await visit(root);
  return files;
}

test('review snapshot includes index, worktree, renames, deletions and every non-ignored new file without writing', async t => {
  const { root, base } = await fixture(t);
  await writeFile(join(root, 'mixed.txt'), 'staged mixed\n');
  await writeFile(join(root, 'staged.txt'), 'staged only\n');
  await git(root, 'add', 'mixed.txt', 'staged.txt');
  await writeFile(join(root, 'mixed.txt'), 'unstaged mixed\n');
  await rm(join(root, 'deleted.txt'));
  await git(root, 'mv', 'old 中文 name.txt', 'renamed 中文 file.txt');
  await writeFile(join(root, 'client.js'), 'new generated\n');
  await writeFile(join(root, 'new 中文 file.txt'), Buffer.from([0, 255, 10, 65]));
  await writeFile(join(root, 'preview/whale-preview.html'), '<html>new</html>');
  await mkdir(join(root, '.scratch'));
  await writeFile(join(root, '.scratch', 'ignored.test.js'), 'ignored');
  const unusual = process.platform === 'win32' ? 'space name.txt' : 'line\nbreak 中文.txt';
  await writeFile(join(root, unusual), 'unusual filename');
  const before = await repoState(root);
  const report = await reviewSnapshot({ root, base });
  assert.deepEqual(await repoState(root), before, 'including index bytes and timestamps');
  assert.equal(report.baseCommit, base);
  assert.equal(report.mergeBase, base);
  assert.equal(report.head, base);
  assert.deepEqual(report.commits, []);
  const files = new Map(report.files.map(file => [file.path, file]));
  assert.equal(files.get('mixed.txt').worktreeStatus, 'MM');
  assert.equal(files.get('mixed.txt').staged, true);
  assert.equal(files.get('mixed.txt').unstaged, true);
  assert.equal(files.get('mixed.txt').sha256, sha256(Buffer.from('unstaged mixed\n')));
  assert.equal(files.get('staged.txt').worktreeStatus, 'M ');
  assert.equal(files.get('deleted.txt').status, 'D');
  assert.equal(files.get('deleted.txt').sha256, null);
  assert.equal(files.get('deleted.txt').bytes, null);
  assert.equal(files.get('renamed 中文 file.txt').oldPath, 'old 中文 name.txt');
  assert.match(files.get('renamed 中文 file.txt').status, /^R/);
  assert.equal(files.has('old 中文 name.txt'), false, 'rename source is metadata, not a duplicate current file');
  assert.equal(files.get('new 中文 file.txt').untracked, true);
  assert.equal(files.get('new 中文 file.txt').bytes, 4);
  assert.equal(files.get('new 中文 file.txt').sha256, sha256(Buffer.from([0, 255, 10, 65])));
  assert.equal(files.get('client.js').generated, true);
  assert.equal(files.get('preview/whale-preview.html').generated, true);
  assert.ok(files.has(unusual));
  assert.equal(files.get('new 中文 file.txt').generated, false);
  assert.ok(!report.files.some(file => file.path.startsWith('.scratch/')));
  const cli = JSON.parse((await command(process.execPath, [reviewCLI, '--base', base, '--root', root], tmpdir())).stdout);
  assert.deepEqual(cli.files, report.files);
  assert.deepEqual(await repoState(root), before);
});

test('staged and unstaged cancellation remains visible even with no net baseline diff', async t => {
  const { root } = await fixture(t);
  await writeFile(join(root, 'mixed.txt'), 'staged replacement\n');
  await writeFile(join(root, 'added then deleted.txt'), 'staged new file\n');
  await git(root, 'add', 'mixed.txt', 'added then deleted.txt');
  await writeFile(join(root, 'mixed.txt'), 'original mixed\n');
  await rm(join(root, 'added then deleted.txt'));
  const before = await repoState(root);
  const report = await reviewSnapshot({ root });
  const files = new Map(report.files.map(file => [file.path, file]));
  assert.equal(files.get('mixed.txt').worktreeStatus, 'MM');
  assert.equal(files.get('mixed.txt').staged, true);
  assert.equal(files.get('mixed.txt').unstaged, true);
  assert.equal(files.get('mixed.txt').sha256, sha256(Buffer.from('original mixed\n')));
  assert.equal(files.get('added then deleted.txt').status, 'AD');
  assert.equal(files.get('added then deleted.txt').worktreeStatus, 'AD');
  assert.equal(files.get('added then deleted.txt').staged, true);
  assert.equal(files.get('added then deleted.txt').unstaged, true);
  assert.equal(files.get('added then deleted.txt').sha256, null);
  assert.deepEqual(await repoState(root), before);
});

test('clean worktrees retain committed changes since the fixed merge-base and normalize subdirectory cwd', async t => {
  const { root, base } = await fixture(t);
  await writeFile(join(root, 'src/engine.js'), 'export const engine = 2;\n');
  await git(root, 'add', 'src/engine.js');
  const head = await commit(root, 'changed renderer');
  await mkdir(join(root, 'nested'));
  const before = await repoState(root);
  const output = JSON.parse((await command(process.execPath, [reviewCLI, '--base', base], join(root, 'nested'))).stdout);
  // Windows runners may expose TEMP via an 8.3 alias while Git returns its long path.
  assert.equal(await realpath(output.root), await realpath(root));
  assert.equal(output.head, head);
  assert.equal(output.mergeBase, base);
  assert.deepEqual(output.commits, [{ hash: head, subject: 'changed renderer' }]);
  assert.equal(output.files.length, 1);
  assert.equal(output.files[0].path, 'src/engine.js');
  assert.equal(output.files[0].worktreeStatus, '  ');
  assert.equal(output.files[0].staged, false);
  assert.equal(output.files[0].unstaged, false);
  const defaultBase = await reviewSnapshot({ root });
  assert.equal(defaultBase.requestedBase, 'HEAD');
  assert.deepEqual(defaultBase.files, []);
  assert.deepEqual(await repoState(root), before);
});

test('diverged base refs are resolved as commits while the actual comparison uses their common ancestor', async t => {
  const { root, base } = await fixture(t);
  await git(root, 'switch', '-c', 'other');
  await writeFile(join(root, 'other.txt'), 'other branch');
  await git(root, 'add', '.');
  const other = await commit(root, 'other branch commit');
  await git(root, 'switch', 'main');
  await writeFile(join(root, 'main.txt'), 'main branch');
  await git(root, 'add', '.');
  const head = await commit(root, 'main branch commit');
  const report = await reviewSnapshot({ root, base: 'other' });
  assert.equal(report.baseCommit, other);
  assert.equal(report.mergeBase, base);
  assert.deepEqual(report.commits, [{ hash: head, subject: 'main branch commit' }]);
  assert.deepEqual(report.files.map(file => file.path), ['main.txt']);
});

test('invalid or empty refs fail clearly without interpreting options or changing the repo', async t => {
  const { root } = await fixture(t), before = await repoState(root);
  for (const base of ['', 'missing-reference', '--output=unexpected']) {
    await assert.rejects(command(process.execPath, [reviewCLI, '--root', root, '--base', base], tmpdir()), error => {
      assert.equal(error.code, 1);
      assert.equal(error.stdout, '');
      assert.match(error.stderr, /non-empty|Invalid base/);
      return true;
    });
  }
  assert.deepEqual(await repoState(root), before);
});

test('unborn repositories fail clearly and never create an index or commit', async t => {
  const root = await mkdtemp(join(tmpdir(), 'whale-review-tools-'));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('whale-review-tools-'));
    await rm(root, { recursive: true, force: true });
  });
  await git(root, 'init', '--initial-branch=main');
  const before = await repoState(root);
  await assert.rejects(reviewSnapshot({ root }), /HEAD has no commit/);
  assert.deepEqual(await repoState(root), before);
});

test('read probe defaults and explicit relative paths return metadata only and fail missing or escaping paths', async t => {
  const { root } = await fixture(t);
  await mkdir(join(root, 'nested'));
  const secret = 'fixture secret must not be printed';
  await writeFile(join(root, 'nested', '中文 note.md'), secret);
  const before = await repoState(root);
  const defaults = JSON.parse((await command(process.execPath, [probeCLI, '--root', root], tmpdir())).stdout);
  assert.deepEqual(defaults.files.map(file => file.path), ['AGENTS.md', 'src/engine.js']);
  assert.ok(defaults.files.every(file => file.readable));
  assert.equal(defaults.files[0].sha256, sha256(Buffer.from('# Rules\n')));
  const explicit = await command(process.execPath, [probeCLI, '--root', root, 'nested/中文 note.md'], tmpdir());
  assert.ok(!explicit.stdout.includes(secret));
  assert.equal(JSON.parse(explicit.stdout).files[0].bytes, Buffer.byteLength(secret));
  const direct = await readProbe({ root, paths: ['../outside', resolve(root, 'src/engine.js'), 'missing.js'] });
  assert.deepEqual(direct.files.map(file => file.error), ['OUTSIDE_ROOT', 'OUTSIDE_ROOT', 'ENOENT']);
  await assert.rejects(command(process.execPath, [probeCLI, '--root', root, 'missing.js'], tmpdir()), error => {
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(error.stdout).files[0].readable, false);
    assert.match(error.stderr, /Read probe failed/);
    return true;
  });
  assert.deepEqual(await repoState(root), before);
});

test('read probe refuses symlink escapes without reading the target', async t => {
  const { root } = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'whale-review-tools-'));
  t.after(async () => {
    assert.equal(dirname(resolve(outside)), resolve(tmpdir()));
    assert.ok(basename(outside).startsWith('whale-review-tools-'));
    await rm(outside, { recursive: true, force: true });
  });
  await writeFile(join(outside, 'secret.txt'), 'outside secret');
  // Directory junctions need no Windows symlink privilege and exercise realpath containment.
  await symlink(outside, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const result = await readProbe({ root, paths: ['linked/secret.txt'] });
  assert.equal(result.files[0].readable, false);
  assert.equal(result.files[0].error, 'OUTSIDE_ROOT');
});

test('help succeeds outside repositories without reading project files', async () => {
  for (const tool of [reviewCLI, probeCLI]) {
    const output = await command(process.execPath, [tool, '--help'], tmpdir());
    assert.match(output.stdout, /^Usage:/);
    assert.equal(output.stderr, '');
  }
});
