const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../miniprogram/utils/store');
const deleted=require('../docs/miniapp/recipes/deleted-recipes.json').recipes;
const {tutorials}=require('../miniprogram/recipe-book/data/tutorials');
for(const r of deleted){assert(!S.byId.has(r.id),r.name);assert(!tutorials[r.id],r.name);}
const keep=S.data.recipes[0].recipe_id,removed=deleted[0].id;
const raw={schema:2,foods:[],meals:[{id:'old',ids:[removed,keep],done:[removed],people:2,viewId:removed}]};
global.wx={getStorageSync:()=>raw};
assert.deepEqual(S.meal('old').ids,[keep]);assert.deepEqual(S.meal('old').done,[]);
assert.equal(S.meal('old').viewId,keep);
assert.deepEqual(raw.meals[0].ids,[removed,keep],'Reading must not silently overwrite saved user records');
let home;vm.runInNewContext(fs.readFileSync('miniprogram/pages/home/index.js','utf8'),{Page:p=>home=p,require:()=>S});
home.setData=x=>Object.assign(home.data,x);home.onShow();assert(home.data.recent.includes('菜谱已下架'));
let detail;vm.runInNewContext(fs.readFileSync('miniprogram/recipe-book/pages/detail/index.js','utf8'),{Page:p=>detail=p,require:n=>n.includes('utils/store')?S:n.includes('data/tutorials')?{tutorials}:{}});
detail.setData=x=>Object.assign(detail.data,x);detail.catalog=true;detail.recipeId=removed;detail.render();assert.equal(detail.data.remoteError,'该菜谱已下架');
console.log('PASS: deleted recipes absent from indexes/tutorials, historical menus remain readable without rewriting user data');
