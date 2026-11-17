const assert=require('node:assert/strict');
const store=require('../miniprogram/utils/store');
const id=name=>store.data.foods.find(food=>food.name===name).id;
let checkedMenus=0;
function verify(pantry,count,prefs={}){
  const available=store.foodGroups.expand([...pantry,...['小葱','大葱','姜','蒜'].map(id)]);
  let current=[],recent=[];
  for(let turn=0;turn<3;turn++){
    const menu=store.select(prefs,count,pantry,recent,()=>0.37,current);
    if(!menu.length)break;
    assert.equal(menu.length,count);
    for(const rid of menu){
      const recipe=store.byId.get(rid);
      assert(store.requiredFoods(recipe).every(food=>available.has(food)),recipe.name+' requires absent food');
      for(const [key,field] of [['cuisine','cuisine'],['spicy','spicy_level'],['salt','salt_level']])
        if(prefs[key])assert.equal(recipe[field],prefs[key]);
    }
    checkedMenus++;current=menu;recent=[menu.slice().sort().join('|'),...recent].slice(0,5);
  }
}
assert.deepEqual(store.select({},2,[],[],()=>0),[]);
for(const name of ['小葱','大葱','姜','蒜'])assert(store.availableFoods([]).has(id(name)));
for(const name of ['洋葱','豆豉','陈皮','小米椒','薄荷'])assert(!store.availableFoods([]).has(id(name)),name+' is not a default staple');
const lettuceOnly=store.select({},1,[id('生菜')],[],()=>0);
assert.equal(lettuceOnly.length,1,'Lettuce dishes may use default garlic');
verify([id('生菜')],1);
verify(['猪肉','茄子'].map(id),2);
verify(['番茄','牛肉','生菜','蒜'].map(id),2);
// Old fine-grained inventory still supplies the complete merged group.
verify(['五花肉','茄子','姜','小葱','蒜'].map(id),2,{spicy:'不辣'});
for(const food of store.foodGroups.catalog)verify([food.id],1);
// Start from real recipe inventories and remove an ingredient; no selected recipe
// may smuggle the removed group back through balance or refresh fallbacks.
const eligible=store.data.recipes.filter(recipe=>recipe.menu_eligible!==false);
for(let n=0;n<eligible.length;n+=17){
  const pantry=[...new Set(eligible[n].ingredientIds.map(store.foodGroups.canonical))];
  verify(pantry,1);
  verify(pantry.slice(1),2);
}
assert(checkedMenus>50);
console.log('PASS: '+checkedMenus+' actual initial/refreshed menus strictly use stocked groups; taste filters and legacy IDs retained');
