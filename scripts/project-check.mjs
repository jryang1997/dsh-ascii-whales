import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Only root tests and root/scripts sources belong to this project's checks. */
export async function projectFiles(root = projectRoot) {
  const atRoot = await readdir(root, { withFileTypes: true });
  const scripts = await readdir(resolve(root, 'scripts'), { withFileTypes: true });
  const source = entries => entries.filter(entry => entry.isFile() && /\.(?:mjs|js)$/.test(entry.name));
  return {
    tests: source(atRoot).map(entry => entry.name).filter(name => name.endsWith('.test.js')).sort(),
    sources: [...source(atRoot).map(entry => entry.name), ...source(scripts).map(entry => `scripts/${entry.name}`)].sort(),
  };
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
  if (!files.tests.length) throw new Error('No root test files found; refusing an empty verification.');
  if (mode === 'check' || mode === 'verify') {
    for (const source of files.sources) run(root, ['--check', source]);
    console.log(`Syntax checked ${files.sources.length} root/scripts source files.`);
  }
  if (mode === 'verify') {
    // Never rebuild here: stale committed output must remain a failing check.
    run(root, ['build.mjs', '--check']);
    run(root, ['preview.mjs', '--check']);
  }
  if (mode === 'test' || mode === 'verify') run(root, ['--test', ...files.tests]);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { await checkProject(process.argv[2] || 'verify'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
