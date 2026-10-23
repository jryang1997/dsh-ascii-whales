import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectFiles, checkProject } from './scripts/project-check.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'whale-project-check-'));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, 'scripts'));
  return directory;
}

test('project discovery includes new root tests and scripts while excluding nested backup copies', async t => {
  const directory = await fixture(t);
  for (const folder of ['.scratch', '.agents', 'node_modules', 'reference']) {
    await mkdir(join(directory, folder));
    await writeFile(join(directory, folder, 'must-not-run.test.js'), 'throw new Error("backup ran");');
  }
  for (const name of ['b.test.js', 'a.test.js', 'client.js', 'preview.mjs', 'scripts/read-probe.mjs']) {
    await writeFile(join(directory, name), '');
  }
  assert.deepEqual(await projectFiles(directory), {
    tests: ['a.test.js', 'b.test.js'],
    sources: ['a.test.js', 'b.test.js', 'client.js', 'preview.mjs', 'scripts/read-probe.mjs'],
  });
});

test('verify stops at a stale artifact check without running tests or rebuilding output', async t => {
  const directory = await fixture(t), target = join(directory, 'client.js');
  await writeFile(target, '// stale committed artifact\n');
  await writeFile(join(directory, 'build.mjs'), "if (!process.argv.includes('--check')) throw new Error('rebuild attempted'); process.exitCode = 17;");
  await writeFile(join(directory, 'preview.mjs'), 'throw new Error("must stop before preview");');
  await writeFile(join(directory, 'behavior.test.js'), 'throw new Error("must stop before tests");');
  const before = await stat(target);
  await assert.rejects(checkProject('verify', directory), /17.*build.mjs --check/);
  assert.equal(await readFile(target, 'utf8'), '// stale committed artifact\n');
  assert.equal((await stat(target)).mtimeMs, before.mtimeMs);
});

test('root-only test execution ignores a failing nested duplicate and runs newly added tests', async t => {
  const directory = await fixture(t);
  await mkdir(join(directory, '.scratch'));
  await writeFile(join(directory, '.scratch', 'copy.test.js'), 'throw new Error("unwanted nested test");');
  await writeFile(join(directory, 'new.test.js'), 'import test from "node:test"; test("new root test", () => {});');
  const script = `import {checkProject} from ${JSON.stringify(new URL('./scripts/project-check.mjs', import.meta.url).href)}; await checkProject('test', process.argv[1]);`;
  const execute = () => spawnSync(process.execPath, ['--input-type=module', '-e', script, directory], {
    encoding: 'utf8', env: { ...process.env },
  });
  const green = execute();
  assert.equal(green.status, 0, green.stderr);
  assert.match(green.stdout, /new root test/);
  await writeFile(join(directory, 'new.test.js'), 'throw new Error("root test fails");');
  const red = execute();
  assert.notEqual(red.status, 0);
  assert.match(red.stdout + red.stderr, /root test fails/);
});

test('invalid check modes and an empty test suite fail explicitly', async t => {
  const directory = await fixture(t);
  await assert.rejects(checkProject('rebuild', directory), /Usage:/);
  await assert.rejects(checkProject('verify', directory), /No root test files/);
});
