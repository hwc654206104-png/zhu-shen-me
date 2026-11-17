const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/miniapp/recipes');
const recipes = require('../docs/miniapp/recipes/recipes-before-howtocook.json');
const additions = require('../docs/miniapp/recipes/recipes-collected-32.json');
const sources = require('../docs/miniapp/recipes/public-combination-sources.json');
const { composition } = require('../miniprogram/utils/recipe-composition');
const baseline = recipes.filter(r => !r.recipe_id.startsWith('collected32-'));
assert.equal(crypto.createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
  '49b77b7ae9ca1b81213d20d7c5d8e557083a7711cc0639d74cd8440047214609',
  'The previously uploaded 840 recipes must remain unchanged');
assert.equal(additions.length, 32);
assert.equal(additions.filter(r => r.cuisine === '粤菜').length, 16);
const keys = new Set(baseline.map(r => composition(r).combinationKey));
const oldCore = new Set(baseline.map(r => JSON.stringify(composition(r).core)));
let novelCores = 0;
for (const source of sources) {
  const bytes = fs.readFileSync(path.join(dir, source.local_snapshot));
  const sha = crypto.createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex');
  assert.equal(sha, source.blobSha, 'Fetched text must match upstream blob: ' + source.name);
  assert.equal(source.license, 'Unlicense');
}
for (const r of additions) {
  const c = composition(r);
  assert(!keys.has(c.combinationKey), 'Not a new ingredient/method combination: ' + r.name);
  keys.add(c.combinationKey);
  if (!oldCore.has(JSON.stringify(c.core))) novelCores++;
  assert(c.core.length >= 2);
  assert(r.adaptation_note && r.source_references.length && r.verification_status === 'draft_structured');
  assert(!/健脾|清热利尿|增强抵抗力|减肥/.test(JSON.stringify(r)), 'Do not import unsupported health claims');
  for (const ref of r.source_references) {
    assert(sources.some(s => s.url === ref.url && s.blobSha === ref.blob_sha));
  }
  assert.equal(r.steps.length, r.step_details.length);
  assert.equal(r.prep_minutes, r.step_details[0].minutes);
  assert.equal(r.cook_minutes, r.step_details.slice(1).reduce((n, s) => n + s.minutes, 0));
  for (const item of r.ingredient_items) {
    assert(r.step_details.slice(1).some(step => step.materials.includes(item.name + item.quantity + item.unit)),
      'Ingredient never assigned to a cooking step: ' + r.name + '/' + item.name);
  }
}
assert.equal(novelCores, 31, 'Count new food sets independently of cooking method');
// Real catalog scenarios must reach the additions, not merely contain them in JSON.
const S = require('../miniprogram/utils/store');
const cases = [
  [['莲藕','木耳','胡萝卜','豌豆','蒜'], '荷塘小炒'],
  [['猪肉','芹菜','香干','青椒','蒜'], '香干芹菜炒肉'],
  [['排骨','山药','玉米','胡萝卜','姜'], '山药玉米排骨汤'],
  [['番茄','白菜','豆腐','蒜'], '番茄白菜炖豆腐'],
  [['白菜','粉丝','鸡蛋','蒜'], '白菜粉丝炒鸡蛋'],
  [['西兰花','鲜香菇','蘑菇','蒜'], '西兰花炒双菇']
];
for (const [names, expected] of cases) {
  const foods = S.data.foods.filter(f => names.includes(f.name)).map(f => f.id);
  assert.equal(foods.length, names.length);
  const available = S.availableFoods(foods);
  for (let repeat = 0; repeat < 12; repeat++) {
    const ids = S.select({}, 1, foods, []);
    assert(ids.length && S.byId.get(ids[0]), names.join('+'));
    assert(S.requiredFoods(S.byId.get(ids[0])).every(id=>available.has(id)), 'Pantry-ready recipe expected after one-to-many grouping and optional ingredients');
  }
}
// Re-running either authoring batch must not drop the other batch or duplicate data.
const before = fs.readFileSync(path.join(dir, 'recipes.json'), 'utf8');
for (const script of ['collect-public-combinations.cjs', 'expand-household-300.cjs', 'collect-public-combinations.cjs']) {
  execFileSync(process.execPath, [path.join(dir, script)], { cwd: root, stdio: 'pipe' });
  assert.equal(fs.readFileSync(path.join(dir, 'recipes.json'), 'utf8'), before);
}
console.log('PASS: 32 sourced adaptations, 31 new food sets, source blob integrity, old 840 preserved, 72 matching runs, idempotent batches');
