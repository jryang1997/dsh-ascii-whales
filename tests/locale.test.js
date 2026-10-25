import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIELDS } from '../src/model.js';

const read = name => JSON.parse(readFileSync(new URL(`../locale/${name}.json`, import.meta.url), 'utf8'));
const zhFile = read('zh');
const enFile = read('en');
const zh = zhFile.ui;
const en = enFile.ui;
const CJK = /[\u4e00-\u9fff]/;
// The default body phrase is user-visible data, not interface copy, so the
// English hint may quote it. Nothing else in the English UI may stay Chinese.
const QUOTED_DEFAULT = '探索未至之境';

test('both locales expose the same UI keys in the same order', () => {
  assert.deepEqual(Object.keys(en), Object.keys(zh));
});

test('plugin metadata is translated', () => {
  for (const [locale, file] of [['zh', zhFile], ['en', enFile]]) {
    assert.equal(typeof file.meta?.title, 'string', `${locale} meta.title`);
    assert.ok(file.meta.title.length > 0, `${locale} meta.title is empty`);
    assert.equal(typeof file.meta?.description, 'string', `${locale} meta.description`);
    assert.ok(file.meta.description.length > 0, `${locale} meta.description is empty`);
  }
});

test('every config field, hint and enum option has a label in both locales', () => {
  for (const [key, field] of Object.entries(FIELDS)) {
    for (const id of [key, `${key}Hint`]) {
      assert.equal(typeof zh[id], 'string', `zh is missing ${id}`);
      assert.equal(typeof en[id], 'string', `en is missing ${id}`);
      assert.ok(zh[id].trim().length > 0, `zh ${id} is empty`);
      assert.ok(en[id].trim().length > 0, `en ${id} is empty`);
    }
    if (field.kind !== 'enum') continue;
    for (const value of field.values) {
      assert.equal(typeof zh[value], 'string', `zh is missing the ${key} option ${value}`);
      assert.equal(typeof en[value], 'string', `en is missing the ${key} option ${value}`);
    }
  }
});

test('English interface text contains no untranslated Chinese', () => {
  for (const [key, value] of Object.entries(en)) {
    if (typeof value !== 'string' || !CJK.test(value)) continue;
    assert.ok(value.includes(QUOTED_DEFAULT), `en ${key} still contains Chinese: ${value}`);
    assert.equal(value.replaceAll(QUOTED_DEFAULT, '').search(CJK), -1,
      `en ${key} contains Chinese beyond the quoted default phrase: ${value}`);
  }
});

test('the translated README keeps the same sections and figures', () => {
  const readme = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  const headings = text => [...text.matchAll(/^(#{1,3})\s+\S/gmu)].map(match => match[1].length);
  // The activity clip and the settings screenshot are rendered once per
  // audience, so their localized file names are the only figures allowed to
  // differ between the two READMEs.
  const figures = text => [...text.matchAll(/docs\/images\/[a-z0-9-]+\.(?:gif|png)/gu)]
    .map(match => match[0].replace('activity-en.gif', 'activity.gif').replace('settings-en.png', 'settings.png')).sort();
  const zhReadme = readme('README.md');
  const enReadme = readme('README.en.md');
  assert.deepEqual(headings(enReadme), headings(zhReadme), 'README section levels differ');
  assert.deepEqual(figures(enReadme), figures(zhReadme), 'README figure references differ');
  assert.ok(zhReadme.includes('href="./README.en.md"'), 'README.md loses the English language link');
  assert.ok(enReadme.includes('href="./README.md"'), 'README.en.md loses the Chinese language link');
});
