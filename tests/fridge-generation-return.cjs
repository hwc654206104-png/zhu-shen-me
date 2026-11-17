const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=value=>value===undefined?value:JSON.parse(JSON.stringify(value));
function harness(remote,cache={}){
 const state={foods:['pork','eggplant']},writes=[];
 const sandbox={module:{exports:{}},require:()=>({load:()=>copy(state),change:fn=>fn(state)}),setTimeout:()=>0,wx:{
  getStorageSync:key=>copy(cache[key]),setStorageSync:(key,value)=>cache[key]=copy(value),removeStorageSync:key=>delete cache[key],
  cloud:{callFunction:async({data})=>{
   if(data.action==='bootstrap')return {result:{ok:true,fridge:copy(remote)}};
   writes.push(copy(data));remote.foodIds=copy(data.foodIds);remote.revision++;
   return {result:{ok:true,fridge:copy(remote)}};
  }}
 }};
 vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),sandbox);
 return {api:sandbox.module.exports,state,writes,cache};
}
(async()=>{
 // Returning from menu generation can resume App synchronization. An empty
 // uninitialized cloud record must not consume the local ingredients.
 const remote={foodIds:[],revision:0},h=harness(remote);
 await h.api.sync();
 assert.deepEqual([...h.state.foods],['pork','eggplant'],'First cloud bootstrap must not clear local inventory');
 assert.deepEqual(remote.foodIds,['pork','eggplant']);assert.equal(h.writes.length,1);
 assert.equal(h.cache.pig_fridge_pending_v2,undefined);
 // A real, versioned deletion from another device remains authoritative.
 remote.foodIds=[];remote.revision++;
 await h.api.sync();assert.deepEqual(h.state.foods,[]);assert.equal(h.writes.length,1);
 // A stale response must not resurrect/clear a more recently acknowledged state.
 remote.foodIds=['stale'];remote.revision=1;
 await h.api.sync();assert.deepEqual(h.state.foods,[]);
 // Without a cached snapshot, an actual versioned remote clear is still accepted.
 const deleted=harness({foodIds:[],revision:3});await deleted.api.sync();
 assert.deepEqual(deleted.state.foods,[]);assert.equal(deleted.writes.length,0);
 console.log('PASS: initial cloud empty cannot consume ingredients; versioned cross-device deletion and stale-read protection');
})().catch(error=>{console.error(error);process.exitCode=1;});
