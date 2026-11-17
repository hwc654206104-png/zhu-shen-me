const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let page,uploads=0;const state={foods:['a','b']};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/fridge/index.js','utf8'),{
 Page:p=>page=p,require:p=>p.includes('fridge-sync')?{setFoods:async ids=>{uploads++;state.foods=Array.from(ids);}}:{foodIndex:require('../miniprogram/utils/food-recipe-index').create({foods:['a','b','c','remote'].map(id=>({id,name:id,aliases:[]})),recipes:[]},require('../miniprogram/utils/food-groups').create(['a','b','c','remote'].map(id=>({id,name:id,aliases:[]})))),foodGroups:require('../miniprogram/utils/food-groups').create(['a','b','c','remote'].map(id=>({id,name:id,aliases:[]}))),load:()=>state,data:{foods:['a','b','c','remote'].map(id=>({id,name:id,aliases:[]}))}},wx:{}
});
page.setData=function(v){Object.assign(this.data,v);};page.onLoad();page.onShow();
page.onHide();page.onUnload();assert.equal(uploads,0,'No edits means no upload');
page.toggle({currentTarget:{dataset:{id:'c'}}});page.toggle({currentTarget:{dataset:{id:'c'}}});page.onHide();assert.equal(uploads,0,'Reverted edits mean no upload');
page.toggle({currentTarget:{dataset:{id:'c'}}});page.remove({currentTarget:{dataset:{id:'a'}}});
state.foods.push('remote');page.onHide();assert.equal(uploads,1);assert.equal(state.foods.join(','),'b,remote,c','Preserve unrelated cloud additions');
page.onUnload();assert.equal(uploads,1,'Hide followed by unload must not duplicate upload');
state.foods=['remote'];page.onShow();assert.equal(page.draftFoods.join(','),'remote','Foreground must show current fridge');
page.toggle({currentTarget:{dataset:{id:'a'}}});page.onUnload();assert.equal(uploads,2);assert.equal(state.foods.join(','),'remote,a');
let detail;vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js','utf8'),{Page:p=>detail=p,require:()=>({}),wx:{}});detail.setData=function(v){Object.assign(this.data,v);};
detail.data.cleanupFoods=[{id:'a',owned:true},{id:'b',owned:false},{id:'c',owned:true}];detail.data.cleanupSelected=[];
detail.selectAllCleanup();assert.equal(detail.data.cleanupSelected.join(','),'a,c');detail.selectAllCleanup();assert.equal(detail.data.cleanupSelected.length,0);
console.log('PASS: no-change exit, reverted edits, background persistence, idempotent exit, concurrent fridge additions, foreground refresh and cleanup select-all toggle');
