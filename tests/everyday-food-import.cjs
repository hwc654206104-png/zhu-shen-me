const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const records=require('../docs/miniapp/recipes/recipes.json'),audit=require('../docs/miniapp/recipes/everyday-food-import-audit.json'),source=require('../docs/miniapp/recipes/references/everyday-food/meals.json');
const S=require('../miniprogram/utils/store'),{tutorials}=require('../miniprogram/recipe-book/data/tutorials');
const imported=records.filter(r=>r.source_type==='everyday_original');
assert.equal(audit.recipes.length,audit.selected);
assert.equal(audit.recipes.filter(x=>x.action==='added').length,audit.added);
assert.equal(audit.recipes.filter(x=>x.action==='duplicate').length,audit.duplicates);
assert.equal(imported.length,audit.added);
const deleted=require('../docs/miniapp/recipes/deleted-recipes.json').recipes;
for(const row of audit.recipes){
 const s=source.find(s=>s.id===row.sourceId);assert(s);
 if(row.action==='duplicate'){assert(row.targets.every(x=>records.some(r=>r.recipe_id===x.id)));continue;}
 if(row.action.startsWith('excluded_')){assert(!records.some(r=>r.recipe_id==='everyday-'+crypto.createHash('sha256').update(row.sourceId).digest('hex').slice(0,16)));continue;}
 assert.equal(row.action,'added');
 const r=records.find(r=>r.recipe_id===row.id);assert(r);assert.deepEqual(tutorials[r.recipe_id],r);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex'),r.source_sha256);
 assert.deepEqual(r.steps,s.steps,'Never abridge source cooking instructions');
 for(const line of s.ingredients)assert(r.source_calculation.includes(line));
 assert(r.ingredient_items.every(i=>i.quantity===null&&S.data.foods.some(f=>f.name===i.name)));
 assert(r.spicy_level&&r.salt_level&&r.cuisine&&r.dish_category&&r.flavor_tags.length);
 assert(r.source_license_notice.includes('Copyright (c) 2026 Jiayu Zheng'));
 assert(r.original_amounts&&r.hide_source_credit);assert.equal(r.prep_minutes+r.cook_minutes,0);
 assert(!('nutrition' in r)&&!('kcal' in r)&&!('desc' in r),'Do not copy unverified nutrition or health claims');
 assert(!deleted.some(d=>d.id===r.recipe_id||d.name===r.name));
}
for(const name of ['榨菜肉丝','双菇炒肉片','毛豆炒肉丁','沙姜鸡','板栗烧鸭'])assert.equal(imported.find(r=>r.name===name).dish_category,'荤菜');
assert.equal(imported.find(r=>r.name==='香煎豆腐').dish_category,'素菜');
assert.equal(imported.find(r=>r.name==='板栗烧鸡').dish_category,'荤菜');
assert.equal(audit.recipes.find(r=>r.name==='土豆烧鸡').action,'duplicate');
assert.equal(imported.find(r=>r.name==='西湖牛肉羹').dish_category,'汤羹');
assert.notEqual(imported.find(r=>r.name==='玉米胡萝卜汤').meal_kind,'meat','Water chestnut is a vegetable, not a hoof');
assert(imported.find(r=>r.name==='玉米胡萝卜汤').ingredients.includes('马蹄'));
assert(imported.find(r=>r.name==='红烧鲅鱼').seasonings.includes('料酒'));
assert.equal(imported.find(r=>r.name==='白灼秋葵').spicy_level,'中辣','Do not hide chili in a blanched dish');
assert.equal(imported.find(r=>r.name==='板栗烧鸡').spicy_level,'不辣');
assert.equal(imported.find(r=>r.name==='蛤蜊冬瓜汤').dish_category,'汤羹');
assert.equal(imported.find(r=>r.name==='蛤蜊冬瓜汤').meal_kind,'meat');
assert.equal(imported.find(r=>r.name==='腐竹烧鸭').spicy_level,'中辣');
for(const name of ['沙姜鸡','酱油鸡']){
 const r=imported.find(r=>r.name===name);assert(r.ingredients.includes('鸡肉'));assert(!r.ingredients.includes('鸡胸肉'));assert.equal(r.cuisine,'粤菜');
}
assert(imported.find(r=>r.name==='香煎鲳鱼').seasonings.includes('淀粉'));
assert(imported.find(r=>r.name==='肉末蒸豆腐').seasonings.includes('蒸鱼豉油'));
assert(!S.data.foods.some(f=>f.name==='青红椒'||f.name==='姜末'||f.name==='蒜片'));
const pepper=imported.find(r=>r.name==='蚝油杏鲍菇');assert(pepper.ingredient_items.filter(i=>/青椒|红椒/.test(i.name)).every(i=>i.source_amount.includes('合计')));
let page;vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js','utf8'),{Page:p=>page=p,require:n=>n.includes('data/presentation')?require('../miniprogram/recipe-book/data/presentation'):n.includes('data/tutorials')?{tutorials}:n.includes('utils/store')?{...S,load:()=>({foods:[],meals:[]})}:{},wx:{}});
page.setData=x=>Object.assign(page.data,x);page.catalog=true;
for(const r of imported){page.recipeId=r.recipe_id;page.render();assert.equal(page.data.steps.length,r.steps.length);assert(page.data.ingredients.every(i=>i.amount&&!i.amount.includes('NaN')));assert(page.data.sourceLicenseNotice.includes('Jiayu Zheng'));}
let library;vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/library/index.js','utf8'),{Page:p=>library=p,require:path=>path.includes('utils/store')?require('../miniprogram/utils/store'):({tutorials})});library.setData=x=>Object.assign(library.data,x);library.render();for(const r of imported)assert(library.data.rows.some(x=>x.id===r.recipe_id));
console.log(`PASS: ${imported.length} pinned MIT recipes, full source coverage, deduplication, category and flavor, food links, original cuts and quantities, runtime library/detail rendering`);
