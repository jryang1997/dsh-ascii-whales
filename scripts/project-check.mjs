import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Scan only the declared project directories, never backups or dependencies. */
export async function projectFiles(root = projectRoot) {
  const sources = [], tests = [];
  const sourceFile = name => /\.(?:mjs|js)$/.test(name);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isFile() && sourceFile(entry.name)) sources.push(entry.name);
  }
  async function visit(directory) {
    for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(relative);
      else if (entry.isFile() && sourceFile(entry.name)) {
        sources.push(relative);
        if (relative.startsWith('tests/') && entry.name.endsWith('.test.js')) tests.push(relative);
      }
    }
  }
  for (const directory of ['src', 'tests', 'scripts', 'preview']) await visit(directory);
  return { tests: tests.sort(), sources: sources.sort() };
}

function run(root, args) {
  const env = { ...process.env };
  // A test may exercise this runner in a fixture. Its child suite is independent.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Node command failed (${result.signal || result.status}): ${args.join(' ')}`);
}

export async function checkProject(mode, root = projectRoot) {
  if (!['check', 'test', 'verify'].includes(mode)) throw new Error('Usage: node scripts/project-check.mjs <check|test|verify>');
  const files = await projectFiles(root);
  if (!files.tests.length) throw new Error('No tests found in tests/; refusing an empty verification.');
  if (mode === 'check' || mode === 'verify') {
    for (const source of files.sources) run(root, ['--check', source]);
    console.log(`Syntax checked ${files.sources.length} project source files.`);
  }
  if (mode === 'verify') {
    // Never rebuild here: stale committed output must remain a failing check.
    run(root, ['scripts/build.mjs', '--check']);
    run(root, ['scripts/preview.mjs', '--check']);
  }
  if (mode === 'test' || mode === 'verify') run(root, ['--test', ...files.tests]);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await checkProject(process.argv[2] || 'verify'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
