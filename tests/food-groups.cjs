const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const store = require('../miniprogram/utils/store');
const grouping = store.foodGroups;
const foodId = name => (store.data.foods.find(food => food.name === name)||grouping.catalog.find(food=>food.name===name)).id;
const id = foodId;
assert.deepEqual(require('../miniprogram/utils/food-groups').groups,require('../docs/miniapp/ingredient-consolidation.json').groups);
assert.equal(grouping.catalog.length,363);
const plan=require('../docs/miniapp/ingredient-consolidation.json');
const memberNames=new Set();
for(const [target,members] of Object.entries(plan.groups))for(const member of members){
  assert(!Object.hasOwn(plan.groups,member),'No chained group: '+member);
  assert(!memberNames.has(member),'No repeated member: '+member);memberNames.add(member);
}
for(const name of plan.retainDistinct)assert.equal(grouping.canonical(id(name)),id(name),'Independent: '+name);
const newGroups=require('../miniprogram/utils/food-groups').groups;
for(const [target,members] of Object.entries(newGroups))for(const member of members){
  assert.equal(grouping.canonical(id(member)),id(target));
  assert.equal(store.foodIndex.findFoods(member)[0].id,id(target));
  assert.deepEqual(store.foodIndex.recipesFor(member),store.foodIndex.recipesFor(target));
  assert.equal(grouping.cleanupRows([id(member)],[id(target)])[0].owned,true);
}
assert.deepEqual(grouping.names(['猪肚','猪腰','猪肝','猪大肠']),['猪杂']);
assert.equal(id('猪杂'),id('猪肚'));
assert.deepEqual(require('../miniprogram/utils/food-groups').representatives,plan.representatives);
for(const name of ['猪杂','鸡杂','羊杂'])assert.equal(store.foodIndex.findFoods(name)[0].name,name);
assert(grouping.catalog.find(food=>food.name==='猪杂').aliases.includes('猪肚'));
assert.equal(store.data.foods.find(food=>food.id===id('猪杂')).name,'猪肚');
const isolated=require('../miniprogram/utils/food-groups').create([{id:'old-stomach',name:'猪肚'},{id:'old-liver',name:'猪肝'}]);
assert.deepEqual(isolated.rows(['old-liver']).map(food=>food.name),['猪杂']);
assert.equal(isolated.canonical('old-liver'),'old-stomach');
assert.deepEqual(isolated.names(['猪肝']),['猪杂']);
assert.equal(store.data.foods.length,606);
assert.equal(store.data.recipes.length,1716);
for(const [owned,required] of [['猪杂','鸡杂'],['猪杂','猪血'],['鸡杂','鸡肉'],['羊杂','羊肉'],['羊杂','羊血'],['猪杂','牛百叶'],['猪杂','鸭肠']])assert(!grouping.matches(id(owned),id(required)));
assert.deepEqual(grouping.names(['鸡腿肉','鸡骨头','鸡胸肉','鸡翅','五花肉']),['鸡肉','鸡翅','猪肉']);
assert.equal(grouping.rows([id('鸡胸肉'),id('鸡腿肉'),id('鸡骨头')]).length,1);
for(const name of ['鸡肉','鸡胸肉','鸡腿肉','鸡骨头','手枪鸡腿']) {
  const expanded=grouping.expand([id(name)]);
  for(const required of ['鸡肉','鸡胸肉','鸡腿肉','鸡骨头'])assert(expanded.has(id(required)));
  assert(!expanded.has(id('鸡翅')));
  assert(!expanded.has(id('鸡肝')));
}
assert(grouping.expand([id('五花肉')]).has(id('猪肉')));
assert(grouping.expand([id('猪肉')]).has(id('五花肉')));
// 大类库存一对多满足全组；旧细分库存也按同一大类解释。
for(const [name,members] of Object.entries(require('../miniprogram/utils/food-groups').groups)) {
  for(const owned of [name,...members]) {
    const expanded=grouping.expand([id(owned)]);
    for(const required of [name,...members])assert(expanded.has(id(required)),owned+' -> '+required);
  }
}
assert(grouping.expand([id('猪里脊')]).has(id('五花肉')));
assert(grouping.expand([id('鸭肉')]).has(id('鸭架')));
assert(grouping.expand([id('鸭架')]).has(id('鸭肉')));
for(const [owned,required]of [['牛肉','牛腩'],['牛排','牛肉'],['番茄','小番茄'],['包菜','紫甘蓝'],['青椒','红椒'],['辣椒','线椒'],['魔芋','魔芋丝'],['芋头','槟榔芋']])assert(grouping.expand([id(owned)]).has(id(required)));
assert(!grouping.expand([id('辣椒')]).has(id('甜椒')));
assert(!grouping.expand([id('辣椒')]).has(id('泡小米辣')));
assert(!grouping.expand([id('豌豆粉')]).has(id('豌豆淀粉')));
for(const [owned,required]of [['虾','虾米'],['鲜香菇','干香菇'],['面粉','糯米粉'],['大米','米饭']])assert(!grouping.expand([id(owned)]).has(id(required)));
for(const [owned,required]of [['排骨','腊排骨'],['猪肉','肥肉'],['坚果','板栗'],['面条','意大利面'],['酸奶','牛奶'],['豆腐','油豆腐'],['绿豆','红豆'],['鱼','咸鱼'],['鲜菌菇','干香菇'],['豆皮','腐竹'],['血旺','血肠'],['米饭','藜麦饭'],['香肠','腊肠'],['坚果','杏仁粉']])assert(!grouping.matches(id(owned),id(required)),owned+' remains separate from '+required);
const available=grouping.expand([id('鸡肉')]);
const eligible=store.data.recipes.filter(recipe=>recipe.menu_eligible!==false&&recipe.ingredientIds.some(value=>available.has(value)));
assert(eligible.length>=160);
const state={foods:[id('鸡胸肉'),id('鸡腿肉'),id('鸡骨头'),id('生菜')]};
let fridge,uploads=0;
vm.runInNewContext(fs.readFileSync('miniprogram/pages/fridge/index.js','utf8'),{
  Page:page=>fridge=page,require:path=>path.includes('fridge-sync')?{setFoods:async values=>{uploads++;state.foods=Array.from(values);}}:{...store,load:()=>state},wx:{}
});
fridge.setData=function(values){Object.assign(this.data,values);};fridge.onLoad();fridge.onShow();
for(const name of ['鸡肉','鸡胸肉','鸡腿肉','鸡骨头']) {
  fridge.searchCatalog({detail:{value:name}});
  assert.equal(fridge.data.results.filter(food=>food.id===id('鸡肉')).length,1);
  assert(!fridge.data.results.some(food=>food.id===id('鸡胸肉')||food.id===id('鸡腿肉')));
}
fridge.remove({currentTarget:{dataset:{id:id('鸡肉')}}});
assert.deepEqual(Array.from(fridge.draftFoods),[id('生菜')]);
state.foods.push(id('手枪鸡腿'));
fridge.onHide();fridge.onUnload();assert.equal(uploads,1);assert.deepEqual(state.foods,[id('生菜')]);
const cleanup=grouping.cleanupRows([id('鸡腿肉'),id('鸡胸肉')],[id('鸡肉')]);
assert.equal(cleanup.length,1);assert(cleanup[0].owned);assert.equal(cleanup[0].id,id('鸡肉'));
assert.deepEqual(grouping.remove([id('鸡肉'),id('鸡胸肉'),id('鸡翅')],[id('鸡肉')]),[id('鸡翅')]);
fridge.draftFoods=[];
fridge.searchCatalog({detail:{value:'猪里脊'}});
assert.equal(fridge.data.results.length,1);
assert.equal(fridge.data.results[0].id,id('猪肉'));
fridge.toggle({currentTarget:{dataset:{id:fridge.data.results[0].id}}});
assert.deepEqual(Array.from(fridge.draftFoods),[id('猪肉')]);
for(const [target,members] of Object.entries(newGroups)){
  fridge.draftFoods=members.map(id);fridge.render();
  assert.equal(fridge.data.owned.length,1);assert.equal(fridge.data.owned[0].id,id(target));
  fridge.remove({currentTarget:{dataset:{id:id(target)}}});
  assert.equal(fridge.draftFoods.length,0);
  for(const member of members){
    fridge.searchCatalog({detail:{value:member}});
    assert.equal(fridge.data.results.length,1);
    assert.equal(fridge.data.results[0].id,id(target));
    fridge.toggle({currentTarget:{dataset:{id:id(target)}}});
    assert.deepEqual(Array.from(fridge.draftFoods),[id(target)]);
    fridge.toggle({currentTarget:{dataset:{id:id(target)}}});
    assert.equal(fridge.draftFoods.length,0);
  }
}
// 结果页共用大类匹配；默认葱姜蒜不缺料，真实主料仍须列为缺少。
const porkRecipe=store.data.recipes.find(recipe=>recipe.name==='红烧肉'&&recipe.ingredientIds.includes(id('五花肉')));
assert(porkRecipe);
let resultPage,resultFoods=[...new Set(porkRecipe.ingredientIds.map(grouping.canonical))];
vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{
  Page:page=>resultPage=page,
  require:path=>path.includes('utils/store')?{...store,load:()=>({foods:resultFoods}),meal:()=>({ids:[porkRecipe.recipe_id],done:[]})}:require('../miniprogram/pages/result/'+path)
});
resultPage.setData=function(values){Object.assign(this.data,values);};
resultPage.onShow();
assert.equal(resultPage.data.missing.length,0);
const other=resultFoods.find(value=>value!==id('猪肉'));
assert(other);
resultFoods=resultFoods.filter(value=>value!==other);
resultPage.onShow();
const defaultAvailable=store.availableFoods([]);
assert.deepEqual(Array.from(resultPage.data.missing),defaultAvailable.has(other)?[]:[store.data.foods.find(food=>food.id===other).name]);
resultFoods=[];
resultPage.onShow();
assert(resultPage.data.missing.includes('猪肉'),'Default aromatics must not hide missing grouped pork');
for(const name of ['小葱','大葱','姜','蒜'])assert(!resultPage.data.missing.includes(name),'Household staple should not be reported missing: '+name);
const liverRecipe=store.data.recipes.find(recipe=>recipe.ingredientIds.includes(id('猪肝')));
assert(liverRecipe);
let offalPage;
vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{
  Page:page=>offalPage=page,
  require:path=>path.includes('utils/store')?{...store,load:()=>({foods:[]}),meal:()=>({ids:[liverRecipe.recipe_id],done:[]})}:require('../miniprogram/pages/result/'+path)
});
offalPage.setData=function(values){Object.assign(this.data,values);};
offalPage.onShow();
assert(offalPage.data.missing.includes('猪杂'));
assert(!offalPage.data.missing.includes('猪肚'));
console.log('PASS: 363 grouped entries, all newly consolidated groups, no mapping chains, grouped fridge edits, one-to-many matching and cleanup');
const syncState={foods:[id('鸡胸肉'),id('生菜')]},cache={};
let remote={foodIds:[id('鸡胸肉'),id('生菜'),id('鸡腿肉')],revision:2},conflict=true;
const sandbox={module:{exports:{}},require:()=>({foodGroups:grouping,load:()=>syncState,change:fn=>fn(syncState)}),setTimeout:()=>0,wx:{
  getStorageSync:key=>cache[key],setStorageSync:(key,value)=>cache[key]=value,removeStorageSync:key=>delete cache[key],
  cloud:{callFunction:async({data})=>{
    if(data.action==='bootstrap')return {result:{ok:true,fridge:remote}};
    assert(!Object.hasOwn(data,'removedGroupIds'));
    if(conflict){conflict=false;remote={foodIds:[...remote.foodIds,id('鸡骨头'),id('番茄')],revision:3};return {result:{ok:false,code:'CONFLICT',fridge:remote}};}
    remote={foodIds:Array.from(data.foodIds),revision:4};return {result:{ok:true,fridge:remote}};
  }}
}};
vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),sandbox);
(async()=>{
  assert.equal(await sandbox.module.exports.setFoods([id('生菜')]),'已同步');
  assert.deepEqual(remote.foodIds.sort(),[id('生菜'),id('番茄')].sort());
  console.log('PASS: grouped removal survives cloud conflicts and preserves unrelated remote additions');
})().catch(error=>{console.error(error);process.exitCode=1;});
