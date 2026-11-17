const assert=require('assert'),fs=require('fs'),vm=require('vm');let page,chosen,toast=0;
const meal={id:'m',ids:['b'],done:[],people:2,preferences:{__blind:true,__generationHistory:['a','b']}};
const S={meal:()=>meal,load:()=>({foods:[]}),data:{recipes:['a','b','c'].map(recipe_id=>({recipe_id}))},create:(ids,people,prefs)=>{chosen={ids,prefs};return{id:'next'}}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{Page:p=>page=p,require:()=>S,wx:{redirectTo(){},showToast(){toast++}}});page.id='m';page.refresh();assert.equal(chosen.ids[0],'c');assert(chosen.prefs.__generationHistory.includes('c'));
meal.preferences.__generationHistory=['a','b','c'];chosen=undefined;page.refresh();assert.equal(chosen,undefined);assert.equal(toast,1);
console.log('PASS: blind refresh excludes all previously shown dishes and stops when exhausted');
