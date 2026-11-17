const assert=require('node:assert/strict');
const {classify}=require('../scripts/recipe-classification.cjs');
const make=(items,category='素菜')=>({name:'家常菜',ingredient_items:items.map(name=>({name})),source_category:category,seasonings:[],spicy_level:'不辣'});
assert.equal(classify(make(['菜花','五花肉'])).dish_category,'荤菜');
assert.equal(classify(make(['虾仁','黄瓜'])).dish_category,'水产');
assert.equal(classify(make(['猪肉','白菜'],'汤羹')).dish_category,'汤羹');
assert.equal(classify(make(['牛奶','南瓜'])).meal_kind,'veg');
for(const food of ['蟹味菇','鸡腿菇','羊肚菌','牛肝菌','鱼腥草','桂圆肉'])assert.equal(classify(make([food])).meal_kind,'veg',food+' is not meat');
for(const name of ['小米椒','干辣椒','辣椒'])assert.equal(classify(make([name,'豆腐'])).spicy_level,'微辣');
for(const name of ['彩椒','甜椒','小米','青椒'])assert.equal(classify(make([name,'豆腐'])).spicy_level,'不辣');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const rows=require('../docs/miniapp/recipes/references/chisha/dishes.json');
const {parseIngredients}=require('../scripts/recipe-ingredient-parser.cjs');
let amounts=0;
for(const r of recipes.filter(r=>r.source_type==='chisha_original')){
 const source=rows.find(s=>s.name===r.name);assert(source);
 for(const p of parseIngredients(source.ingredients).filter(p=>p.kind==='food'&&p.amount!=='原谱未列用量')){
  const item=r.ingredient_items.find(i=>i.source_name===p.original);
  assert(item,'Missing original ingredient '+r.name+': '+p.original);
  assert.equal(item.source_amount,p.amount,r.name+': original amount lost');amounts++;
 }
}
assert(amounts>20,'Amount retention test must cover real source data');
console.log('PASS: actual meat/vegetable categories, explicit chilli and sweet-pepper distinction; '+amounts+' original ingredient amounts retained');
