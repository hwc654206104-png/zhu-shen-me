const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let app,listener,syncs=0,refreshes=0,favoriteRetries=0,page={route:'pages/home/index',data:{},onShow:()=>refreshes++};
const wx={getStorageSync:()=>undefined,onNetworkStatusChange:fn=>listener=fn,cloud:{init(){},callFunction:async({name})=>({result:name==='health'?{ok:true,envId:'cloud1-d0g0ntbbyaddfb364'}:{ok:true,recipeVersion:'test',fridge:{foodIds:[],revision:0}}})}};
vm.runInNewContext(fs.readFileSync('miniprogram/app.js','utf8'),{App:x=>app=x,wx,getCurrentPages:()=>[page],console:{info(){},error(){}},require:p=>p.includes('favorites-sync')?{schedule(){},flush:async()=>{favoriteRetries++;}}:p.includes('fridge-sync')?{sync:async()=>{syncs++;}}:{load:()=>({})}});
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 app.onShow();assert.equal(syncs,0,'Do not call cloud before init');app.onLaunch();await app.globalData.cloudCheck;await app.globalData.bootstrapCheck;
 const before=syncs;app.onShow();await settle();assert.equal(syncs,before+1,'Pull remote changes even without local pending edits');
 const count=refreshes;page={route:'pages/fridge/index',data:{dirty:true},onShow:()=>refreshes++};app.onShow();await settle();assert.equal(refreshes,count,'Do not replace active draft');
 page.data.dirty=false;app.onShow();await settle();assert.equal(refreshes,count+1,'Refresh unedited fridge');
 const reconnect=syncs;listener({isConnected:false});await settle();assert.equal(syncs,reconnect);listener({isConnected:true});await settle();assert.equal(syncs,reconnect+1,'Retry on network recovery');
 assert(favoriteRetries>=4,'Retry pending favorites on foreground and network recovery');
 page={route:'recipe-book/pages/detail/index',data:{},onShow:()=>refreshes++};const detail=refreshes;app.onShow();await settle();assert.equal(refreshes,detail,'Do not reset cooking detail');
 console.log('PASS: foreground remote refresh, reconnect recovery, dirty-draft protection and cooking-page isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
