const assert=require('node:assert/strict');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const store=require('../miniprogram/utils/store');
const id=name=>store.data.foods.find(f=>f.name===name).id;
for(const name of ['白切鸡','姜葱鸡','豉油鸡','香煎鸡胸肉','蒜香排骨','蒜泥白肉','萝卜炖牛腩','仔姜鸭','冬瓜老鸭汤','香煎带鱼','蒜蓉粉丝蒸虾','清炒西兰花','蚝油菜心']) {
  const r=recipes.find(r=>r.name===name);assert(r,name);assert(r.familiar,name);
}
for(const r of recipes.filter(r=>r.source_type==='editorial_home_recipe')) {
  assert.equal(r.verification_status,'editorial_not_cook_tested');
  assert(r.steps.length>=4 && r.ingredient_items.every(i=>i.quantity>0));
  assert(!r.source_path,'Editorial recipes cannot claim an upstream file');
}
const pork=recipes.find(r=>r.name==='简易红烧肉');assert(pork.ingredient_items.some(i=>i.name==='五花肉'));
const breast=id('鸡胸肉'), chicken=id('鸡肉');
for(const name of ['丝瓜炒鸡胸肉','蘑菇炒鸡胸肉','丝瓜炒鸡腿肉'])assert(!store.data.recipes.some(r=>r.name===name),name);
for(const r of recipes.filter(r=>/调味方向编写的家常创作/.test(r.style_note||'')&&!r.familiar))assert.equal(r.menu_eligible,false,r.name);
assert.notEqual(store.data.recipes.find(r=>r.name==='香菇滑鸡').menu_eligible,false);
for(const name of ['白切鸡','豉油鸡']) {
  const r=store.data.recipes.find(r=>r.name===name);
  assert(r.ingredientIds.includes(chicken)&&!r.ingredientIds.includes(breast));
}
const selected=store.select({},1,[breast],[],()=>0).map(x=>store.byId.get(x));
assert.equal(store.foodGroups.canonical(breast),store.foodGroups.canonical(chicken),
  'Legacy breast inventory must supply the unified chicken group');
assert.equal(selected.length,1);
assert.equal(selected[0].familiar,true,'Unified chicken inventory should favor familiar dishes');
assert(selected[0].ingredientIds.some(food=>store.foodGroups.canonical(food)===store.foodGroups.canonical(chicken)),
  'The selected dish must actually use the stocked chicken group');
assert(selected[0].ingredientIds.every(food=>store.availableFoods([breast]).has(food)),
  'Strict generation must not introduce absent ingredients after grouping');
const original=store.data.recipes.length;
try {
  const base={cuisine:'__familiar',ingredientIds:[breast]};
  store.data.recipes.push({...base,recipe_id:'unusual'}, {...base,recipe_id:'familiar',familiar:true});
  assert.deepEqual(store.select({cuisine:'__familiar'},1,[breast],[],()=>0),['familiar']);
  store.data.recipes.push({...base,recipe_id:'familiar-two',familiar:true});
  assert.deepEqual(store.select({cuisine:'__familiar'},1,[breast],['familiar'],()=>0),['familiar-two']);
} finally {store.data.recipes.length=original;}
console.log('PASS: familiar dishes across categories, actual meat cuts, pork indexing, editorial provenance and refresh');
