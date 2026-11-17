const assert=require('node:assert/strict');
const store=require('../miniprogram/utils/store');
const id=name=>store.data.foods.find(food=>food.name===name).id;
const key=ids=>ids.slice().sort().join('|');
const beef=id('牛肉'),lettuce=id('生菜'),garlic=id('蒜'),tomato=id('番茄');
const start=store.data.recipes.length;
const recipe=(recipe_id,ingredientIds,extra={})=>({recipe_id,name:recipe_id,cuisine:'__refresh',spicy_level:'不辣',salt_level:'适中',ingredientIds,...extra});
const prefs={cuisine:'__refresh',strictPantry:false,spicy:'不辣'};
try{
  store.data.recipes.push(recipe('a',[beef]),recipe('b',[lettuce]));
  assert.deepEqual(store.select(prefs,2,[beef,lettuce],['b|a'],()=>0,['a','b']),[],
    'Two candidates for two dishes offer no replacement, even when history is unsorted');
  assert.deepEqual(store.select({...prefs,strictPantry:true},2,[beef,lettuce],['b|a'],()=>0,['b','a']),[]);
  store.data.recipes.push(recipe('c',[beef,tomato]),recipe('unrelated',[tomato]),recipe('aromatic',[garlic]),
    recipe('wrong-taste',[beef],{spicy_level:'特辣'}));
  const fresh=store.select(prefs,2,[beef,lettuce],['b|a'],()=>0,['a','b']);
  assert.equal(fresh.length,2);assert(fresh.includes('c'),'A genuinely unseen recipe beats recombining old recipes');
  assert.notEqual(key(fresh),'a|b');
  assert(!fresh.some(r=>['unrelated','aromatic','wrong-taste'].includes(r)));
  assert(fresh.includes('b'),'A new meat dish may reuse an old vegetable to retain a mixed meal');
  assert.deepEqual(store.select({...prefs,strictPantry:true},2,[beef,lettuce],['b|a','aromatic'],()=>0,['a','b']),[],
    'Strict refresh must never use the missing-tomato option');
  // Force old, familiar ready dishes to outnumber the beam width and shortlist size.
  const old=[];
  for(let n=0;n<80;n++){old.push('old-'+n);store.data.recipes.push(recipe('old-'+n,[beef],{familiar:true}));}
  store.data.recipes.push(recipe('fresh-short',[beef,tomato]),recipe('fresh-heavy',[beef,tomato,lettuce]));
  const oldHistory=[old.join('|'),'c|b|a'];
  const crowded=store.select(prefs,1,[beef],oldHistory,()=>0,['a']);
  assert.deepEqual(crowded,['fresh-short'],'Unseen options must survive finite shortlisting/beam; fewer missing wins among new dishes');
  const another=store.select(prefs,1,[beef],[...oldHistory,'fresh-short'],()=>0,['fresh-short']);
  assert.deepEqual(another,['fresh-heavy'],'Do not lock loose refresh to its old shopping bound');
  store.data.recipes.push(recipe('fresh-ready',[beef],{familiar:false}));
  for(const count of [1,2,3]){
    const regenerated=store.select({...prefs,strictPantry:true},count,[beef],[...oldHistory,'aromatic'],()=>0,['a']);
    assert.equal(regenerated.length,count);
    assert(regenerated.includes('fresh-ready'),'Strict re-entry must retain the only unseen ready dish despite 80 familiar old candidates');
  }
}finally{store.data.recipes.splice(start);}

// Real data: the former six-recipe cycle must open up across repeated refreshes.
const pantry=['排骨','生菜'].map(id),owned=store.availableFoods(pantry),stocked=store.foodGroups.expand(pantry);
let current=[],recent=[],seen=new Set(),menus=new Set(),needsShopping=0;
for(let turn=0;turn<100;turn++){
  const menu=store.select({strictPantry:false},2,pantry,recent,()=>0.3,current);
  if(!menu.length)break;
  assert.equal(menu.length,2);assert.notEqual(key(menu),key(current));
  assert(!menus.has(key(menu)),'Do not cycle old combinations while unseen recipes remain');
  if(turn)assert(menu.some(rid=>!seen.has(rid)),'Each refresh should introduce an unseen recipe');
  for(const rid of menu){
    const r=store.byId.get(rid);
    assert(r.ingredientIds.some(food=>stocked.has(food)));
    if(store.requiredFoods(r).some(food=>!owned.has(food)))needsShopping++;
    seen.add(rid);
  }
  menus.add(key(menu));current=menu;recent=[key(menu),...recent];
}
assert(seen.size>30);assert(needsShopping>0);
assert.deepEqual(store.select({strictPantry:false},2,pantry,recent,()=>0.3,current),[],
  'After all recipes were seen, stop instead of Cartesian recombinations of old dishes');
// Refresh history belongs to a single request; new requests may reuse historical menus.
const scenarios=[];
for(const strictPantry of [false,true])for(const count of [1,2,3])for(const restart of [false,true]){
  let cur=[],history=[],shown=new Set(),keys=new Set(),stopped=false;
  for(let turn=0;turn<(restart?3:100);turn++){
    const menu=store.select({strictPantry},count,pantry,history,()=>0.3,restart?[]:cur);
    if(!menu.length){stopped=true;break;}
    if(!restart){
      assert(!keys.has(key(menu)),'Refresh history must not repeat regardless of order');
      if(turn)assert(menu.some(rid=>!shown.has(rid)),'No old-only Cartesian menu within a request');
    }
    if(strictPantry)for(const rid of menu)assert(store.requiredFoods(store.byId.get(rid)).every(food=>owned.has(food)));
    menu.forEach(rid=>shown.add(rid));keys.add(key(menu));history.unshift(key(menu));cur=menu;
  }
  if(restart)assert(!stopped,'New generation must not stop due to permanent historical exhaustion');
  else {
    assert(stopped,'Finite recipe supply should eventually stop within a request');
    if(!strictPantry)assert(shown.size>30,'Loose refresh must escape the six-ready-recipe subset');
  }
  scenarios.push({strictPantry,count,restart,menus:keys.size,recipes:shown.size});
}
// Persisted keys normalize old order and recover history from retained meals.
const recoveredIds=store.data.recipes.slice(2,4).map(r=>r.recipe_id);
const cache={pig_native_v2:{schema:2,foods:pantry,meals:[{id:'previous',ids:recoveredIds.slice().reverse()}],recent:['z|a','a|z',...Array.from({length:35},(_,n)=>'history-'+n)],profile:{}}};
const priorWx=global.wx;
global.wx={getStorageSync:key=>cache[key],setStorageSync:(key,value)=>cache[key]=value};
try{
  const restored=store.load();assert.equal(restored.recent.filter(key=>key==='a|z').length,1);
  assert(restored.recent.includes(key(recoveredIds)),'Retained meals recover keys forgotten by the old 30-window');
  const real=store.data.recipes.filter(r=>r.menu_eligible!==false).slice(0,2).map(r=>r.recipe_id);
  store.create(real,2,{strictPantry:false});
  assert.equal(cache.pig_native_v2.recent.length,38,'Do not silently discard history after 30 menus');
  assert.equal(cache.pig_native_v2.recent[0],key(real));
  cache.pig_native_v2={schema:2,foods:pantry,meals:[],recent:[],profile:{}};
  const persistedKeys=new Set();let persistedCurrent=[],stopped=false;
  for(let turn=0;turn<100;turn++){
    const saved=store.load();
    const menu=store.select({strictPantry:false},2,saved.foods,saved.recent,()=>0.3,persistedCurrent);
    if(!menu.length){stopped=true;break;}
    assert(!persistedKeys.has(key(menu)),'Real create/load must retain history beyond thirty menus');
    persistedKeys.add(key(menu));store.create(menu,2,{strictPantry:false});persistedCurrent=menu;
  }
  assert(stopped&&persistedKeys.size>30);
  assert.equal(store.load().recent.length,persistedKeys.size);
}finally{if(priorWx===undefined)delete global.wx;else global.wx=priorWx;}
console.log('PASS: unordered history, hard novelty/exhaustion, finite beam, strict pantry, persistent history recovery; real ribs/lettuce '+menus.size+' menus/'+seen.size+' recipes; scenarios '+JSON.stringify(scenarios));
