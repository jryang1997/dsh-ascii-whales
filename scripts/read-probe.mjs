import { readFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const usage = 'Usage: node scripts/read-probe.mjs [--root <directory>] [relative-file ...]\nDefaults: AGENTS.md engine.js. Reports only path/readability/byte count/SHA256. This command does not establish native file-tool access.';
const inside = (root, target) => {
  const path = relative(root, target);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
};

export async function readProbe({ root = process.cwd(), paths = ['AGENTS.md', 'engine.js'] } = {}) {
  const declaredRoot = resolve(root), actualRoot = await realpath(declaredRoot);
  const files = [];
  for (const path of paths) {
    try {
      if (typeof path !== 'string' || !path || isAbsolute(path)) throw Object.assign(new Error(), { code: 'OUTSIDE_ROOT' });
      const target = resolve(declaredRoot, path);
      if (!inside(declaredRoot, target)) throw Object.assign(new Error(), { code: 'OUTSIDE_ROOT' });
      const actual = await realpath(target);
      if (!inside(actualRoot, actual)) throw Object.assign(new Error(), { code: 'OUTSIDE_ROOT' });
      const bytes = await readFile(actual);
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      files.push({ path, readable: true, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex') });
    } catch (error) {
      files.push({ path, readable: false, bytes: null, sha256: null,
        error: error.code ?? 'READ_FAILED' });
    }
  }
  return { root: declaredRoot, files };
}

async function main() {
  const args = process.argv.slice(2), options = {}, paths = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') { console.log(usage); return; }
    if (arg === '--root') {
      if (!args[i + 1]?.trim()) throw new Error(`root must be non-empty.\n${usage}`);
      options.root = args[++i];
    } else if (arg === '--') { paths.push(...args.slice(i + 1)); break; }
    else if (arg.startsWith('--')) throw new Error(usage);
    else paths.push(arg);
  }
  if (paths.length) options.paths = paths;
  const report = await readProbe(options);
  console.log(JSON.stringify(report, null, 2));
  if (report.files.some(file => !file.readable)) {
    console.error('Read probe failed for one or more requested files; inspect the JSON error codes.');
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Read probe failed (${error.code ?? error.message}).`); process.exitCode = 1; });
}
