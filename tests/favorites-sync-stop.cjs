const assert=require('assert'),fs=require('fs'),vm=require('vm');
(async()=>{let consent=true,timer,release,calls=0;const storage={};const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('miniprogram/utils/favorites-sync.js','utf8'),{module,require:n=>require('../miniprogram/utils/recipe-favorites'),setTimeout:(fn,ms)=>ms===500?(timer=fn,1):setTimeout(fn,ms),clearTimeout:()=>{timer=null;},wx:{getStorageSync:()=>consent,removeStorageSync:k=>delete storage[k],setStorageSync:(k,v)=>storage[k]=v,cloud:{callFunction:()=>{calls++;return new Promise(r=>release=r);}}}});
 const sync=module.exports;sync.schedule({meals:[]});const flush=sync.flush();consent=false;const stopping=sync.stop();release({result:{ok:false}});await flush.catch(()=>{});await stopping;
 consent=true;await sync.flush();assert.equal(calls,1);assert.equal(timer,null);
 console.log('PASS: stopping failed in-flight sync clears retry payload and timer');
})().catch(e=>{console.error(e);process.exitCode=1;});
