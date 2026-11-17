const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { composition } = require('../miniprogram/utils/recipe-composition');
const { unpack } = require('../miniprogram/recipe-book/data/codec');
const recipes = require('../docs/miniapp/recipes/recipes-before-howtocook.json');
const currentRecipes = require('../docs/miniapp/recipes/recipes.json');
const additions = require('../docs/miniapp/recipes/recipes-household-300.json');
const baseline = recipes.filter(recipe => !recipe.recipe_id.startsWith('household300-') && !recipe.recipe_id.startsWith('collected32-'));
const oldKeys = new Set(baseline.map(recipe => composition(recipe).combinationKey));
assert.equal(baseline.length, 540);
assert.equal(additions.length, 300);
assert.equal(additions.filter(recipe => recipe.cuisine === '粤菜').length, 150);
assert.equal(new Set(additions.map(recipe => composition(recipe).combinationKey)).size, 300);
assert.equal(new Set(recipes.map(recipe => recipe.name)).size, recipes.length);
for (const recipe of additions) {
  assert(!oldKeys.has(composition(recipe).combinationKey), 'New dish is a renamed old combination: ' + recipe.name);
  assert(composition(recipe).isCombination, 'Each addition must combine substantive ingredients');
  assert.deepEqual(recipes.find(item => item.recipe_id === recipe.recipe_id), recipe);
  assert.equal(recipe.prep_minutes, recipe.step_details[0].minutes);
  assert.equal(recipe.cook_minutes, recipe.step_details.slice(1).reduce((sum, step) => sum + step.minutes, 0));
  assert.equal(recipe.verification_status, 'draft_structured');
  if (recipe.name.includes('蒸')) {
    assert(!recipe.steps.join('').includes('肉类放上层'), recipe.name);
    if (recipe.ingredient_items[0].name === '鸡蛋') {
      assert(recipe.steps.slice(1).some(step => step.includes('姜丝加入蛋液')), recipe.name);
    }
  }
  if (recipe.name.endsWith('汤') || recipe.name.includes('炖')) {
    assert(!recipe.steps[1].includes('放入干净汤锅'), recipe.name);
    if (recipe.ingredient_items[0].name === '鸡蛋') {
      assert(!recipe.step_details[2].materials.some(item => item.startsWith('鸡蛋')), recipe.name);
    }
  }
}
const { tutorials } = require('../miniprogram/recipe-book/data/tutorials');
assert.equal(Object.keys(tutorials).length, currentRecipes.length);
assert.throws(() => unpack({ format: 1, dictionary: [], records: [{ name: ['$s', 10] }] }), /INVALID_RECIPE_STRING/);
// Run the actual detail-page renderer with local fixtures, including all newly generated chunks.
const store = require('../miniprogram/utils/store');
let currentMeal, page;
const fakeStore = { ...store, meal: () => currentMeal, load: () => ({ foods: store.data.foods.map(food => food.id) }) };
vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js', 'utf8'), {
  Page: value => { page = value; },
  require: name => name.includes('data/presentation') ? require('../miniprogram/recipe-book/data/presentation') : name.includes('data/tutorials') ? { tutorials } : name.includes('utils/store') ? fakeStore : {},
  wx: {}
});
page.setData = function(value) { Object.assign(this.data, value); };
for (const recipe of currentRecipes) {
  assert.deepEqual(tutorials[recipe.recipe_id], recipe, 'Compact tutorials must restore all original values');
  currentMeal = { ids: [recipe.recipe_id], done: [], people: 4 };
  page.recipeId = recipe.recipe_id;
  page.render();
  assert.equal(page.data.recipe.recipe_id, recipe.recipe_id);
  assert.equal(page.data.steps.length, recipe.source_type==='howtocook_original'?require('../miniprogram/recipe-book/data/presentation').sourcePresentation(recipe).steps.length:recipe.steps.length);
  if(recipe.ingredient_items.length && recipe.source_type!=='howtocook_original'&&!recipe.original_amounts) assert.equal(page.data.ingredients[0].amount, (Math.round(recipe.ingredient_items[0].quantity * 4 / recipe.servings * 100) / 100) + recipe.ingredient_items[0].unit);
}
console.log('PASS: 300 unique combinations, no baseline duplicates, exact tutorial roundtrip, all catalog detail renders and serving scaling');
