const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const store=require('../miniprogram/utils/store');
const id=name=>store.data.foods.find(food=>food.name===name).id;
const original=[id('猪肉'),id('茄子')];
const cache={pig_native_v2:{schema:2,foods:original.slice(),meals:[],recent:[],profile:{}}};
let navigation='',syncWrites=0;
const wx={getStorageSync:key=>cache[key],setStorageSync:(key,value)=>cache[key]=value,
  navigateTo:({url})=>navigation=url};
global.wx=wx;
function page(path,requireFn){
  let out;vm.runInNewContext(fs.readFileSync(path,'utf8'),{wx,Page:value=>out=value,require:requireFn});
  out.setData=function(values){Object.assign(this.data,values);};return out;
}
const wizard=page('miniprogram/pages/wizard/index.js',()=>store);
wizard.generate();
assert(navigation.startsWith('/pages/result/index?id='));
assert.deepEqual(cache.pig_native_v2.foods,original,'Generating a menu must not consume ingredients');
assert.equal(cache.pig_native_v2.meals.length,1);
const result=page('miniprogram/pages/result/index.js',path=>path.includes('utils/store')?store:require('../miniprogram/pages/result/'+path));
result.onLoad({id:cache.pig_native_v2.meals[0].id});result.onShow();
assert.deepEqual(cache.pig_native_v2.foods,original,'Previewing an unconfirmed menu must preserve inventory');
const fridge=page('miniprogram/pages/fridge/index.js',path=>path.includes('fridge-sync')?{setFoods:async()=>{syncWrites++;}}:store);
fridge.onLoad();fridge.onShow();fridge.onHide();fridge.onUnload();
assert.equal(fridge.data.owned.length,2);
assert.deepEqual(cache.pig_native_v2.foods,original,'Returning without editing must preserve inventory');
assert.equal(syncWrites,0,'Returning without editing must not send a destructive stock write');
assert(cache.pig_native_v2.meals.every(meal=>meal.done.length===0));
delete global.wx;
console.log('PASS: real menu selection/create/preview/return flow preserves pork and eggplant without consumption or stock writes');
