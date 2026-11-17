const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
function harness(handler){const cache={},state={foods:['local']},timers=[];const sandbox={module:{exports:{}},require:()=>({change:fn=>fn(state)}),setTimeout:fn=>{timers.push(fn);return timers.length;},wx:{getStorageSync:k=>copy(cache[k]),setStorageSync:(k,v)=>cache[k]=copy(v),removeStorageSync:k=>delete cache[k],cloud:{callFunction:handler}}};vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),sandbox);return {api:sandbox.module.exports,cache,state,timers};}
(async()=>{
 let h=harness(async()=>({result:{ok:true,fridge:{foodIds:['remote'],revision:2}}}));await h.api.sync();assert.equal(h.state.foods.join(','),'remote');
 h=harness(async()=>({result:{ok:true,fridge:{foodIds:'corrupt',revision:2}}}));assert.equal(await h.api.sync(),'pending');assert.equal(h.state.foods.join(','),'local');
 let offline=true,revision=0,saved=[],calls=0;
 h=harness(async({data})=>{calls++;if(offline)throw Error('offline');if(data.action==='bootstrap')return {result:{ok:true,fridge:{foodIds:saved,revision}}};saved=data.foodIds;revision++;return {result:{ok:true,fridge:{foodIds:saved,revision}}};});
 assert.equal(await h.api.setFoods(['new']),'pending');assert.equal(h.state.foods.join(','),'new');assert(h.cache.pig_fridge_pending_v2);offline=false;await h.api.sync();assert.equal(saved.join(','),'new');assert.equal(h.cache.pig_fridge_pending_v2,undefined);
 let release;const gate=new Promise(r=>release=r);let first=true;
 h=harness(async({data})=>{if(data.action==='bootstrap')return {result:{ok:true,fridge:{foodIds:[],revision:0}}};if(first){first=false;await gate;}saved=data.foodIds;return {result:{ok:true,fridge:{foodIds:saved,revision:1}}};});
 const a=h.api.setFoods(['first']);await new Promise(r=>setImmediate(r));const b=h.api.setFoods(['latest']);release();await Promise.all([a,b]);assert.equal(saved.join(','),'latest');assert.equal(h.state.foods.join(','),'latest');assert.equal(h.cache.pig_fridge_pending_v2,undefined);
 let app,syncs=0,refreshes=0;vm.runInNewContext(fs.readFileSync('miniprogram/app.js','utf8'),{App:x=>app=x,getCurrentPages:()=>[{route:'pages/home/index',onShow:()=>refreshes++}],console:{info(){},error(){}},require:()=>({sync:async()=>{syncs++;}}),wx:{getStorageSync:()=>true,cloud:{callFunction:async()=>({result:{ok:true,recipeVersion:'test',fridge:{foodIds:[],revision:0}}})}}});assert.equal(await app.bootstrap(),true);assert.equal(syncs,1);assert.equal(refreshes,1);app.globalData.cloudInitialized=true;app.onShow();await new Promise(r=>setImmediate(r));assert.equal(syncs,2);assert.equal(refreshes,2);
 console.log('PASS: cloud fridge restoration, corrupt response protection, offline recovery, concurrent edits and launch/resume integration');
})().catch(e=>{console.error(e);process.exitCode=1;});
