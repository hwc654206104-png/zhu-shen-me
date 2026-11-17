const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const S=require('../miniprogram/utils/store'),tutorials=require('../miniprogram/recipe-book/data/tutorials').tutorials;
const recipe=S.data.recipes.find(r=>tutorials[r.recipe_id].ingredient_items.length>=2),id=recipe.recipe_id;
let page;const state={foods:recipe.ingredientIds.slice(0,1),meals:[{favorite:true,ids:[id]}]};
const meal={ids:[id],done:[id],people:2};
vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js','utf8'),{Page:p=>page=p,require:p=>p.includes('utils/recipe-favorites')?require('../miniprogram/utils/recipe-favorites'):p.includes('data/presentation')?require('../miniprogram/recipe-book/data/presentation'):p.includes('data/tutorials')?{tutorials}:p.includes('utils/store')?{...S,load:()=>state,meal:()=>meal}:{},wx:{}});
page.setData=function(v){Object.assign(this.data,v);};page.catalog=true;page.recipeId=id;page.render();assert.equal(page.data.catalogFavorited,true);
page.catalog=false;page.mealId='test';page.data.cleanupSelected=['stale',...recipe.ingredientIds];page.render();assert.equal(page.data.cleanupSelected.join(','),state.foods.join(','));assert.equal(page.data.cleanupSelectableCount,1);page.selectAllCleanup();assert.equal(page.data.cleanupSelected.length,0);page.selectAllCleanup();assert.equal(page.data.cleanupSelected.length,1);
assert(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.wxml','utf8').includes('cleanupSelected.length===cleanupSelectableCount'));
let result,stored;vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{Page:p=>result=p,require:p=>p.includes('utils/recipe-favorites')?require('../miniprogram/utils/recipe-favorites'):p.includes('utils/store')?{...S,meal:()=>stored,load:()=>state}:{},wx:{}});result.setData=function(v){Object.assign(this.data,v);};
for(const m of [undefined,{ids:[]},{ids:['missing-recipe']}]){stored=m;result.onShow();assert(result.data.error);assert.equal(result.data.items.length,0);}
stored=meal;result.onShow();assert.equal(result.data.error,'');assert.equal(result.data.items.length,1);
assert(fs.readFileSync('miniprogram/pages/result/index.wxml','utf8').includes('wx:if="{{error}}"'));
console.log('PASS: existing favorite status, stale cleanup selection, select-all label and unavailable-menu fallback/recovery');
