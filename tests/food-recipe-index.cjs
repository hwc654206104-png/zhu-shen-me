const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const store=require('../miniprogram/utils/store');
const {foodIndex:index,foodGroups:grouping}=store;
const id=name=>store.data.foods.find(food=>food.name===name).id;
for(const food of store.data.foods){
  assert(index.findFoods(food.name).some(entry=>entry.id===grouping.canonical(food.id)),food.name);
  const recipes=index.recipesFor(food.id);
  assert(recipes.size>0,food.name+' has no recipe');
  for(const recipe of store.data.recipes.filter(recipe=>recipe.ingredientIds.includes(food.id))) {
    assert(recipes.has(recipe.recipe_id));
    assert(index.byRecipe.get(recipe.recipe_id).includes(grouping.canonical(food.id)));
  }
}
for(const name of ['鸡肉','鸡胸肉','鸡腿肉','鸡骨头'])assert.deepEqual(index.recipesFor(name),index.recipesFor('鸡肉'));
assert(index.recipesFor('鸡肉').size>=180);
assert.deepEqual(index.recipesFor('五花肉'),index.recipesFor('猪肉'));
assert.deepEqual(index.recipesFor('牛腩'),index.recipesFor('牛肉'));
for(const [name,members] of Object.entries(require('../miniprogram/utils/food-groups').groups)) {
  const recipes=index.recipesFor(name);
  for(const member of members)assert.deepEqual(index.recipesFor(member),recipes,name+' / '+member);
}
assert.equal(index.findFoods(' 鸡 胸 肉 ')[0].id,id('鸡肉'));
assert.equal(index.findFoods('西红柿')[0].id,id('番茄'));
assert.equal(index.findFoods('鸡翅')[0].id,id('鸡翅'));
const pair=index.searchRecipes('番茄 牛肉');
assert(pair.size>0);
for(const query of ['番茄，','番茄＋','，番茄、',' 番茄, '])assert.deepEqual(index.searchRecipes(query),index.searchRecipes('番茄'));
assert.deepEqual(index.searchRecipes('番茄＋牛肉，'),pair);
for(const recipeId of pair){assert(index.searchRecipes('番茄').has(recipeId));assert(index.searchRecipes('牛肉').has(recipeId));}
assert.equal(index.searchRecipes('不存在的食材菜谱').size,0);
let library;
vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/library/index.js','utf8'),{
  Page:page=>library=page,require:path=>path.includes('utils/store')?store:require('../miniprogram/recipe-book/data/tutorials')
});
library.setData=function(values){Object.assign(this.data,values);};
library.data.query='鸡胸肉';library.render();assert.equal(library.data.rows.length,index.searchRecipes('鸡胸肉').size);
library.data.category='荤菜';library.render();assert(library.data.rows.length>0);assert(library.data.rows.every(row=>row.category==='荤菜'));
const original=store.data.recipes.length;
try {
  store.data.recipes.push(
    {recipe_id:'index-same-main',cuisine:'__index',ingredientIds:[id('鸡胸肉'),id('鸡腿肉')]},
    {recipe_id:'index-real-combination',cuisine:'__index',ingredientIds:[id('鸡肉'),id('生菜')]}
  );
  assert.deepEqual(store.select({cuisine:'__index'},1,[id('鸡肉'),id('生菜')],[],()=>0),['index-real-combination']);
}finally{store.data.recipes.splice(original);}
console.log('PASS: all 606 original foods and 1716 recipes linked, grouped aliases, multi-food search, library category filtering and no duplicate-main combination scoring');
