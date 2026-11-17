// Offline verification of the official read tool's saved response; never writes cloud data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = require('../miniprogram/data/recipe-index.js');
const raw = fs.readFileSync(path.join(root, 'build/recipe-import/remote-verification.json'), 'utf8').replace(/^\uFEFF/, '');
const response = JSON.parse(raw.slice(raw.indexOf('{')));
assert.equal(response.ok, true);
assert.equal(response.result.success, true);
const remote = response.result.data;
const local = JSON.parse(fs.readFileSync(path.join(root, `build/recipe-import/${data.metadata.recipeVersion}-documents.json`), 'utf8'));
assert.equal(response.result.total, local.length);
assert.equal(remote.length, local.length);
for (const expected of local) {
  const actual = remote.find(document => document._id === expected._id);
  assert.ok(actual, 'Missing document: ' + expected._id);
  // The database may reorder object keys; deep equality compares their values.
  assert.deepEqual(actual, expected, 'Remote content differs: ' + expected._id);
}
const recipes = remote.filter(document => Array.isArray(document.recipes)).flatMap(document => document.recipes);
const policy = require('../docs/miniapp/recipes/catalog-policy.json');
assert.equal(recipes.length, policy.total);
assert.equal(recipes.filter(recipe => recipe.cuisine === '粤菜').length, policy.cantonese);
const evidence = { envId: 'cloud1-d0g0ntbbyaddfb364', recipeVersion: data.metadata.recipeVersion,
  sourceSha256: data.metadata.sourceSha256, documentCount: remote.length, recipeCount: recipes.length,
  cantoneseCount: recipes.filter(recipe => recipe.cuisine === '粤菜').length, contentMatches: true, manifestStatus: 'prepared',
  method: 'Official WeChat IDE cloud_db_read_doc full content compared to local import documents',
  checkedAt: new Date().toISOString() };
fs.writeFileSync(path.join(root, 'docs/miniapp/cloud-recipe-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
