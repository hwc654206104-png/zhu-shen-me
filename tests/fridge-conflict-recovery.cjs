const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
let api;const cache={},state={foods:['old','keep']},timers=[],requests=[];
let remote={foodIds:['old','keep','other-device'],revision:3},conflict=true;
const sandbox={module:{exports:{}},require:()=>({load:()=>copy(state),change:fn=>fn(state)}),setTimeout:fn=>{timers.push(fn);return timers.length;},wx:{
 getStorageSync:k=>copy(cache[k]),setStorageSync:(k,v)=>cache[k]=copy(v),removeStorageSync:k=>delete cache[k],cloud:{callFunction:async({data})=>{
  requests.push(copy(data));if(data.action==='bootstrap')return {result:{ok:true,fridge:copy(remote)}};
  assert.deepEqual(Object.keys(data).sort(),['action','expectedRevision','foodIds','operationId'].sort(),'Local merge metadata must not leak into strict cloud API');
  if(conflict){conflict=false;remote={foodIds:[...remote.foodIds,'racing-addition'],revision:4};return {result:{ok:false,code:'CONFLICT',fridge:copy(remote)}};}
  assert.equal(data.expectedRevision,remote.revision);remote={foodIds:copy(data.foodIds),revision:remote.revision+1};return {result:{ok:true,fridge:copy(remote)}};
 }}
}};
vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),sandbox);api=sandbox.module.exports;
(async()=>{
 assert.equal(await api.setFoods(['keep','new']),'已同步');
 assert.deepEqual([...remote.foodIds].sort(),['keep','new','other-device','racing-addition'].sort());
 assert.deepEqual([...state.foods].sort(),[...remote.foodIds].sort());assert.equal(cache.pig_fridge_pending_v2,undefined);
 const writes=requests.filter(r=>r.action==='fridge.set');assert.equal(writes.length,2);assert.notEqual(writes[0].operationId,writes[1].operationId,'Rebased payload must use a fresh receipt ID');
 let detail;vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js','utf8'),{Page:p=>detail=p,require:p=>p.includes('utils/fridge-sync')?api:p.includes('utils/store')?{foodGroups:require('../miniprogram/utils/food-groups').create([]),load:()=>copy(state)}:{},wx:{switchTab(){}}});
 detail.data.allDone=true;detail.data.cleanupFoods=[{id:'new',owned:true}];detail.data.cleanupSelected=['new'];detail.cleanup();await api.sync();
 assert(!state.foods.includes('new'),'Meal cleanup must remove the selected item locally');assert(!remote.foodIds.includes('new'),'Meal cleanup must remove it remotely too');assert(remote.foodIds.includes('other-device'));
 console.log('PASS: automatic conflict recovery, local deletion, unrelated remote additions, strict request fields and fresh idempotency receipts');
})().catch(e=>{console.error(e);process.exitCode=1;});
