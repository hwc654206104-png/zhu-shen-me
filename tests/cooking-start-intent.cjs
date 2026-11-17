const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const clone=x=>JSON.parse(JSON.stringify(x));
let state,writes=0,modal,navigated;
const wx={getStorageSync:k=>k==='pig_native_v2'?clone(state):undefined,setStorageSync:(k,v)=>{if(k==='pig_native_v2'){state=clone(v);writes++;}},removeStorageSync(){},navigateTo:x=>navigated=x.url,showToast(){},showModal:x=>modal=x,switchTab(){}};
global.wx=wx;
const S=require('../miniprogram/utils/store'),tutorials=require('../miniprogram/recipe-book/data/tutorials').tutorials;
const ids=S.data.recipes.filter(r=>tutorials[r.recipe_id]).slice(0,2).map(r=>r.recipe_id);
state={schema:2,foods:S.data.foods.slice(0,3).map(f=>f.id),meals:[],recent:[],profile:{}};
const foods=clone(state.foods),meal=S.create(ids,2),event=id=>({currentTarget:{dataset:{id}}});
function page(relative){let p;const absolute=path.resolve(relative);vm.runInNewContext(fs.readFileSync(absolute,'utf8'),{Page:v=>p=v,require:n=>n.includes('utils/fridge-sync')?{setFoods(){throw Error('Unexpected inventory write');}}:require(path.resolve(path.dirname(absolute),n)),wx});p.data=clone(p.data);p.setData=function(v){Object.assign(this.data,v);};return p;}
function detail(id=ids[0],query={}){const p=page('miniprogram/recipe-book/pages/detail/index.js');p.onLoad({meal:meal.id,recipe:id,...query});p.onShow();return p;}
const result=page('miniprogram/pages/result/index.js');result.onLoad({id:meal.id});result.onShow();
const baseline=writes;result.dish(event(ids[0]));let d=detail();d.view(event(ids[1]));d.chooseSource({currentTarget:{dataset:{index:0}}});d.finish();d.onHide();
assert.equal(writes,baseline,'Viewing, switching and unstarted finish must not write');assert.equal(S.meal(meal.id).started,false);
const menus=page('miniprogram/pages/menu/index.js');menus.onShow();assert.equal(menus.data.ongoing.length,0);
result.start();assert.equal(S.meal(meal.id).started,true);assert(navigated.includes(ids[0]));d=detail();d.finish();assert.deepEqual(S.meal(meal.id).done,[ids[0]]);assert.equal(S.meal(meal.id).viewId,ids[1]);d.onHide();
const beforeContinue=writes;menus.onShow();menus.continueCooking(event(meal.id));assert(navigated.includes(ids[1]));d=detail(ids[1]);d.view(event(ids[0]));assert.equal(writes,beforeContinue,'Continuing/browsing must preserve persisted progress');assert.deepEqual(S.meal(meal.id).done,[ids[0]]);assert.equal(S.meal(meal.id).viewId,ids[1]);
d=detail(ids[1]);d.finish();const completed=S.meal(meal.id);assert.equal(completed.started,false);assert.equal(completed.done.length,2);assert(completed.completedAt>=meal.createdAt);const afterComplete=writes;d.start();d.finish();result.start();assert.equal(writes,afterComplete,'Completed recipes cannot implicitly restart');menus.onShow();assert.equal(menus.data.completed.length,1);
// A fresh saved menu can be started inside detail, then ended without losing the favorite.
S.update(meal.id,m=>{m.done=[];m.started=false;delete m.completedAt;m.favorite=true;});d=detail(ids[1]);d.start();assert.equal(S.meal(meal.id).viewId,ids[1]);d.finish();menus.onShow();assert.equal(menus.data.ongoing.length,1);assert.equal(menus.data.saved.length,2);
modal=undefined;menus.endCooking(event(meal.id));assert.equal(modal,undefined,'Ending must not show a dialog');assert.equal(S.meal(meal.id).started,false);assert.deepEqual(S.meal(meal.id).done,[]);assert.equal(S.meal(meal.id).favorite,true);assert.equal(S.meal(meal.id).completedAt,undefined);assert.equal(menus.data.ongoing.length,0);assert.equal(menus.data.saved.length,2);
// Catalog and friend details retain read-only start/finish guards, including direct calls.
const readOnlyBaseline=writes;const catalog=detail(ids[0],{catalog:'1'});catalog.start();catalog.finish();catalog.view(event(ids[0]));const friend=page('miniprogram/recipe-book/pages/detail/index.js');friend.onLoad({friend:'someone',menu:'remote',recipe:ids[0]});friend.remoteMeal={ids,done:[],people:2};friend.render();friend.start();friend.finish();assert.equal(writes,readOnlyBaseline);
assert.deepEqual(state.foods,foods,'Browsing, start, finish and ending cannot consume inventory');
const html=fs.readFileSync('miniprogram/recipe-book/pages/detail/index.wxml','utf8');assert(html.includes('!readOnly && !allDone && !meal.started'));assert(html.includes('!readOnly && !allDone && meal.started'));
console.log('PASS: real-store page VM browsing without writes, explicit start, persisted continue, completion date, immediate ending with favorites preserved, read-only and inventory guards');
