const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const S=require('../miniprogram/utils/store');const food=S.data.foods.find(f=>f.name==='青菜').id;const n=S.data.recipes.length;
try{
 for(const id of ['a','b','c','d'])S.data.recipes.push({recipe_id:'lock-'+id,name:id,cuisine:'__lock',ingredientIds:[food],meal_kind:'veg'});
 // Locking uses actual indexed recipes: substitute indexed recipes from the live catalogue.
 const real=S.data.recipes.filter(r=>r.menu_eligible!==false&&S.requiredFoods(r).every(id=>S.availableFoods([food]).has(id))).slice(0,4).map(r=>r.recipe_id);
 assert(real.length>=3);const first=real.slice(0,2),history=[first.slice().sort().join('|')];
 const next=S.select({strictPantry:true},2,[food],history,()=>0,first,[first[0]]);
 assert(next.includes(first[0]));assert(!history.includes(next.slice().sort().join('|')));assert.equal(next.length,2);
 const lockedReal=next.find(id=>id!==first[0]);const again=S.select({strictPantry:true},2,[food],[...history,next.slice().sort().join('|')],()=>0,next,[first[0]]);
 if(again.length){assert(again.includes(first[0]));assert.notEqual(again.find(id=>id!==first[0]),lockedReal);}
 assert.deepEqual(S.select({strictPantry:true},2,[food],history,()=>0,first,first),[]);
}finally{S.data.recipes.splice(n);}
let page,chosen,redirect,toast=0;const meal={ids:['a','b'],done:[],people:2,preferences:{strictPantry:true},id:'m'};
const stub={meal:()=>meal,load:()=>({foods:[]}),data:{recipes:[]},select:(...args)=>{assert.deepEqual(Array.from(args[6]),['b']);return ['b','c'];},create:(ids,p,preferences)=>{chosen={ids,preferences};return{id:'next'}}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{Page:v=>page=v,require:()=>stub,wx:{redirectTo:r=>redirect=r.url,showToast:()=>toast++}});
page.id='m';page.setData=v=>Object.assign(page.data,v);page.data.lockedIds=['b'];page.refresh();assert.deepEqual(Array.from(chosen.ids),['c','b']);assert.deepEqual(Array.from(chosen.preferences.__lockedIds),['b']);assert(redirect.includes('next'));
page.data.lockedIds=['a','b'];chosen=undefined;page.refresh();assert.equal(chosen,undefined);assert.equal(toast,1);
console.log('PASS: lock retained across refresh, original slot, strict pantry, history and all-locked guard');
