const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const { build } = require('../scripts/build-native-recipes.cjs');
const { composition } = require('../miniprogram/utils/recipe-composition');
const { unpack } = require('../miniprogram/recipe-book/data/codec');
const first = build();
const second = build();
assert.deepEqual(first, second, 'Build must be deterministic');
const data = require('../miniprogram/data/recipe-index.js');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const all = [];
for (const chunk of data.metadata.chunks) {
  const items = unpack(require(path.join(root, chunk.file)));
  assert.equal(hash(items), chunk.sha256);
  const remote = JSON.parse(fs.readFileSync(path.join(root, 'build/recipe-import', `${first.recipeVersion}-${chunk.number}.json`)));
  assert.deepEqual(remote.recipes, items, 'Cloud snapshot must exactly match local tutorial');
  assert.ok(Buffer.byteLength(JSON.stringify(remote)) < 1024 * 1024);
  for (const item of items) {
    const indexed = data.recipes.find(r => r.recipe_id === item.recipe_id);
    assert.equal(indexed.chunk, chunk.number);
    for (const field of ['cuisine', 'spicy_level', 'salt_level']) assert.equal(indexed[field], item[field]);
    assert.deepEqual(indexed.ingredientIds, item.ingredient_items.map(food => data.foods.find(f => f.name === food.name).id));
    assert.deepEqual(indexed.optionalIngredientIds||[],item.ingredient_items.filter(food=>food.optional===true).map(food=>data.foods.find(f=>f.name===food.name).id));
    assert.deepEqual(indexed.coreIngredientIds, composition(item).core.map(name => data.foods.find(food => food.name === name).id));
    assert.equal(indexed.combinationKey, composition(item).combinationKey);
  }
  all.push(...items);
}
const policy = require('../docs/miniapp/recipes/catalog-policy.json');
assert.equal(all.length, policy.total);
assert.equal(all.filter(r => r.cuisine === '粤菜').length, policy.cantonese);
const retired = require('../docs/miniapp/recipes/retired-recipes-audit.json');
for (const row of retired.recipes) {
  assert(!all.some(recipe => recipe.recipe_id === row.id));
  assert(!data.recipes.some(recipe => recipe.recipe_id === row.id));
}
for (const name of ['西兰花炒虾仁','香菇滑鸡','玉米胡萝卜排骨汤','番茄虾仁滑蛋','木须肉','家常豆腐','土豆胡萝卜炖鸡','黄瓜胡萝卜炒鸡蛋']) {
  assert(all.some(recipe => recipe.name === name), 'Missing household combination: ' + name);
}
assert.equal(hash({ recipes: all, catalog: data.foods }), data.metadata.sourceSha256);
assert.deepEqual(data.foods, JSON.parse(fs.readFileSync(path.join(root, 'docs/miniapp/recipes/ingredient-catalog.json'))),
  'Every source ingredient must remain present in the app catalog');
for (const recipe of all) {
  assert.deepEqual(require('../miniprogram/data/ingredient-index.js')[recipe.recipe_id], recipe.ingredient_items.map(item => item.name),
    'Ingredient display index differs from tutorial: ' + recipe.recipe_id);
}
assert.ok(data.foods.every(f => data.recipes.some(r => r.ingredientIds.includes(f.id))), 'No unused food in catalog');
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'cloudfunctions/pigFriends/recipe-ids.json'))),
  all.map(recipe => recipe.recipe_id), 'Friend sharing must accept every current recipe');
assert(data.foods.every(food => data.recipes.filter(recipe => recipe.ingredientIds.includes(food.id)).length >= policy.minimumRecipesPerFood),
  'Every stocked ingredient must have a source recipe');
for (const recipe of all.filter(item => item.recipe_id.startsWith('popular-'))) {
  assert.deepEqual(require('../miniprogram/data/ingredient-index.js')[recipe.recipe_id], recipe.ingredient_items.map(item => item.name));
  const seasonings = require('../miniprogram/data/seasoning-index.js')[recipe.recipe_id];
  assert(seasonings?.length && seasonings.every(item => !/[0-9]|毫升|适量|少许/.test(item)), 'Seasoning names must have no quantities');
}
for (const name of ['西兰花炒牛肉', '蒜蓉生菜', '土豆炖牛腩', '香菇蒸鸡腿', '可乐鸡翅', '青瓜炒鸡蛋', '鱼香肉丝', '宫保鸡丁', '麻婆豆腐', '农家小炒肉', '糖醋里脊', '地三鲜', '番茄牛腩煲', '豉油皇炒豆芽', '姜葱蒸鲈鱼', '香菇焖鸡翅', '木耳炒鸡蛋', '韭黄炒鸡蛋', '老醋花生', '鸡丝香菇粥']) {
  assert(data.recipes.some(recipe => recipe.name === name), `Missing popular recipe: ${name}`);
}
for (const name of ['番茄', '豆芽', '鲈鱼', '鸡翅', '木耳', '韭黄', '花生', '大米']) {
  const food = data.foods.find(item => item.name === name);
  assert(food);
  assert(data.recipes.filter(recipe => recipe.ingredientIds.includes(food.id)).length >= 2,
    `${name} should have at least two linked recipes after curation`);
}
for (const id of ['popular-yue-0001', 'popular-chuan-0001']) {
  assert(require('../miniprogram/data/seasoning-index.js')[id]?.length, `Missing seasoning index: ${id}`);
  assert(require('../miniprogram/data/ingredient-index.js')[id]?.length, `Missing ingredient index: ${id}`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'build/recipe-import', `${first.recipeVersion}-manifest.json`)));
assert.equal(manifest.status, 'prepared', 'Build must not mark remote version active');
assert.equal(manifest.recipeVersion, data.metadata.recipeVersion);
const batch = JSON.parse(fs.readFileSync(path.join(root, 'build/recipe-import', `${first.recipeVersion}-documents.json`)));
assert.equal(batch.length, data.metadata.chunks.length + 1);
assert.equal(new Set(batch.map(d => d._id)).size, batch.length);
assert.deepEqual(batch.filter(d => Array.isArray(d.recipes)).flatMap(d => d.recipes), all);
assert.deepEqual(batch[batch.length - 1], manifest);
const lines = fs.readFileSync(path.join(root, 'build/recipe-import', `${first.recipeVersion}-console.json`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
assert.deepEqual(lines, batch, 'Console JSON lines and CLI batch must match');
console.log('PASS: deterministic build, catalog quota, tutorial-index parity, food references, cloud hashes and document bounds');
