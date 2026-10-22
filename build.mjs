import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const readSource = name => readFile(new URL(name, root), 'utf8');
const names = ['species.js', 'rig.js', 'shading.js', 'reef.js', 'water.js', 'motion.js', 'model.js', 'surface.js', 'glass.js', 'spout.js', 'engine.js', 'settings.js'];
const sources = await Promise.all(names.map(readSource));
const dictionaries = Object.fromEntries(await Promise.all(['en', 'zh'].map(async language =>
  [language, JSON.parse(await readSource(`locale/${language}.json`)).ui])));
const body = sources.map(source => source.replace(/^import .*;\r?\n/gm, '').replace(/^export \{.*\} from .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n');
const artifact = `window.__ModuleLoader__.load({\n  id: '@local/dsh-ascii-ocean',\n  factory(require) {\n    const React = require('react');\n${body}\n    return {\n      inject: ['slots', 'locale', 'configForms'],\n      apply(ctx) { registerWhales(ctx, React, ${JSON.stringify(dictionaries)}); },\n    };\n  },\n});\n`;
let existing;
try { existing = await readSource('client.js'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (process.argv.includes('--check')) {
  if (artifact !== existing) throw new Error('client.js is stale. Run node build.mjs.');
  console.log('Client artifact matches its sources.');
} else {
  if (existing !== artifact) await writeFile(new URL('client.js', root), artifact, 'utf8');
  console.log(`Built client.js from ${names.join(', ')} and locale dictionaries.`);
}
