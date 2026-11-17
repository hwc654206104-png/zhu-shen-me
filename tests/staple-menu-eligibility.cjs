const assert=require('node:assert/strict');
const S=require('../miniprogram/utils/store');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const {isMealStaple,applyMealEligibility}=require('../scripts/menu-eligibility.cjs');
const id=name=>S.data.foods.find(food=>food.name===name).id;
const recipe=name=>recipes.find(r=>(r.source_title||r.name)===name);
const candidates=names=>{const available=S.availableFoods(names.map(id));return S.data.recipes.filter(r=>r.menu_eligible!==false&&S.requiredFoods(r).every(food=>available.has(food)));};
for(const name of ['面条','挂面','细面条']){
 const food=S.foodIndex.findFoods(name)[0];
 const selected=S.select({},1,[food.id],[],()=>0.37);
 assert.equal(selected.length,1,name+' must generate a stocked noodle dish');
 assert(['葱油拌面','阳春面','麻油拌面','老干妈拌面','沙县拌面'].includes(S.byId.get(selected[0]).name));
 assert(S.foodIndex.recipesFor(name).has(recipe('葱油拌面').recipe_id));
}
assert(candidates(['面条','鸡蛋','番茄']).some(r=>r.name==='番茄鸡蛋面'));
assert(candidates(['米饭','鸡蛋']).some(r=>r.name==='酱油炒饭'));
assert(candidates(['米粉','鸡蛋','包菜','胡萝卜']).some(r=>r.name==='炒米粉'));
assert.equal(S.select({},1,[id('米饭')],[],()=>0.37).length,1,'Stocked rice must generate');
let restored=0;
for(const r of recipes){
 const indexed=S.byId.get(r.recipe_id);
 assert.equal(indexed.menu_eligible,r.menu_eligible!==false,r.name+' source/runtime eligibility parity');
 assert.deepEqual(indexed.ingredientIds,r.ingredient_items.map(i=>id(i.name)),r.name+' index/detail ingredient parity');
 if(!isMealStaple(r))continue;
 restored++;
 const pantry=S.requiredFoods(indexed).map(S.foodGroups.canonical);
 assert(candidates(pantry.map(foodId=>S.data.foods.find(f=>f.id===foodId).name)).some(row=>row.recipe_id===r.recipe_id),r.name+' strict pantry is viable');
}
// Indexed omissions must not turn meat or vegetables into an apparently complete noodle meal.
for(const [name,main] of [['麻油拌面','面条'],['热干面','面条'],['西红柿鸡蛋挂面','面条'],['豆角焖面','五花肉'],['炸酱面','猪肉'],['扬州炒饭','午餐肉']]){
 const r=recipe(name),indexed=S.byId.get(r.recipe_id);
 assert(r.ingredient_items.some(i=>i.name===main&&!i.optional),name+' must require its actual source main');
 const available=S.availableFoods(S.requiredFoods(indexed).filter(food=>S.foodGroups.canonical(food)!==S.foodGroups.canonical(id(main))));
 assert(!S.requiredFoods(indexed).every(food=>available.has(food)),name+' cannot be strictly ready without '+main);
}
for(const name of ['汤面','螺蛳粉','基础牛奶面包','披萨饼皮','凉粉','空气炸锅照烧鸡饭','微波炉蛋糕','炒河粉','蛋包饭'])assert.equal(recipe(name).menu_eligible,false,name+' remains excluded pending complete ingredients / nonmeal scope');
assert(!recipe('蛋包饭').ingredient_items.some(i=>i.name==='火腿肠'),'Do not force one source protein alternative');
assert(recipe('蛋包饭').source_ingredients.includes('火腿肠或鸡胸肉'));
assert(recipe('炒河粉').source_ingredients.includes('猪肉/牛肉'));
for(const r of recipes.filter(r=>r.retirement_reason||['甜品','饮品','调料','半成品'].includes(r.source_category)))assert.equal(isMealStaple(r),false,r.name);
const fixture={...recipe('葱油拌面'),canonical_source_id:'same-source'};
const aliases=applyMealEligibility([{...fixture,recipe_id:'first'},{...fixture,recipe_id:'old-alias'}]);
assert.equal(aliases[0].menu_eligible,true);assert.equal(aliases[1].menu_eligible,false);
assert(!isMealStaple({...fixture,retirement_reason:'已下架'}));
assert(!isMealStaple({...fixture,ingredient_items:[{name:'小葱'}]}));
assert(!isMealStaple({...fixture,ingredient_items:[{name:'面条',optional:true}]}));
assert(!isMealStaple({...fixture,steps:[]}));
console.log('PASS: '+restored+' actual staple meals, noodles aliases, tomato/egg noodles, rice/powder strict pantry, missing-main guards, archive exclusions, alias dedup and runtime/detail parity');
