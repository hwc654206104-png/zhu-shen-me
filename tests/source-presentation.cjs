const assert=require('node:assert/strict'),fs=require('node:fs');
const {sourcePresentation}=require('../miniprogram/recipe-book/data/presentation');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const rabbit=recipes.find(r=>r.source_path==='dishes/meat_dish/冷吃兔.md');assert(rabbit);
const before=JSON.stringify(rabbit),view=sourcePresentation(rabbit);
assert.equal(view.steps.length,10,'Cold rabbit must have ten individually numbered steps');
assert(view.steps.every(s=>s.instruction&&!/^\d+\.\s/.test(s.instruction)));
assert(view.sourceFoods.includes('兔肉'));assert(view.sourceSeasonings.includes('盐'));
assert(view.sourceAmounts.some(s=>s.includes('兔肉斤数')),'Original formula remains available');
assert.equal(JSON.stringify(rabbit),before,'Presentation never changes source');
const structured={source_steps_structured:true,ingredient_items:[{name:'五花肉'}],seasonings:['生抽'],source_calculation:'',
  source_optional_ingredients:[{name:'豆皮',matched_name:null},{name:'鹌鹑蛋',matched_name:'鸡蛋'}],step_details:[
    {instruction:'### 开始制作',is_heading:true,materials:[]},
    {instruction:'5. 加入生抽 10ml；老抽 15ml；料酒 5ml；翻炒至上色。',materials:[]},
    {instruction:'6. 加入开水炖煮，放入姜 2 片；香叶 3 片；八角 2 个。',materials:[]} ]};
const grouped=sourcePresentation(structured);
assert.equal(grouped.steps.length,2,'Nested ingredient lists remain attached to their cooking action');
assert.equal(grouped.steps[0].heading,'开始制作');assert.equal(grouped.steps[1].heading,'');
assert(grouped.steps[0].instruction.includes('老抽 15ml'));
assert.deepEqual(grouped.sourceOptional,['豆皮','鹌鹑蛋']);
assert.deepEqual(grouped.sourceFoods,['五花肉'],'Optional ingredients must be presented separately');
const porkRecipe=recipes.find(recipe=>recipe.source_path==='dishes/meat_dish/红烧肉/简易红烧肉.md');
const porkView=sourcePresentation(porkRecipe);
assert.equal(porkView.steps.length,15,'Red-braised pork has six preparation actions and nine cooking actions');
assert.deepEqual(porkView.steps.map(step=>step.stepNumber),[1,2,3,4,5,6,1,2,3,4,5,6,7,8,9],
  'Preparation and cooking sections each start numbering from one');
assert(porkView.steps.some(step=>step.instruction.includes('生抽')&&step.instruction.includes('老抽')&&step.instruction.includes('料酒')),
  'Sauce quantities must remain in one cooking action');
assert(!porkView.steps.some(step=>/^(?:生抽|老抽|料酒|香叶|八角)\s*\d/.test(step.instruction)),
  'Nested condiment amounts are not standalone cooking actions');
assert(porkView.sourceOptional.includes('豆皮')&&porkView.sourceOptional.includes('鹌鹑蛋'),
  'Original optional ingredients must be visible despite normalized matching names');
assert(!porkView.sourceFoods.includes('鸡蛋'),'Optional eggs must not be shown as required');
const variations=sourcePresentation({ingredient_items:[],seasonings:[],source_calculation:'',step_details:[{instruction:'### 家常版\n1. 切菜\n   保持大小一致\n2. 下锅',materials:[]},{instruction:'### 简易版',materials:[]},{instruction:'1. 焯水\n2. 炒熟',materials:[]}]});
assert.equal(variations.steps.length,4);assert.equal(variations.steps[0].heading,'家常版');assert(variations.steps[0].instruction.includes('保持大小一致'));assert.equal(variations.steps[2].heading,'简易版');
assert.deepEqual(variations.steps.map(step=>step.stepNumber),[1,2,1,2],'Legacy source variants also number independently');
for(const r of recipes.filter(r=>r.source_type==='howtocook_original')){const snapshot=JSON.stringify(r),p=sourcePresentation(r);assert(p.steps.length>0,r.name);assert(p.steps.every(s=>s.instruction.trim()));assert.equal(JSON.stringify(r),snapshot);}
const wxml=fs.readFileSync('miniprogram/recipe-book/pages/detail/index.wxml','utf8');assert(wxml.includes('bindtap="toggleSource"'));assert(wxml.includes('wx:if="{{sourceOpen}}"'));assert(!wxml.includes('{{recipe.source_references[0].url}}'));
console.log('PASS: cold rabbit 10 steps, variants and continuations, folded source amounts, 372 original records preserved');
const originals=recipes.filter(r=>r.source_type==='howtocook_original');
const audit=[];
for(const r of originals){
 const p=sourcePresentation(r);
 let sectionNumber=0;
 for(const step of p.steps){
  if(step.heading)sectionNumber=0;
  assert.equal(step.stepNumber,++sectionNumber,r.name+' must restart numbering at each section and increment within it');
 }
 assert(p.steps.every(s=>!/^\s*#{1,6}\s*$/.test(s.instruction)),r.name+' stray heading');
 assert(p.steps.every(s=>!/^\s*[-*•+]\s+/m.test(s.instruction)),r.name+' unformatted bullet');
 assert(p.steps.every(s=>!/extends CylindricalContainer/.test(s.instruction)),r.name+' diagram in cooking steps');
 audit.push({id:r.recipe_id,name:r.source_title||r.name,sourceBlocks:r.step_details.length,displaySteps:p.steps.length,foldedNotes:!!p.sourceNotes});
}
const cake=originals.find(r=>(r.source_title||r.name)==='微波炉蛋糕');
if(cake.source_steps_structured)assert.equal(sourcePresentation(cake).steps.length,cake.step_details.filter(step=>!step.is_heading).length,'Structured bullet actions remain intact');
else assert(sourcePresentation(cake).steps.length>cake.step_details.length,'Legacy bullet instructions split');
const eighteen=originals.find(r=>(r.source_title||r.name)==='桂林十八酿');assert(sourcePresentation(eighteen).sourceNotes.includes('Abstract Wrapper'),'Diagram preserved in notes');
fs.writeFileSync('build/source-presentation-audit.json',JSON.stringify({checkedAt:new Date().toISOString(),records:audit.length,recipes:audit},null,2));
console.log('PASS: every original recipe audited for bullet steps, stray markers and non-cooking diagrams');
// Verify content coverage independently of expected step counts or parser output.
for(const r of originals){
 const p=sourcePresentation(r),shown=p.steps.map(s=>s.heading+'\n'+s.instruction).join('\n')+'\n'+p.sourceNotes;
 const normalize=s=>s.replace(/\s+/g,'');
 for(const block of r.step_details)for(const line of block.instruction.split(/\r?\n/)){
   const text=line.replace(/^\s*(?:#{1,6}\s+|[-*•+]\s+|\d+[.)、]\s*)/,'').trim();
   if(!text||/^(?:#{1,6}|`{3,}[^`]*|~{3,}|[-*_]{3,})$/.test(text))continue;
   assert(normalize(shown).includes(normalize(text)),r.name+' lost original text: '+text);
 }
}
const blocks=sourcePresentation({ingredient_items:[],seasonings:[],source_calculation:'',step_details:[{instruction:'1. 先处理肉类',materials:[]},{instruction:'准备酱汁\n- 加入生抽\n- 加入蚝油',materials:[]}]});
assert.equal(blocks.steps[0].instruction,'先处理肉类','Next section must not attach to preceding step');
assert.equal(blocks.steps[1].instruction,'准备酱汁');
console.log('PASS: full original line coverage and independent paragraph boundaries');
assert(wxml.includes('{{item.stepNumber || index+1}}'),'Detail UI uses section numbering with a legacy sequential fallback');
