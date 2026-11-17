const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../miniprogram/utils/store');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const source=recipes.find(r=>r.source_path==='dishes/meat_dish/红烧肉/简易红烧肉.md');
const indexed=S.byId.get(source.recipe_id);
const food=name=>S.data.foods.find(item=>item.name===name).id;
assert(source.ingredient_items.find(item=>item.name==='鸡蛋').optional);
assert(indexed.optionalIngredientIds.includes(food('鸡蛋')));
assert(indexed.ingredientIds.includes(food('鸡蛋')),'Optional food remains linked for inventory/search compatibility');
assert(!S.requiredFoods(indexed).includes(food('鸡蛋')));
for(const name of ['冬笋','枸杞'])assert(S.data.foods.some(item=>item.name===name),'Keep historical food identity: '+name);
const fixture={...indexed,recipe_id:'__optional-pork',cuisine:'__optional'};
const original=S.data.recipes.length;
try{
 S.data.recipes.push(fixture);S.byId.set(fixture.recipe_id,fixture);
 assert.deepEqual(S.select({cuisine:'__optional',strictPantry:true},1,[food('猪肉')],[],()=>0),[fixture.recipe_id],
  'Strict generation needs the pork, but not optional eggs');
 for(const strictPantry of [true,false])assert.deepEqual(S.select({cuisine:'__optional',strictPantry},1,[food('鸡蛋')],[],()=>0),[],
  'Optional eggs alone cannot satisfy the pork recipe');
 let page;const state={foods:[food('猪肉')]};
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{
  Page:value=>page=value,require:path=>path.includes('utils/store')?{...S,load:()=>state,meal:()=>({ids:[fixture.recipe_id],done:[]})}:{},wx:{}
 });
 page.setData=function(values){Object.assign(this.data,values);};page.onShow();
 assert.equal(page.data.missing.length,0,'Result shopping list must not request optional eggs');
 assert.deepEqual(state.foods,[food('猪肉')],'Viewing optional ingredients never consumes stock');
}finally{S.data.recipes.length=original;S.byId.delete(fixture.recipe_id);}
console.log('PASS: optional food identity/link retained; strict and loose require real mains; result excludes optional shopping without stock writes');
