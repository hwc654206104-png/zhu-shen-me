const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const store=require('../miniprogram/utils/store');
const id=name=>store.data.foods.find(food=>food.name===name).id;
const beef=id('牛肉'),lettuce=id('生菜'),tomato=id('番茄'),garlic=id('蒜');
const originalLength=store.data.recipes.length;
const fixture=(recipe_id,ingredientIds,extra={})=>({recipe_id,name:recipe_id,ingredientIds,cuisine:'__pantry',spicy_level:'不辣',salt_level:'适中',...extra});
try{
  store.data.recipes.push(fixture('ready-beef',[beef,garlic]),fixture('ready-beef-2',[beef]),
    fixture('short-beef',[beef,tomato]),fixture('short-lettuce',[lettuce,tomato]),
    fixture('heavy-beef',[beef,tomato,lettuce],{familiar:true}),
    fixture('unrelated',[lettuce]),
    fixture('wrong-taste',[beef],{spicy_level:'特辣'}));
  const prefs={cuisine:'__pantry',spicy:'不辣'};
  const pick=(count,extra={},previous=[])=>store.select({...prefs,...extra},count,[beef],[],()=>0,previous);
  assert.deepEqual(pick(2).slice().sort(),['ready-beef','ready-beef-2']);
  assert.deepEqual(pick(3),[],'Default mode must remain strict');
  const exploratory=store.select({...prefs,strictPantry:false},1,[beef],[],()=>0);
  assert.deepEqual(exploratory,['short-beef'],'Loose mode can choose a dish using a stocked main plus one missing ingredient even when ready dishes exist');
  const readyChoice=store.select({...prefs,strictPantry:false},1,[beef],[],()=>0.9);
  assert(['ready-beef','ready-beef-2'].includes(readyChoice[0]),'Loose mode can still choose a ready dish');
  const strictChoice=store.select({...prefs,strictPantry:true},1,[beef],[],()=>0);
  assert(['ready-beef','ready-beef-2'].includes(strictChoice[0]),'Strict mode cannot select the missing ingredient');
  const extraPantry=[beef,lettuce,tomato,id('鸡蛋')];
  const single=store.select({...prefs,strictPantry:true},1,extraPantry,[],()=>0);
  assert.equal(single.length,1);
  const singleRecipe=store.data.recipes.find(recipe=>recipe.recipe_id===single[0]);
  assert(singleRecipe.ingredientIds.every(food=>store.availableFoods(extraPantry).has(food)),
    'Strict mode uses a subset of available ingredients');
  assert(extraPantry.some(food=>!singleRecipe.ingredientIds.includes(food)),
    'Strict mode must not require one recipe to consume or cover the entire fridge');
  store.data.recipes.push(fixture('default-only',[garlic]));
  const loose=pick(3,{strictPantry:false});
  assert.deepEqual(loose.slice().sort(),['ready-beef','ready-beef-2','short-beef'],
    'Ready dishes precede shopping; fewer absent foods precede balance or familiarity');
  assert.equal(pick(4,{strictPantry:false}).length,4,'Stocked beef can match recipes with absent accompaniments');
  assert.deepEqual(pick(5,{strictPantry:false}),[],'Unrelated and aromatic-only recipes cannot fill a loose menu');
  assert.deepEqual(store.select({...prefs,strictPantry:false},1,[],[],()=>0),[]);
  assert.deepEqual(store.select({...prefs,strictPantry:false},1,[garlic],[],()=>0),[],
    'Even explicitly stocked garlic is not a substantive inventory match');
  for(const recipe of store.data.recipes.filter(r=>loose.includes(r.recipe_id))){
    assert(recipe.ingredientIds.includes(beef));assert.equal(recipe.spicy_level,'不辣');
  }
  store.data.recipes.push(fixture('short-beef-alternative',[beef,tomato]));
  const refreshed=pick(3,{strictPantry:false},loose);
  assert.equal(refreshed.length,3);
  assert(refreshed.includes('short-beef-alternative'));
  assert(!refreshed.includes('heavy-beef'),'A new low-shopping recipe is sufficient; do not buy more merely to make every dish new');
}finally{store.data.recipes.splice(originalLength);}

// Drive the actual page handlers with a wx storage/navigation stub.
const cache={},calls=[],navigation=[];
const wx={getStorageSync:key=>cache[key],setStorageSync:(key,value)=>cache[key]=value,
  navigateTo:({url})=>navigation.push(url),redirectTo:({url})=>navigation.push(url),showToast:()=>{}};
function page(path,stub){
  let out;vm.runInNewContext(fs.readFileSync(path,'utf8'),{wx,Page:value=>out=value,require:()=>stub});
  out.setData=function(values){Object.assign(this.data,values);};return out;
}
const pageStore={data:store.data,load:()=>({foods:[beef],recent:[]}),
  select:(...args)=>{calls.push(['select',...args]);return [args[5]&&args[5].length?'new-dish':'dish'];},
  create:(...args)=>{calls.push(['create',...args]);return {id:'new-menu'};}};
const wizard=page('miniprogram/pages/wizard/index.js',pageStore);
wizard.onLoad();assert.equal(wizard.data.strictPantry,true);
wizard.pantryMode({detail:{value:[]}});assert.equal(cache.pig_strict_pantry_v1,false);
const restored=page('miniprogram/pages/wizard/index.js',pageStore);
restored.onLoad();assert.equal(restored.data.strictPantry,false);
restored.taste({currentTarget:{dataset:{key:'spicy',value:'不辣'}}});
restored.generate();assert.equal(calls[0][1].strictPantry,false);assert.equal(calls[1][3].strictPantry,false);
assert.equal(calls[0][1].spicy,'不辣');assert(navigation[0].includes('new-menu'));
const prior={id:'old-menu',ids:['old-dish'],done:[],people:3,preferences:calls[1][3]};
pageStore.meal=()=>prior;
const result=page('miniprogram/pages/result/index.js',pageStore);
result.onLoad({id:prior.id});result.refresh();
assert.equal(calls[2][1].strictPantry,false);assert.equal(calls[3][3].strictPantry,false);
assert.equal(calls[2][6],prior.ids,'Refresh forwards the current menu for deduplication');
restored.pantryMode({detail:{value:['strict']}});
assert.equal(cache.pig_strict_pantry_v1,true);
restored.generate();assert.equal(calls[4][1].strictPantry,true);assert.equal(calls[5][3].strictPantry,true);
assert.deepEqual(Object.keys(cache),['pig_strict_pantry_v1'],'The preference does not write pantry or cloud state');
const wxml=fs.readFileSync('miniprogram/pages/wizard/index.wxml','utf8');
assert(wxml.includes('bindchange="pantryMode"')&&wxml.includes('checked="{{strictPantry}}"'));
assert.equal((wxml.match(/仅用冰箱食材/g)||[]).length,1);
console.log('PASS: strict default, loose pantry eligibility/readiness/taste/refresh, checkbox memory and generate/refresh preference propagation');
