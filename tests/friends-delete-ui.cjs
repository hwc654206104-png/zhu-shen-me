const assert=require('assert'),fs=require('fs'),vm=require('vm');
function fixture(){
 let page,modal;const requests=[],storage={pig_friend_consent:true,pig_friend_avatar:{fileID:'cached'}};
 vm.runInNewContext(fs.readFileSync('miniprogram/pages/friends/index.js','utf8'),{Page:p=>page=p,require:p=>p.includes('store')?{load:()=>({meals:[],profile:{}})}:{schedule:()=>{},stop:async()=>{}},wx:{getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],showModal:o=>modal=o,showToast:()=>{},cloud:{callFunction:o=>new Promise((resolve,reject)=>requests.push({data:o.data,resolve,reject}))}}});
 page.setData=function(d){Object.assign(this.data,d);};return {page,requests,storage,modal:()=>modal};
}
(async()=>{
 const f=fixture();f.page.setData({agreed:true,invite:'old',friends:[{id:'old'}]});
 const refreshing=f.page.refresh();assert.equal(f.requests[0].data.action,'list');
 f.page.deleteSharedData();const deleting=f.modal().success({confirm:true});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.page.data.invite,'');assert.equal(f.page.data.friends.length,0);assert.equal(f.storage.pig_friend_consent,false);
 f.requests[0].resolve({result:{ok:true,friends:[{id:'stale'}]}});await refreshing;assert.equal(f.page.data.friends.length,0);
 assert.equal(f.requests[1].data.action,'deleteSharedData');f.requests[1].reject(Error('offline'));await deleting;
 assert.equal(f.page.data.busy,false);assert.equal(f.page.data.agreed,false);assert(f.storage.pig_friend_avatar);assert(f.page.data.error);
 f.page.deleteSharedData();const retry=f.modal().success({confirm:true});await new Promise(resolve=>setImmediate(resolve));
 f.requests[2].resolve({result:{ok:true}});await retry;assert.equal(f.storage.pig_friend_avatar,undefined);assert.equal(f.page.data.error,'');
 console.log('PASS: stale refresh rejected, failed deletion hides sharing, avatar retained for retry, success clears cache');
})().catch(e=>{console.error(e);process.exitCode=1;});
