const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const audit=require('../docs/miniapp/recipes/sichuan-import-audit.json');
const store=require('../miniprogram/utils/store');
const {tutorials}=require('../miniprogram/recipe-book/data/tutorials');
assert.equal(audit.sourceDocuments,312);assert.equal(audit.sourceRecipes.length,312);
assert.equal(audit.added+audit.linkedExisting,312);
assert.equal(new Set(audit.sourceRecipes.map(r=>r.file)).size,312);
assert.equal(new Set(recipes.map(r=>r.name.normalize('NFKC').replace(/\s/g,''))).size,recipes.length);
let detail;
vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js','utf8'),{Page:p=>detail=p,require:n=>n.includes('sichuan-license')?require('../miniprogram/recipe-book/data/sichuan-license'):n.includes('data/presentation')?require('../miniprogram/recipe-book/data/presentation'):n.includes('data/tutorials')?{tutorials}:n.includes('utils/store')?{...store,load:()=>({foods:[],meals:[]})}:{},wx:{}});
detail.setData=function(v){Object.assign(this.data,v);};
detail.catalog=true;
const deleted=new Set(require('../docs/miniapp/recipes/deleted-recipes.json').recipes.map(r=>r.id));
for(const row of audit.sourceRecipes){
 if(deleted.has(row.id)){assert(!recipes.some(r=>r.recipe_id===row.id));continue;}
 const recipe=recipes.find(r=>r.recipe_id===row.id);assert(recipe);
 const source=recipe.source_type==='sichuan_original'&&recipe.source_path==='latex/'+row.file?recipe:recipe.source_variants.find(v=>v.source_path==='latex/'+row.file);
 assert(source,row.file);
 const raw=fs.readFileSync('docs/miniapp/recipes/references/sichuan-cookbook/latex/'+row.file);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),source.source_sha256);
 assert(source.source_ingredients && source.source_calculation && source.steps.length);
 assert(!source.steps.some(s=>/\\(?:begin|end|ingredient|step)/.test(s)),'No TeX controls in visible steps');
 detail.recipeId=recipe.recipe_id;
 detail.sourceIndex=source===recipe?0:recipe.source_variants.indexOf(source)+1;
 detail.render();
 assert(detail.data.sourceOriginal);assert.equal(detail.data.sourceCredit,'四川菜谱（1972年版开源整理）');
 assert(detail.data.sourceLicenseNotice.includes('Redistribution and use'));
 assert.equal(detail.data.recipe.source_calculation,source.source_calculation);
 assert(detail.data.steps.length>0);assert(!detail.data.ingredients.some(i=>/NaN|0原谱/.test(i.amount)));
 detail.chooseSource({currentTarget:{dataset:{index:0}}});
 assert.equal(detail.data.recipe.recipe_id,recipe.recipe_id);
}
for(const r of recipes){
 assert(r.cuisine&&r.dish_category&&r.cooking_method&&r.flavor_tags.length&&r.spicy_level&&r.salt_level,r.name);
 const indexed=store.byId.get(r.recipe_id);assert.deepEqual(indexed.flavor_tags,r.flavor_tags);assert.equal(indexed.dish_category,r.dish_category);
}
for(const r of recipes.filter(r=>r.source_type==='sichuan_original')){
 assert(r.ingredient_items.every(i=>i.quantity===null&&i.source_amount),'Retain original historical units');
 assert.equal(r.cuisine,'川菜');assert.equal(r.source_license,'BSD-3-Clause');
 if(/熊掌|鹿筋|鱼翅|雪猪/.test(r.name))assert.equal(r.menu_eligible,false);
 if(/辣椒|海椒|辣油|辣子|辣酱|红油|豆瓣/.test(r.steps.join('')))assert.notEqual(r.spicy_level,'不辣',r.name);
 assert(!r.ingredient_items.some(i=>/^(柴|杠炭|细麻绳|纱布|新纱布|土饼子|锯末|硝|贝)$/.test(i.name)),r.name+' must not contain tools or truncated foods');
 if(r.source_historical_materials.length)assert.equal(r.menu_eligible,false,r.name);
}
for(const name of ['鸡皮慈笋','鸡皮冬笋'])assert(!recipes.some(r=>r.name===name));
assert(!recipes.some(r=>r.name==='干贝烧冬苋菜'));
const historicalIds=new Set(store.data.foods.filter(f=>f.id.startsWith('sichuan-food-')).map(f=>f.id));
for(const r of store.data.recipes.filter(r=>r.source_type==='howtocook_original'))assert(!r.ingredientIds.some(id=>historicalIds.has(id)),r.name+' source vocabularies must stay isolated');
for(const name of ['柴','杠炭','硝','新纱布','细麻绳','土饼子','贝'])assert(!store.data.foods.some(f=>f.name===name),name+' must not appear in the fridge');
for(let i=1;i<=18;i++)if(i!==18)assert(recipes.some(r=>r.recipe_id==='mainstream-20261022-'+String(i).padStart(3,'0')),'Existing editorial ID survives');
console.log('PASS: all 312 source files/hash mappings, unique records, original units, source variant navigation, all-recipe classifications and runtime parity');
