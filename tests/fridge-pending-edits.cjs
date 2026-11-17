const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const copy=value=>value===undefined?value:JSON.parse(JSON.stringify(value));
function harness(initial,remote,confirmed){
 const state={foods:initial.slice()},cache={},requests=[];let offline=false,gate,release;
 if(confirmed)cache.pig_fridge_confirmed_v2=copy(confirmed);
 const wx={getStorageSync:key=>copy(cache[key]),setStorageSync:(key,value)=>cache[key]=copy(value),removeStorageSync:key=>delete cache[key],cloud:{callFunction:async({data})=>{
  requests.push(copy(data));if(offline)throw Error('offline');
  if(data.action==='bootstrap'){const snapshot=copy(remote);if(gate){const wait=gate;gate=null;await wait;}return {result:{ok:true,fridge:snapshot}};}
  if(data.expectedRevision!==remote.revision)return {result:{ok:false,code:'CONFLICT',fridge:copy(remote)}};
  remote.foodIds=copy(data.foodIds);remote.revision++;return {result:{ok:true,fridge:copy(remote)}};
 }}};
 const sandbox={module:{exports:{}},require:()=>({load:()=>copy(state),change:fn=>fn(state)}),setTimeout:()=>0,wx};
 vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),sandbox);
 return {api:sandbox.module.exports,state,cache,requests,offline:value=>offline=value,hold:()=>{gate=new Promise(resolve=>release=resolve);},release:()=>release()};
}
(async()=>{
 const migrateRemote={foodIds:['pork','remote-carrot'],revision:7},migration=harness(['pork','eggplant'],migrateRemote);
 await migration.api.sync();
 assert.deepEqual([...migration.state.foods].sort(),['eggplant','pork','remote-carrot']);
 assert(migration.cache.pig_fridge_confirmed_v2);
 assert.equal(migration.requests.filter(request=>request.action==='fridge.set').length,1);
 await migration.api.sync();assert.equal(migration.requests.filter(request=>request.action==='fridge.set').length,1,'Migration writes only once');
 migrateRemote.foodIds=['pork'];migrateRemote.revision++;
 await migration.api.sync();assert.deepEqual([...migration.state.foods],['pork'],'Newer deletion must not be migrated back');
 migration.state.foods.push('stale-eggplant');
 await migration.api.sync();assert.deepEqual([...migration.state.foods],['pork'],'Known baseline plus equal revision must not union stale local entries');
 const remote={foodIds:['pork'],revision:4};
 const h=harness(['pork','eggplant','tomato'],remote);
 // An edit made before this installation has a cloud baseline must not discard
 // unchanged local vegetables merely because an older cloud list lacks them.
 await h.api.setFoods(['pork','eggplant','tomato','cabbage']);
 assert.deepEqual([...h.state.foods].sort(),['pork','eggplant','tomato','cabbage'].sort(),'Local retained foods must survive first pending merge');
 const baseline={foodIds:['pork'],revision:2},r2=copy(baseline),q=harness(['pork'],r2,baseline);
 q.offline(true);await q.api.setFoods(['pork','eggplant']);await q.api.setFoods(['pork','eggplant','tomato']);
 q.offline(false);await q.api.sync();
 assert.deepEqual([...q.state.foods].sort(),['pork','eggplant','tomato'].sort(),'Second offline edit must preserve the first unsent addition');
 // Actual cross-device removal of confirmed ingredients still applies while
 // this device adds an unrelated food.
 r2.foodIds=['tomato'];r2.revision++;
 await q.api.setFoods(['pork','eggplant','tomato','cabbage']);
 assert.deepEqual([...q.state.foods].sort(),['tomato','cabbage'].sort());
 // A bootstrap started before an edit may return late. It must process the
 // pending edit, rather than apply its captured snapshot over the new foods.
 const r3={foodIds:['pork'],revision:1},late=harness(['pork'],r3,r3);
 late.hold();const pull=late.api.sync();const edit=late.api.setFoods(['pork','eggplant']);late.release();
 await Promise.all([pull,edit]);assert.deepEqual([...late.state.foods].sort(),['eggplant','pork']);
 // An unsent group removal must remain removed through subsequent offline
 // additions, even if a previous upload had already reached the server.
 const r4={foodIds:['pork','eggplant'],revision:8},removal=harness(['pork','eggplant'],r4,r4);
 removal.offline(true);await removal.api.setFoods(['eggplant']);await removal.api.setFoods(['eggplant','tomato']);
 removal.offline(false);await removal.api.sync();
 assert.deepEqual([...removal.state.foods].sort(),['eggplant','tomato']);
 console.log('PASS: one-time legacy migration, repeated offline additions, real cross-device removals and delayed bootstrap/edit ordering');
})().catch(error=>{console.error(error);process.exitCode=1;});
