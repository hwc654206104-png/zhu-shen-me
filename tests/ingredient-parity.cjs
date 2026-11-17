const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const dir='docs/miniapp/recipes/',read=n=>JSON.parse(fs.readFileSync(dir+n));
const foods=read('ingredient-catalog.json'),recipes=read('recipes.json'),identity=read('howtocook-identity-baseline.json');
const index=require('../miniprogram/data/recipe-index'),cloud=require('../cloudfunctions/pigApi/catalog.json');
assert.equal(new Set(foods.map(f=>f.id)).size,foods.length);
assert.equal(new Set(foods.map(f=>f.name)).size,foods.length);
const deleted=new Set(read('deleted-recipes.json').recipes.map(r=>r.id));
for(const old of identity.foods)if(recipes.some(r=>r.ingredient_items.some(i=>i.name===old.name)))assert(foods.some(f=>f.id===old.id&&f.name===old.name));
for(const old of identity.recipes)assert(deleted.has(old.id)||recipes.some(r=>r.recipe_id===old.id));
for(const f of foods){assert(recipes.some(r=>r.ingredient_items.some(i=>i.name===f.name)),f.name+' must have a recipe');assert(!f.aliases.some(a=>foods.some(x=>x.name===a)),'Canonical alias collision '+f.name);}
assert.deepEqual(index.foods||index.foodCatalog,foods);
assert.deepEqual([...cloud.foodIds].sort(),foods.map(f=>f.id).sort());
let page;vm.runInNewContext(fs.readFileSync('miniprogram/pages/fridge/index.js','utf8'),{Page:p=>page=p,require:p=>p.includes('fridge-sync')?{}:{foodIndex:require('../miniprogram/utils/store').foodIndex,foodGroups:require('../miniprogram/utils/food-groups').create(foods),data:{foods}},wx:{}});page.setData=function(x){Object.assign(this.data,x);};page.draftFoods=[];
for(const [query,name] of [['西红柿','番茄'],['生姜','姜'],['枝竹','腐竹'],['大虾','虾'],['豆角','豇豆']]){page.searchCatalog({detail:{value:query}});assert(page.data.results.some(f=>f.name===name),query);}
assert.notEqual(foods.find(f=>f.name==='虾').id,foods.find(f=>f.name==='虾仁').id);
assert.notEqual(foods.find(f=>f.name==='豇豆').id,foods.find(f=>f.name==='四季豆').id);
const rawShrimp=recipes.filter(r=>r.source_type==='howtocook_original'&&/^[\s*+•-]*虾\s*(?:[（(\n]|$)/m.test(r.source_ingredients));
assert(rawShrimp.length>0);for(const r of rawShrimp)assert(r.ingredient_items.some(i=>i.name==='虾'),r.name+' must retain whole shrimp');
for(const [raw,name] of [['食用盐','盐'],['白砂糖','白糖'],['郫县豆瓣酱','豆瓣酱']]){
  const matches=recipes.filter(r=>r.source_type==='howtocook_original'&&r.source_ingredients.includes(raw));
  assert(matches.length>0);
  for(const r of matches){
    const optional=(r.source_optional_ingredients||[]).some(item=>item.name===raw);
    assert(r.seasonings.includes(name)||optional,r.name+' missing '+name);
    if(optional)assert(r.source_ingredients.split('\n').some(line=>line.includes(raw)&&/可选|可不/.test(line)),r.name+' optional seasoning must be explicit in source');
  }
}
const snapshots=['recipes.json','ingredient-catalog.json'].map(n=>fs.readFileSync(dir+n,'utf8'));
cp.execFileSync(process.execPath,['scripts/import-howtocook.cjs'],{stdio:'pipe'});
for(let i=0;i<snapshots.length;i++)assert.equal(fs.readFileSync(dir+['recipes.json','ingredient-catalog.json'][i],'utf8'),snapshots[i],'Repeat import preserves IDs and content');
console.log('PASS: ingredient links, historical IDs, aliases, fridge search, cloud allowlist and repeat import');
