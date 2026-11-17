const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../miniprogram/utils/store');
const id=name=>S.data.foods.find(food=>food.name===name).id;
const clone=value=>value===undefined?value:JSON.parse(JSON.stringify(value));
const original=['排骨','生菜','番茄','牛肉','茄子'].map(id),added=id('土豆');
const cache={pig_native_v2:{schema:2,foods:original,meals:[],recent:[],profile:{}}};
let remote={foodIds:[original[0]],revision:4},stockWrites=0,navigation='';
const wx={getStorageSync:key=>clone(cache[key]),setStorageSync:(key,value)=>cache[key]=clone(value),
 removeStorageSync:key=>delete cache[key],navigateTo:({url})=>navigation=url,
 cloud:{callFunction:async({data})=>{
  if(data.action==='bootstrap')return {result:{ok:true,fridge:clone(remote)}};
  assert.equal(data.action,'fridge.set');stockWrites++;
  if(data.expectedRevision!==remote.revision)return {result:{ok:false,code:'CONFLICT',fridge:clone(remote)}};
  remote={foodIds:clone(data.foodIds),revision:remote.revision+1};return {result:{ok:true,fridge:clone(remote)}};
 }}};
global.wx=wx;
const context={module:{exports:{}},require:()=>S,wx,setTimeout:()=>0};
vm.runInNewContext(fs.readFileSync('miniprogram/utils/fridge-sync.js','utf8'),context);
const sync=context.module.exports;
function page(file){let out;vm.runInNewContext(fs.readFileSync(file,'utf8'),{
 wx,Page:value=>out=value,require:path=>path.includes('fridge-sync')?sync:path.includes('utils/store')?S:require('../'+file.slice(0,file.lastIndexOf('/')+1)+path)
 });out.setData=function(values){Object.assign(this.data,values);};return out;}
(async()=>{
 const fridge=page('miniprogram/pages/fridge/index.js');fridge.onLoad();fridge.onShow();
 fridge.toggle({currentTarget:{dataset:{id:added}}});fridge.onHide();
 await sync.sync();
 const expected=[...original,added].sort();
 assert.deepEqual(S.load().foods.slice().sort(),expected,'Committing before first confirmed baseline preserves all earlier local foods');
 assert.deepEqual(remote.foodIds.slice().sort(),expected);
 const committedWrites=stockWrites;
 for(let round=0;round<3;round++){
  const wizard=page('miniprogram/pages/wizard/index.js');wizard.onLoad();wizard.data.strictPantry=false;wizard.generate();
  assert(navigation.includes('/pages/result/index?id='));
  const result=page('miniprogram/pages/result/index.js');result.onLoad({id:S.load().meals[0].id});result.onShow();
  await sync.sync(); // App foreground/network recovery may pull during preview/return.
  fridge.onShow();fridge.onHide();
  assert.deepEqual(S.load().foods.slice().sort(),expected,'Generated menu and return must retain every food');
  assert.equal(fridge.data.owned.length,S.foodGroups.rows(expected).length);
  assert.equal(stockWrites,committedWrites,'Preview and unedited return must not submit inventory changes');
 }
 remote={foodIds:[added],revision:remote.revision+1};await sync.sync();fridge.onShow();
 assert.deepEqual(S.load().foods,[added],'A genuinely newer remote deletion still applies');
 delete global.wx;
 console.log('PASS: actual store/sync/fridge/wizard/result roundtrip retains all stock across old cloud baseline, three menu generations and foreground pulls; newer explicit deletion still applies');
})().catch(error=>{delete global.wx;console.error(error);process.exitCode=1;});
