const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const recipes=require('../docs/miniapp/recipes/recipes.json'),foods=require('../docs/miniapp/recipes/ingredient-catalog.json');
const {parseIngredients,condimentNames}=require('../scripts/recipe-ingredient-parser.cjs');
const parse=s=>parseIngredients([s]);
assert.equal(parse('木耳（泡发）50 克')[0].name,'木耳');assert.equal(parse('木耳（泡发）50 克')[0].amount,'50 克');
assert.equal(parse('荞麦面（干）70 克')[0].name,'荞麦面');
assert.deepEqual(parse('青红椒 各半个').map(x=>x.name),['青椒','红椒']);
assert(parse('青红椒 各半个').every(x=>x.amount.includes('合计')));
assert.deepEqual(parse('葱姜蒜 适量').map(x=>x.name),['小葱','姜','蒜']);
assert.deepEqual(parse('无'),[]);assert.deepEqual(parse('水 300 毫升'),[]);assert.deepEqual(parse('竹签 5 根'),[]);
assert.equal(parse('隔夜米饭 200 克')[0].name,'熟米饭');assert.equal(parse('大米 200 克')[0].name,'大米');
assert.equal(parse('奥尔良腌料 20 克')[0].kind,'seasoning');
assert.equal(parse('照烧汁（生抽 1 勺、蜂蜜 1 勺）')[0].kind,'seasoning');
assert.throws(()=>parse('草鱼/黑鱼 1 条'));assert.throws(()=>parse('欧芹或香菜 少许'));
assert(recipes.length<=2000);assert.equal(new Set(recipes.map(x=>x.name)).size,recipes.length);assert.equal(new Set(recipes.map(x=>x.recipe_id)).size,recipes.length);
const old=require('../build/recipe-import/r1-b870df1f6dbb4fc0-documents.json');
for(const r of old.filter(x=>x.recipes).flatMap(x=>x.recipes))assert(recipes.some(x=>x.recipe_id===r.recipe_id),'Lost existing saved-menu ID '+r.name);
const oldFoods=old.find(x=>x.index).foods;
for(const f of oldFoods)assert(foods.some(x=>x.id===f.id&&x.name===f.name));
for(const f of foods.filter(f=>!oldFoods.some(o=>o.id===f.id))){
 assert(!condimentNames.has(f.name),'Condiment leaked into fridge: '+f.name);
 assert(!/[0-9]|适量|少许|原谱|半只|调料|酱料|用量/.test(f.name),'Invalid food '+f.name);
 assert(recipes.some(r=>r.ingredient_items.some(i=>i.name===f.name)));
}
const blocked=require('../docs/miniapp/recipes/deleted-recipes.json').recipes;
for(const r of recipes)assert(!blocked.some(x=>x.id===r.recipe_id||x.name===r.name));
const tidy=require('../docs/miniapp/recipes/references/tidy-cookbook/recipes.json');
for(const row of require('../docs/miniapp/recipes/tidy-cookbook-import-audit.json').recipes.filter(x=>x.action==='added')){
 const source=tidy.find(x=>x[0]===row.sourceId),r=recipes.find(x=>x.recipe_id===row.id);
 assert.deepEqual(r.steps,source[7].split('@'));assert.equal(r.source_ingredients,source[6]);
 assert.equal(r.source_sha256,crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex'));
 assert(r.source_license_notice.includes('2026 ruiovo'));assert(r.ingredient_items.every(i=>i.quantity===null));
}
for(const ref of ['fridge-expiry','chisha']){const rows=require('../docs/miniapp/recipes/references/'+ref+'/dishes.json'),how=require('../docs/miniapp/recipes/references/'+ref+'/howto.json'),audit=require('../docs/miniapp/recipes/'+ref+'-import-audit.json');for(const row of audit.recipes.filter(x=>x.action==='added')){const r=recipes.find(x=>x.recipe_id===row.id);assert(r);assert.deepEqual(r.steps,how[r.name].steps);assert(r.source_license_notice.includes('MIT License'));assert(r.ingredient_items.every(i=>i.quantity===null));const source=rows.find(x=>x.name===r.name);for(const i of source.ingredients)assert(r.source_calculation.includes(i));}}
const howto=require('../docs/miniapp/recipes/references/chishenme/howto.json');
for(const r of recipes.filter(x=>x.source_type==='chishenme_original'))assert.deepEqual(r.steps,howto[r.name].steps.split(/[①②③④⑤⑥⑦⑧⑨⑩]/).map(x=>x.trim()).filter(Boolean));
for(const r of recipes.filter(x=>['everyday_original','tidy_original','chishenme_original'].includes(x.source_type))){
 assert(r.cuisine&&r.dish_category&&r.spicy_level&&r.salt_level&&r.flavor_tags.length);
 if(['甜品','饮品'].includes(r.dish_category))assert.equal(r.menu_eligible,false,r.name);
 if(r.dish_category==='主食'){
  const {isMealStaple,isReviewedMeal}=require('../scripts/menu-eligibility.cjs');
  assert.equal(r.menu_eligible,isMealStaple(r)||isReviewedMeal(r),r.name);
 }
}
assert.equal(require('../docs/miniapp/recipes/data-audit.json').metadata.rejectedRecords,0);
// Exercise the actual vendored decoder in an environment with no Buffer, process, atob or wx APIs.
const pakoModule={exports:{}};vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/data/inflate.js','utf8'),{module:pakoModule,exports:pakoModule.exports});
const codecModule={exports:{}};vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/data/codec.js','utf8'),{module:codecModule,require:p=>p==='./inflate'?pakoModule.exports:require('../miniprogram/recipe-book/data/text-codec')});
const data=require('../miniprogram/data/recipe-index');let count=0;
for(const chunk of data.metadata.chunks){const packed=require('../'+chunk.file);assert.equal(packed.format,3);const result=codecModule.exports.unpack(packed);assert.equal(JSON.stringify(result),JSON.stringify(recipes.slice(count,count+chunk.count)));count+=chunk.count;}
assert.equal(count,recipes.length);assert.throws(()=>codecModule.exports.unpack({format:3,text:'AAAA'}));
let packageBytes=0;function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+f.name;if(f.isDirectory())walk(p);else packageBytes+=fs.statSync(p).size;}}walk('miniprogram/recipe-book');assert(packageBytes<2*1024*1024,'Offline recipe subpackage exceeds WeChat 2 MiB');
console.log(`PASS: ${recipes.length} recipes, baseline IDs, deleted-name guard, ingredient parser, source text preservation, classifications, offline decoder without native APIs, ${packageBytes} byte subpackage`);
