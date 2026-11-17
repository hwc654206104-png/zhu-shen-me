const assert=require('node:assert/strict');
const fs=require('node:fs');
const store=require('../miniprogram/utils/store');
const {groups,representatives}=require('../miniprogram/utils/food-groups');
const {foods,recipes}=store.data;
const byName=new Map(foods.map(food=>[food.name,food]));
// 从原始ID和声明的成员直接算期望值，不复用待验证的canonical/expand。
const expected=new Map(foods.map(food=>[food.id,food.id]));
const assigned=new Set();
for(const [name,members] of Object.entries(groups)) {
  const target=byName.get(name)||byName.get(representatives[name]);
  assert(target,'Missing representative: '+name);
  for(const member of members) {
    const food=byName.get(member);
    assert(food,'Missing original ingredient: '+member);
    assert(!assigned.has(food.id),'Repeated member: '+member);
    assigned.add(food.id);expected.set(food.id,target.id);
  }
  assert.equal(store.foodIndex.findFoods(name)[0].id,target.id);
}
for(const food of foods) {
  const target=expected.get(food.id);
  const groupIds=new Set(foods.filter(other=>expected.get(other.id)===target).map(other=>other.id));
  const recipeIds=new Set(recipes.filter(recipe=>recipe.ingredientIds.some(id=>groupIds.has(id))).map(recipe=>recipe.recipe_id));
  assert(recipeIds.size>0,food.name+' has no linked recipe');
  assert.deepEqual(store.foodIndex.recipesFor(food.id),recipeIds,food.name+' ID index');
  assert.deepEqual(store.foodIndex.recipesFor(food.name),recipeIds,food.name+' name index');
  assert.deepEqual(store.foodGroups.expand([food.id]),groupIds,food.name+' inventory expansion');
  for(const other of foods)assert.equal(store.foodGroups.matches(food.id,other.id),groupIds.has(other.id));
}
for(const recipe of recipes) {
  const wanted=new Set(recipe.ingredientIds.map(id=>{assert(expected.has(id));return expected.get(id);}));
  assert.deepEqual(new Set(store.foodIndex.byRecipe.get(recipe.recipe_id)),wanted,recipe.name+' reverse index');
}
const report={originalFoods:foods.length,displayEntries:store.foodGroups.catalog.length,groups:Object.keys(groups).length,
  recipes:recipes.length,matchedPairs:foods.length**2,indexMismatches:0,unlinkedEntries:0,
  samples:Object.fromEntries(['鱼','鲜菌菇','猪杂','血旺','豆皮','坚果','面条'].map(name=>[name,store.foodIndex.recipesFor(name).size])),
  evidence:'local_node_only',uploaded:false,backendDeployed:false};
fs.writeFileSync('build/food-group-index-completeness.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS: independent raw-ID union oracle, all '+foods.length+' ingredients, '+recipes.length+' reverse indexes and '+report.matchedPairs+' matching pairs');
