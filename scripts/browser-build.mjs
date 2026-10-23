import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = new URL('../', import.meta.url);

/** Both entry adapters use dependency resolution and isolated module scopes. */
export async function assembleBrowser(entry, root = projectRoot) {
  const result = await build({
    absWorkingDir: fileURLToPath(root),
    entryPoints: [entry], bundle: true, write: false,
    format: 'iife', platform: 'browser', target: 'es2022',
    charset: 'utf8', legalComments: 'none', logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

/** Check mode is read-only; equal output preserves the artifact timestamp. */
export async function writeArtifact(target, content, { check = false } = {}) {
  let previous;
  try { previous = await readFile(target, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (check) {
    if (content !== previous) throw new Error(`${fileURLToPath(target)} is stale. Rebuild its entry.`);
    return false;
  }
  if (previous === content) return false;
  await writeFile(target, content, 'utf8');
  return true;
}
