const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),vm=require('node:vm');
const audit=require('../docs/miniapp/recipes/jcyicai-import-audit.json');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const S=require('../miniprogram/utils/store'),{tutorials}=require('../miniprogram/recipe-book/data/tutorials');
assert.equal(audit.added,4);assert.equal(audit.duplicates,2);assert.equal(audit.empty,4);
for(const row of audit.recipes){
 const raw=fs.readFileSync('docs/miniapp/recipes/references/jcyicai-cookbook/'+row.path,'utf8');
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),row.sha256);
 if(row.action==='excluded_empty'){assert(!recipes.some(r=>r.source_path===row.path));continue;}
 const r=recipes.find(r=>r.recipe_id===row.id);assert(r);
 if(row.action==='duplicate_existing'){assert.notEqual(r.source_type,'jcyicai_original');continue;}
 assert.deepEqual(tutorials[r.recipe_id],r);assert.equal(r.source_license,'MIT');assert(r.source_license_notice.includes('Copyright (c) 2022 Jason Chen'));
 assert(r.original_amounts);assert(r.ingredient_items.every(i=>i.quantity===null&&i.source_amount));
 assert(r.cuisine&&r.dish_category&&r.flavor_tags.length&&r.spicy_level&&r.salt_level);
 const expected=raw.split('## 做法')[1].split('## 小贴士')[0].split(/\r?\n/).filter(l=>/^\s*-\s*\S/.test(l)).map(l=>l.replace(/^\s*-\s*/,'').replace(/\*\*/g,''));
 assert.deepEqual(r.steps,expected,'Every source instruction retained');
 assert(r.ingredient_items.every(i=>S.data.foods.some(f=>f.name===i.name)));
}
assert.equal(recipes.find(r=>r.name==='三杯鸡').spicy_level,'微辣');
assert.equal(recipes.find(r=>r.name==='清炒苋菜').meal_kind,'veg');
assert.equal(recipes.find(r=>r.name==='爆炒蛳螺').meal_kind,'meat');
assert.equal(recipes.find(r=>r.name==='爆炒蛳螺').dish_category,'水产');
let library;vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/library/index.js','utf8'),{Page:p=>library=p,require:path=>path.includes('utils/store')?require('../miniprogram/utils/store'):({tutorials})});library.setData=x=>Object.assign(library.data,x);library.render();
for(const row of audit.recipes.filter(r=>r.action==='added'))assert(library.data.rows.some(r=>r.id===row.id));
console.log('PASS: four complete MIT recipes, two deduplications, four empty exclusions, exact source steps, food links and library visibility');
