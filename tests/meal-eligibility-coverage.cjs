const assert=require('node:assert/strict');
const S=require('../miniprogram/utils/store');
const recipes=require('../docs/miniapp/recipes/recipes.json');
const {isReviewedMeal,isMealStaple,applyMealEligibility}=require('../scripts/menu-eligibility.cjs');
const find=name=>recipes.find(r=>(r.source_title||r.name)===name);
const food=name=>S.data.foods.find(f=>f.name===name).id;
const ready=(recipe,pantry)=>S.requiredFoods(recipe).every(id=>S.availableFoods(pantry).has(id));
const expected={
 '猪肉白菜饺子':['饺子皮','猪肉','白菜'],
 '韭菜猪肉水饺':['饺子皮','猪里脊','韭菜','鸡蛋'],
 '鲜肉馄饨':['馄饨皮','猪肉','紫菜','虾皮'],
 '特色鸡汤馄饨':['馄饨皮','猪肉','鸡肉'],
 '手工玉米猪肉蒸饺':['饺子皮','猪前腿肉','玉米','胡萝卜'],
 '鲜肉烧卖':['烧卖皮','猪肉'],
 '培根鸡蛋三明治':['面包','培根','鸡蛋','生菜','奶酪','番茄'],
 '鸡蛋三明治':['吐司','培根','鸡蛋'],
 '苏格兰蛋':['鸡蛋','手抓饼皮','芝士','培根'],
 '西葫芦鸡蛋饼':['全麦面粉','西葫芦','鸡蛋'],
 '茶叶蛋':['鸡蛋','茴香','红茶'],
 '手工水饺':['面粉','猪肉','鸡蛋','韭菜'],
 '煎饺':['速冻水饺'],
 '日式肥牛丼饭':['米饭','肥牛','洋葱'],
 '炒年糕':['年糕'],
 '萝卜糕':['白萝卜','粘米粉','腊肠','虾米'],
 '东北大拉皮':['拉皮','黄瓜','胡萝卜'],
 '鸡蛋饼':['面粉','鸡蛋','小葱'],
 '蒸蛋馒头':['鸡蛋','馒头'],
 '小米南瓜粥':['小米','南瓜']
};
for(const [name,names] of Object.entries(expected)){
 const source=find(name),indexed=S.byId.get(source.recipe_id);
 assert.equal(source.menu_eligible,true,name+' source allowed');
 assert.equal(indexed.menu_eligible,true,name+' index allowed');
 for(const required of names){
  assert(source.ingredient_items.some(i=>i.name===required&&!i.optional),name+' must index '+required);
  // A pantry with every OTHER ingredient cannot conceal a missing core food.
  const missing=S.foodGroups.canonical(food(required));
  if(S.availableFoods([]).has(food(required)))continue; // established default aromatics
  const rest=S.requiredFoods(indexed).filter(id=>S.foodGroups.canonical(id)!==missing);
  assert(!ready(indexed,rest),name+' cannot be ready without '+required);
 }
}
let reviewed=0;
for(const source of recipes){
 if(!isReviewedMeal(source))continue;
 reviewed++;
 const indexed=S.byId.get(source.recipe_id),pantry=S.requiredFoods(indexed).map(S.foodGroups.canonical);
 assert(ready(indexed,pantry),source.name+' complete pantry remains viable');
 assert.equal(indexed.menu_eligible,true,source.name);
 assert.deepEqual(indexed.ingredientIds,source.ingredient_items.map(i=>food(i.name)),source.name+' all food links');
 assert.deepEqual(indexed.optionalIngredientIds||[],source.ingredient_items.filter(i=>i.optional).map(i=>food(i.name)),source.name+' optional parity');
}
for(const name of ['鲜肉烧卖','炒年糕','温泉蛋','鸡蛋饼']){
 const source=find(name),indexed=S.byId.get(source.recipe_id);
 const expectedOptional={'鲜肉烧卖':['冬笋','皮冻','鲜香菇','虾仁'],'炒年糕':['叶菜'],'温泉蛋':['小葱'],'鸡蛋饼':['牛奶']}[name];
 for(const optional of expectedOptional)assert(!S.requiredFoods(indexed).includes(food(optional)),name+' does not force '+optional);
 const shown=require('../miniprogram/recipe-book/data/presentation').sourcePresentation(source);
 for(const optional of expectedOptional)assert(!shown.sourceFoods.includes(optional),name+' required display excludes '+optional);
}
for(const name of ['微波炉蛋糕','基础牛奶面包','披萨饼皮','日式咖喱饭','蛋包饭','炒河粉','汤面','金枪鱼酱三明治','意式香肠北非蛋','韩国麻药鸡蛋','燕麦香蕉蛋白煎饼','双皮奶','驴打滚','鲜花饼','奶黄鸡包','水晶饼','柿子饼']){
 const source=find(name);assert(source,name);assert.equal(source.menu_eligible,false,name+' unreviewed / incomplete / nonmeal stays excluded');
}
const fixture=find('猪肉白菜饺子');
for(const source_category of ['甜品','饮品','调料','半成品'])assert(!isReviewedMeal({...fixture,source_category}));
assert(!isReviewedMeal({...fixture,retirement_reason:'已下架'}));
assert(!isReviewedMeal({...fixture,steps:[]}));
assert(!isReviewedMeal({...fixture,ingredient_items:[{name:'饺子皮',optional:true}]}));
const alias=applyMealEligibility([{...fixture,canonical_source_id:'same'},{...fixture,canonical_source_id:'same'}]);
assert.equal(alias[0].menu_eligible,true);assert.equal(alias[1].menu_eligible,false);
assert(recipes.filter(isMealStaple).every(r=>r.menu_eligible===true),'Earlier staple repair remains enabled');
console.log('PASS: '+reviewed+' source-reviewed meals, 20 real core ingredient guards, strict-ready pantry, optional additions, nonmeal/OR exclusions and duplicate aliases');
