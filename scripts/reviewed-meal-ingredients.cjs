// Minimal, source-specific index repairs for meals promoted for recommendation.
// Do not infer amounts, change the pinned original text or register new foods.
const fixes={
 '手工水饺':[
  ['猪肉','瘦肉末 250g'],['姜','姜 3g'],['小葱','葱 15g'],['鸡蛋','鸡蛋 1 个'],
  ['韭菜','原操作：韭菜洗净，切短至 3mm 以下长度；韭菜和肉沫混合。原谱未给用量']
 ],
 '煎饺':[['速冻水饺','饺子一包 （根据个人食量选择， 约 10 - 15 个）']],
 '日式肥牛丼饭':[['米饭','原计算以一杯米(160ml)为例；原操作：盛装肥牛丼至米饭上。原谱未给熟米饭用量']],
 '炒年糕':[['年糕','年糕 250 g * 份数']]
};
// These exact source lines/section headings declare optional additions; their
// parentheses are richer than the legacy generic optional-line recognizer.
const optionalFixes={
 '鲜肉烧卖':[['皮冻','皮冻（可选但推荐）'],['鲜香菇','香菇（或干香菇泡发，可选）']],
 '炒年糕':[['叶菜','（可选）：鸡蛋，青菜']],
 '温泉蛋':[['小葱','副食材：额外用作点缀的食材，可选；香葱']],
 '鸡蛋饼':[['牛奶','原操作末句：卷起来切段，配一杯牛奶；原配料清单无牛奶，属搭配饮品']]
};
function correctSourceIngredients(recipes){
 for(const recipe of recipes){
  if(recipe.source_type!=='howtocook_original'&&recipe.source_type!=='chisha_original')continue;
  const title=recipe.source_title||recipe.name,items=fixes[title]||[];
  for(const [name,source_amount] of items){
   if(recipe.ingredient_items.some(item=>item.name===name))continue;
   recipe.ingredient_items.push({name,quantity:null,unit:'',source_amount});
   recipe.ingredients.push(name+'：'+source_amount);
  }
  for(const [name,evidence] of optionalFixes[title]||[]){
   const item=recipe.ingredient_items.find(item=>item.name===name);if(!item)continue;
   item.optional=true;
   recipe.source_optional_ingredients=recipe.source_optional_ingredients||[];
   if(!recipe.source_optional_ingredients.some(optional=>optional.matched_name===name))
    recipe.source_optional_ingredients.push({name,matched_name:name,source_evidence:evidence});
   if(recipe.source_foods)recipe.source_foods=recipe.source_foods.filter(food=>food!==name);
  }
 }
 return recipes;
}
module.exports={correctSourceIngredients,fixes,optionalFixes};
