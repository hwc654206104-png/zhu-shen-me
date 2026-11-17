const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
let page,created=0,redirected=0,toasts=0,next=['b','a'];
const meal={id:'current',ids:['a','b'],people:2,done:[],preferences:{strictPantry:false}};
const store={data:{recipes:[]},meal:()=>meal,load:()=>({foods:[],recent:[]}),select:()=>next,
  create:(ids,people,preferences)=>{created++;assert.equal(preferences.strictPantry,false);return {id:'next'};}};
vm.runInNewContext(fs.readFileSync('miniprogram/pages/result/index.js','utf8'),{
  Page:value=>page=value,require:()=>store,
  wx:{showToast:()=>toasts++,redirectTo:()=>redirected++}
});
page.id='current';
page.refresh();
assert.equal(created,0,'A+B -> B+A must not save another menu');
assert.equal(redirected,0);assert.equal(toasts,1);
next=['a','c'];page.refresh();
assert.equal(created,1,'Replacing an actual dish may create a new menu');
assert.equal(redirected,1);
next=[];page.refresh();assert.equal(created,1);assert.equal(toasts,2);
meal.preferences.__generationHistory=['a|b','a|c'];next=['c','a'];page.refresh();assert.equal(created,1,'Previously shown unordered menu is rejected');assert.equal(toasts,3);
delete meal.preferences.__generationHistory;
meal.favorite=true;next=['b','c'];page.refresh();
assert.equal(created,2,'Favoriting the generated menu must not prevent another refresh');
assert.equal(meal.favorite,true,'Refreshing must retain the original favorite');
assert.deepEqual(meal.ids,['a','b'],'Refreshing must not replace the saved original dishes');
page.data.fromSaved=true;page.refresh();assert.equal(created,2,'Entering from favorites remains browse-only');
page.data.fromSaved=false;meal.done=['a','b'];page.refresh();assert.equal(created,2,'Completed menus remain protected');
const template=fs.readFileSync('miniprogram/pages/result/index.wxml','utf8');
assert(template.includes('wx:if="{{!complete && !fromSaved}}"'),'Refresh visibility follows entry context, not favorite state');
console.log('PASS: refresh rejects order-only swaps without saving or navigating; actual replacements retain mode');
