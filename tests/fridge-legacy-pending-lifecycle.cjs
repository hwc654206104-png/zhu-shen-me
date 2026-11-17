const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const foods=['pork','eggplant','pepper'].map(id=>({id,name:id,aliases:[]}));
const groups=require('../miniprogram/utils/food-groups').create(foods);
const index=require('../miniprogram/utils/food-recipe-index').create({foods,recipes:[]},groups);
const copy=value=>value===undefined?value:JSON.parse(JSON.stringify(value));
const state={foods:['pepper']},cache={pig_fridge_pending_v2:{foodIds:['pepper'],baseFoodIds:['pork','eggplant'],removedGroupIds:['pork','eggplant'],expectedRevision:0,operationId:'legacy_pending_operation'}},remote={foodIds:[],revision:0};
let page,failWrites=true,failReads=false,stockWrites=0;
const store={load:()=>copy(state),change:fn=>fn(state),foodGroups:groups,foodIndex:index};
const wx={getStorageSync:key=>copy(cache[key]),setStorageSync:(key,value)=>cache[key]=copy(value),removeStorageSync:key=>delete cache[key],cloud:{callFunction:async({data})=>{
 if(data.action==='bootstrap'){if(failReads)throw Error('offline_bootstrap');return {result:{ok:true,fridge:copy(remote)}};}
 stockWrites++;if(failWrites)throw Error('same_cloud_write_failure');
 if(data.expectedRevision!==remote.revision)return {result:{ok:false,code:'CONFLICT',fridge:copy(remote)}};
 remote.foodIds=copy(data.foodIds);remote.revision++;return {result:{ok:true,fridge:copy(remote)}};
}}};
const context={module:{exports:{}},require:()=>store,wx,setTimeout:()=>0};
vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),context);const sync=context.module.exports;
vm.runInNewContext(fs.readFileSync('miniprogram/pages/fridge/index.js','utf8'),{Page:value=>page=value,require:path=>path.includes('fridge-sync')?sync:store,wx});
page.setData=function(values){Object.assign(this.data,values);};
(async()=>{
 // Preserve the user's current one-item state. Do not restore old base foods.
 await sync.sync();assert.deepEqual([...state.foods],['pepper']);
 page.onLoad();page.onShow();
 // User explicitly adds pork again through the actual fridge page.
 page.toggle({currentTarget:{dataset:{id:'pork'}}});page.onHide();
 await sync.sync();
 assert.deepEqual([...state.foods].sort(),['pepper','pork'],'Old pending baseline must not delete an explicitly re-added food');
 assert(!state.foods.includes('eggplant'),'Do not restore rejected historical stock');
 // A generate/preview/return cycle cannot rewrite the pending user's target.
 page.onShow();page.onHide();await sync.sync();
 assert.deepEqual([...state.foods].sort(),['pepper','pork']);
 // Another device may create the first cloud record before the retry. The
 // current explicit re-add must survive that conflict too; old deleted stock
 // must stay deleted.
 remote.foodIds=['eggplant'];remote.revision=1;
 failWrites=false;await sync.sync();
 assert.deepEqual([...remote.foodIds].sort(),['pepper','pork']);assert.equal(cache.pig_fridge_pending_v2,undefined);
 assert(stockWrites>=2);
 // Bootstrap itself can fail throughout editing, so there was never an
 // initial-empty rebase to normalize the legacy base before revision one.
 state.foods=['pepper'];delete cache.pig_fridge_confirmed_v2;
 cache.pig_fridge_pending_v2={foodIds:['pepper'],baseFoodIds:['pork','eggplant'],removedGroupIds:['pork','eggplant'],expectedRevision:0,operationId:'second_legacy_pending'};
 failReads=true;page.onLoad();page.onShow();page.toggle({currentTarget:{dataset:{id:'pork'}}});page.onHide();await sync.sync();
 assert.deepEqual([...state.foods].sort(),['pepper','pork']);
 remote.foodIds=['eggplant'];remote.revision=1;failReads=false;await sync.sync();
 assert.deepEqual([...state.foods].sort(),['pepper','pork'],'Explicit re-add survives an entirely offline bootstrap then versioned recovery');
 assert.deepEqual([...remote.foodIds].sort(),['pepper','pork']);
 // The re-add must not make the ingredient immune to a later explicit delete.
 page.onShow();page.remove({currentTarget:{dataset:{id:'pork'}}});page.onHide();await sync.sync();
 assert.deepEqual([...state.foods],['pepper']);assert.deepEqual([...remote.foodIds],['pepper']);
 console.log('PASS: legacy pending + real fridge re-add/hide + failed writes/retry preserves only current user target without historical recovery');
})().catch(error=>{console.error(error);process.exitCode=1;});
