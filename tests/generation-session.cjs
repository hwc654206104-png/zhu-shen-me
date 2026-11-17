const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const S=require('../miniprogram/utils/store');
const food=S.data.foods.find(f=>f.name==='青菜');
assert(food,'青菜 must remain in catalog');
const pantry=[food.id],before=JSON.stringify(pantry),owned=S.availableFoods(pantry);
const candidates=S.data.recipes.filter(r=>r.menu_eligible!==false&&S.requiredFoods(r).every(id=>owned.has(id)));
assert(candidates.length>=2,'Actual green-vegetable pantry has multiple ready dishes');
const exhausted=candidates.map(r=>r.recipe_id);
for(let turn=0;turn<3;turn++){
 const next=S.select({strictPantry:true},1,pantry,exhausted,()=>turn/10);
 assert.equal(next.length,1,'A new request must still work after all eligible recipes appeared historically');
 assert(S.requiredFoods(S.byId.get(next[0])).every(id=>owned.has(id)));
}
let history=[],current=[],seen=new Set();
for(let turn=0;turn<=candidates.length;turn++){
 const next=S.select({strictPantry:true},1,pantry,history,()=>0.3,current);
 if(!next.length){assert(seen.size>0);break;}
 assert(!seen.has(next[0]),'Within one refresh chain, never recycle a seen dish');
 seen.add(next[0]);current=next;history.push(next.slice().sort().join('|'));
}
assert.equal(seen.size,candidates.length,'Visit each available actual green dish once');
assert.deepEqual(S.select({},1,pantry,history,()=>0.3,current),[],'Same request may exhaust its fresh alternatives');
assert.equal(S.select({},1,pantry,history,()=>0.3).length,1,'Leaving and starting a new request resets hard exhaustion');
assert.equal(JSON.stringify(pantry),before,'Generation must not consume inventory');
const len=S.data.recipes.length;
try{
 S.data.recipes.push(...['a','b','c'].map(recipe_id=>({recipe_id:'session-'+recipe_id,name:recipe_id,cuisine:'__session',ingredientIds:[food.id]})));
 const prefs={cuisine:'__session'},first=S.select(prefs,2,pantry,[],()=>0);
 const key=first.slice().sort().join('|');
 const next=S.select(prefs,2,pantry,[key],()=>0,first);
 assert.equal(next.length,2);assert.notEqual(next.slice().sort().join('|'),key,'A+B and B+A are one menu');
 const used=[key,next.slice().sort().join('|')];
 assert.deepEqual(S.select(prefs,2,pantry,used,()=>0,next),[],'Do not combine only previously seen dishes');
 assert.equal(S.select(prefs,2,pantry,used,()=>0).length,2,'New request must not retain refresh exclusions');
}finally{S.data.recipes.splice(len);}
let page,created,selected;
vm.runInNewContext(fs.readFileSync('miniprogram/pages/wizard/index.js','utf8'),{
 Page:p=>page=p,require:()=>({data:S.data,load:()=>({foods:pantry,recent:history}),select:(...args)=>{selected=args;return ['x'];},create:(...args)=>{created=args;return {id:'m'};}}),
 wx:{getStorageSync:()=>true,navigateTo:()=>{}}
});
page.setData=values=>Object.assign(page.data,values);page.generate();
assert.equal(selected[3].length,0,'Wizard starts a new request instead of forwarding permanent recent history');
assert.deepEqual(Array.from(created[2].__generationHistory),['x']);
console.log('PASS: green-only stock, historical exhaustion reset, request-only refresh uniqueness, wizard lifecycle and inventory unchanged');
