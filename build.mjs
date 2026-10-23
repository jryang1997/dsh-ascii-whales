import { assembleBrowser, writeArtifact } from './browser-build.mjs';

const root = new URL('./', import.meta.url);
const artifact = await assembleBrowser('browser-entry.js');
const check = process.argv.includes('--check');
await writeArtifact(new URL('client.js', root), artifact, { check });
console.log(check ? 'Client artifact matches its sources.' : 'Built client.js from browser-entry.js and its dependency graph.');
