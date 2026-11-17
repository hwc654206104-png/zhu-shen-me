const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const F=require('../miniprogram/utils/recipe-favorites'),recipes=require('../miniprogram/data/recipe-index').recipes;
const {createService}=require('../cloudfunctions/pigFriends/service'),{db}=require('./helpers/friends-db.cjs').createDB();
const api=createService({db,identity:()=>({APPID:'wx0cb3da57b3344189',ENV:'cloud1-d0g0ntbbyaddfb364',OPENID:'test'})});
(async()=>{
 const state={meals:[{id:'meal_1_old',ids:recipes.slice(0,3).map(r=>r.recipe_id),favorite:true,people:2,createdAt:1,note:'private'}]};
 const projection=F.shared(state);assert.equal(projection.length,3);assert((await api({action:'menusSync',consent:true,menus:projection})).ok,'Actual unchanged backend accepts per-dish virtual IDs');
 let timer,calls=0,error=false;const module={exports:{}};
 vm.runInNewContext(fs.readFileSync('miniprogram/utils/favorites-sync.js','utf8'),{module,require:()=>F,setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>timer=null,wx:{getStorageSync:()=>true,setStorageSync:()=>error=true,removeStorageSync(){},cloud:{callFunction:async()=>{calls++;return {result:{ok:true}};}}}});
 const sync=module.exports;sync.schedule(state);await sync.flush();assert.equal(calls,1);
 const many={meals:[{...state.meals[0],ids:recipes.slice(0,1001).map(r=>r.recipe_id)}]};sync.schedule(many);await sync.flush();assert.equal(calls,1,'Do not send unsupported >1000 payload');assert(error);assert.equal(F.list(many).length,1001,'All local favorites retained beyond shared limit');
 console.log('PASS: unchanged backend accepts single-recipe sharing, no private notes, over-limit retains local favorites and avoids invalid cloud writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
