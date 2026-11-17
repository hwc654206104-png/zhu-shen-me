const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function page(file,dependencies,wx={},extra={}){
 let p;vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:x=>p=x,require:dependencies,wx,...extra});
 p.setData=function(value){Object.assign(this.data,value);};return p;
}
const storage={pig_native_v2:{schema:2,foods:null,recent:13,profile:{name:null,avatar:42},meals:[null,{id:'legacy',ids:['old-id','old-id',9],done:['old-id','unknown'],people:20}]}};
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v};
const S=require('../miniprogram/utils/store');
const repaired=S.load();assert.deepEqual(repaired.foods,[]);assert.deepEqual(repaired.recent,[]);
assert.equal(typeof repaired.profile.name,'string');assert.equal(typeof repaired.profile.avatar,'string');
assert.deepEqual(repaired.meals[0].ids,['old-id']);assert.deepEqual(repaired.meals[0].done,['old-id']);assert.equal(repaired.meals[0].people,2);
assert.equal(storage.pig_native_v2.meals[1].people,20,'Read repair must not overwrite stored history');

const F=require('../miniprogram/utils/recipe-favorites');let favoritesState={meals:[]};let timer,created=0;const meals=new Map();const recipe=S.data.recipes[0];
const fake={load:()=>favoritesState,change:fn=>fn(favoritesState),data:{recipes:[recipe]},meal:id=>meals.get(id),create:()=>{const m={id:'m'+(++created),favorite:false};meals.set(m.id,m);return m;},update:(id,fn)=>fn(meals.get(id))};
const blind=page('miniprogram/pages/blind/index.js',n=>n.includes('recipe-favorites')?F:fake,{showToast(){},navigateTo(){}},{setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>timer=null});
blind.open();assert.equal(created,0);blind.draw();assert(blind.data.opening);blind.onHide();assert.equal(timer,null);assert.equal(blind.data.opening,false);
blind.draw();timer();blind.open();blind.open();assert.equal(created,1,'Opening the same blind result must reuse its menu');
blind.favorite();assert.equal(created,1);assert(F.has(favoritesState,recipe.recipe_id));F.set(favoritesState,recipe.recipe_id,false);blind.onShow();assert.equal(blind.data.favorited,false);
fake.data.recipes=[];blind.draw();assert.equal(blind.data.opening,false,'An empty pool must not start a stuck animation');

let stored={ids:[recipe.recipe_id],done:[],people:2},generated=0;
const result=page('miniprogram/pages/result/index.js',p=>p.includes('recipe-favorites')?F:p.includes('utils/store')?{...S,load:()=>({foods:[]}),meal:()=>stored,create:()=>generated++}:{},{navigateTo(){},showToast(){}});
result.id='m';result.onShow();assert.equal(result.data.error,'');
stored=undefined;result.start();result.refresh();assert(result.data.error);
stored={ids:[recipe.recipe_id],done:[],people:2,favorite:true};result.data.fromSaved=true;result.refresh();assert.equal(generated,0);result.data.fromSaved=false;
const unknown=S.data.recipes.find(r=>r.source_type==='tidy_original'&&r.prep_minutes+r.cook_minutes===0);assert(unknown);
stored={ids:[unknown.recipe_id],done:[],people:2};result.onShow();assert.equal(result.data.timeKnown,false,'Unknown duration must not show 0 minutes');

let updates=0;
const detail=page('miniprogram/recipe-book/pages/detail/index.js',p=>p.includes('data/presentation')?require('../miniprogram/recipe-book/data/presentation'):p.includes('data/tutorials')?require('../miniprogram/recipe-book/data/tutorials'):p.includes('utils/store')?{...S,meal:()=>undefined,update:()=>updates++}:{});
detail.onLoad({meal:'missing',recipe:'missing'});assert(detail.data.remoteError);assert.equal(updates,0);
detail.catalog=true;detail.finish();detail.data.readOnly=true;detail.cleanup();assert.equal(updates,0);

const library=page('miniprogram/recipe-book/pages/library/index.js',path=>path.includes('utils/store')?S:require('../miniprogram/recipe-book/data/tutorials'));
library.render();assert.equal(library.data.rows.length,S.data.recipes.length);assert(library.data.rows.some(x=>x.id===unknown.recipe_id));

(async()=>{
 const pending=[];
 const friend=page('miniprogram/pages/friend/index.js',()=>S,{cloud:{callFunction:()=>new Promise(resolve=>pending.push(resolve))}});
 friend.friend='test';const request=friend.refresh();friend.onHide();pending.shift()({result:{ok:true,profile:{name:'late'},menus:[],achievement:{}}});await request;
 assert.equal(friend.data.profile.name,undefined,'A hidden friend page must not restore a late response');
 const first=friend.openMenu({currentTarget:{dataset:{id:'first'}}});const second=friend.openMenu({currentTarget:{dataset:{id:'second'}}});
 pending[1]({result:{ok:true,menu:{id:'second',ids:[],createdAt:1}}});await second;
 pending[0]({result:{ok:true,menu:{id:'first',ids:[],createdAt:1}}});await first;assert.equal(friend.data.selected.id,'second');
 console.log('PASS: damaged cache, blind lifecycle/menu reuse, invalid links, unknown duration, saved-menu guards, full library and stale friend requests');
})().catch(e=>{console.error(e);process.exitCode=1;});
