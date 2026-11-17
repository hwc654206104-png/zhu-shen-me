const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),{createRequire}=require('node:module');
const {parseOperation,isOptionalIngredient,optionalIngredientName}=require('../scripts/howtocook-steps.cjs');
const plain=s=>s.replace(/!\[[^\]]*\]\([^\n]*?\)/g,'').replace(/\[([^\]]+)\]\([^\n]*?\)/g,'$1').replace(/[`_]/g,'').replace(/\*\*/g,'').replace(/^\s*\*\s+/gm,'• ').trim();
const dir=path.resolve('docs/miniapp/recipes/references/howtocook-full');
const tree=JSON.parse(fs.readFileSync('build/recipe-research/howtocook-tree.json','utf8'));
const source=p=>fs.readFileSync(path.join(dir,p),'utf8');
const operation=text=>text.split('## 操作')[1]?.split(/^## /m)[0]?.trim()||'';
const pork=parseOperation(operation(source('dishes/meat_dish/红烧肉/简易红烧肉.md')),plain);
const actions=pork.filter(s=>!s.is_heading);
assert.equal(actions.length,15,'Six prep actions and nine cooking actions, not twenty-two fragmented actions');
assert.equal(pork.filter(s=>s.is_heading).length,2);
assert(actions.find(s=>s.instruction.startsWith('5. 融化后')).instruction.includes('生抽 10ml\n  - 老抽 15ml\n  - 料酒 5ml'));
assert(actions.find(s=>s.instruction.startsWith('6. 加入')).instruction.includes('香叶 3 片\n  - 八角 2 个'));
assert(!actions.some(s=>/^(?:生抽|老抽|料酒|香叶|八角)\s*[0-9]/.test(s.instruction)));
assert(actions.every(s=>s.section==='原材料准备'||s.section==='开始制作'));
const duck=parseOperation(operation(source('dishes/meat_dish/乡村啤酒鸭.md')),plain).filter(s=>!s.is_heading);
assert.equal(duck.length,14);
assert(duck.find(s=>s.instruction.startsWith('5. 烧鸭肉')).instruction.includes('29 分钟加入'));
assert.equal(parseOperation('1. 放入锅中\n续行说明\n\n  - 加生抽\n  - 加老抽\n\n2. 煮熟',plain).length,2);
assert.equal(parseOperation('- 清洗\n- 切块\n- 煮熟',plain).length,3);
assert.equal(parseOperation('先准备原料。\n\n再下锅煮熟。',plain).length,2,'Unlisted paragraphs remain separate actions');
assert(isOptionalIngredient('- 鸡蛋（可选）'));
assert(isOptionalIngredient('- 鹌鹑蛋（可选，没有可以用鸡蛋）：0-2个'));
assert(!isOptionalIngredient('- 五花肉：500g'));
assert(!isOptionalIngredient('- 鸡蛋（不可选择生食）'));
assert.equal(optionalIngredientName('- 主料：`鸡蛋`（可选）',plain),'鸡蛋');
assert.equal(optionalIngredientName('- 土豆 = 一个（可选）',plain),'土豆');
assert.equal(optionalIngredientName('- 谷朊粉 ¼ ~ ½ cup（可选）',plain),'谷朊粉');
// A full-source scan checks that restructuring does not discard original text.
let scanned=0,nested=0,optional=0;
const normalize=s=>plain(s).replace(/\s/g,'');
for(const entry of tree.tree.filter(e=>e.type==='blob'&&e.path.startsWith('dishes/')&&e.path.endsWith('.md')&&!e.path.includes('/template/'))){
 const text=source(entry.path),op=operation(text);if(!op)continue;
 const details=parseOperation(op,plain);
 assert.equal(normalize(details.map(s=>s.instruction).join('\n')),normalize(op),entry.path+' must preserve source words and order');
 assert(details.every(s=>typeof s.section==='string'&&Array.isArray(s.materials)),entry.path);
 if(/^\s{2,}[-*+] /m.test(op))nested++;
 if(text.split('## 必备原料和工具')[1]?.split(/^## /m)[0]?.split('\n').some(isOptionalIngredient))optional++;
 scanned++;
}
console.log(`PASS: ${scanned} HowToCook sources preserve all operation text; ${nested} nested-list recipes; ${optional} optional-ingredient recipes; pork 15 and duck 14 complete actions`);
// Evaluate only the importer's hash-verified source-reading phase. Never run its
// merge/write phase, so this test cannot overwrite catalogs or generated assets.
const importer=path.resolve('scripts/import-howtocook.cjs');
const context={require:createRequire(importer),__dirname:path.dirname(importer)};
const sourcePhase=fs.readFileSync(importer,'utf8').split('// Preserve IDs of ALL old dishes')[0];
vm.runInNewContext(sourcePhase+';globalThis.parsedEntries=entries;',context);
const entries=context.parsedEntries,redPork=entries.find(r=>r.name==='简易红烧肉');
assert.deepEqual(Array.from(redPork.ingredient_items.filter(i=>!i.optional),i=>i.name),['五花肉','姜','小葱']);
assert(redPork.ingredient_items.some(i=>i.name==='鸡蛋'&&i.optional===true),'Keep optional ingredient identity');
assert.deepEqual(Array.from(redPork.source_optional_ingredients,i=>i.name),['鸡蛋','豆皮','鹌鹑蛋']);
assert(redPork.source_calculation.includes('鹌鹑蛋（可选'));
assert.equal(redPork.step_details.filter(s=>!s.is_heading).length,15);
for(const recipe of entries){
 const optionalMatched=new Set(recipe.source_optional_ingredients.map(i=>i.matched_name).filter(Boolean));
 assert(recipe.ingredient_items.every(i=>!i.optional||optionalMatched.has(i.name)),recipe.name+' optional flags require explicit source evidence');
 assert(recipe.source_optional_ingredients.every(i=>!/厨房秤|秒表|雪克瓶|搅拌器/.test(i.name)),recipe.name+' tools must not be displayed as food');
 assert(recipe.menu_eligible!==true||recipe.ingredient_items.some(i=>!i.optional),recipe.name+' recommendations need real required ingredients');
}
const previousSource=JSON.parse(fs.readFileSync('docs/miniapp/recipes/recipes-howtocook.json','utf8'));
for(const previous of previousSource){const current=entries.find(r=>r.source_path===previous.source_path);assert.deepEqual(Array.from(current.ingredient_items,i=>i.name),previous.ingredient_items.map(i=>i.name),previous.name+' indexed identities preserved');}
console.log(`PASS: in-memory importer checks ${entries.length} sources, explicit optional flags and all indexed identities preserved, no catalog or build writes`);
