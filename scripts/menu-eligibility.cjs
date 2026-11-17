// Recommendation eligibility is distinct from the source's dish category.
// Restore real meals, not every document stored under a staple/breakfast folder.
const reviewedHowToCookStaples=new Set([
 '咸肉菜饭','微波炉腊肠煲仔饭','意式肉酱面','扬州炒饭','河南蒸面条',
 '火腿饭团','炒凉粉','炒意大利面','炒方便面','炒馍','炸酱面',
 '热干面','照烧鸡腿饭','煮泡面加蛋','猪油拌饭','煮锅蒸米饭','电饭煲蒸米饭',
 '老友猪肉粉','老干妈拌面','肉蛋盖饭','葱油拌面','蒸卤面','蛋炒饭',
 '西红柿鸡蛋挂面','豆角焖面','酱拌荞麦面','酸辣蕨根粉','陕西油泼面','麻油拌面'
]);
// These sources require alternatives not represented by the current AND-only
// ingredient index. Do not pretend either protein is the sole mandatory choice.
const sourceStapleExclusions={
 '炒河粉':'必需猪肉/牛肉二选一尚无替代索引，保留原谱查看',
 '蛋包饭':'必需火腿肠/鸡胸肉二选一尚无替代索引，保留原谱查看'
};
const stapleNames=new Set('大米 米饭 熟米饭 糯米 黑米 紫米 小米 燕麦 燕麦片 即食燕麦片 大碴子 面条 细面条 宽面条 手工挂面 生面 拉面 拉条子面 碱水面 福州线面 面片 烩面片 意大利面 通心粉 方便面 荞麦面 冷面 河粉 米粉 干米粉 常德米粉 兴化米粉 米线 湿米线 粉干 蕨根粉 凉粉 馒头'.split(' '));
// Source-reviewed meals previously lost to folder/category-wide exclusions.
// Keep this explicit: snack also contains desserts, drinks and incomplete recipes.
const reviewedMeals={
 howtocook_original:new Set('吐司果酱 太阳蛋 完美水煮蛋 微波炉荷包蛋 微波炉蒸蛋 手抓饼 桂圆红枣粥 水煮玉米 温泉蛋 溏心蛋 煎饺 燕麦鸡蛋饼 牛奶燕麦 空气炸锅面包片 苏格兰蛋 茶叶蛋 蒸水蛋 蒸花卷 鸡蛋三明治 中式馅饼 手工水饺 日式肥牛丼饭 炒年糕 烙饼 韭菜盒子 鲜肉烧卖'.split(' ')),
 cooklikehoc_original:new Set(['蛋饼','小米南瓜粥']),
 tidy_original:new Set(['手工玉米猪肉蒸饺']),
 chishenme_original:new Set(['蒸红薯']),
 fridge_expiry_original:new Set(['培根鸡蛋三明治']),
 chisha_original:new Set(['鸡蛋饼','馒头鸡蛋牛奶','蒸蛋馒头']),
 everyday_original:new Set('虾仁蔬菜魔芋面 番茄牛肉意面 西葫芦鸡蛋饼 金枪鱼意面 韭菜猪肉水饺 鸡胸肉饼 家常炒饼 黑椒牛肉意面 韭菜鸡蛋水饺 番茄鸡蛋烩饼 葱油饼 猪肉白菜饺子 素三鲜饺子 鲜肉馄饨 菜肉包 鸡蛋灌饼 酱香饼 发面饼 玉米饼 烧麦 生煎包 肉夹馍 烤冷面 酸辣粉 狼牙土豆 钵钵鸡 小笼包 油墩子 肠粉 虾饺 烧卖 萝卜糕 面窝 三鲜豆皮 蚵仔煎 玉米 春卷 鲜肉包 酥皮萝卜丝馅饼 香酥牛肉饼 荠菜鲜肉蒸饺 鸡汁汤包 特色鸡汤馄饨 心形鸡排 手枪大鸡腿 炸鸡排 炸鸡腿 生炸大鸡腿 香酥鸡米花 鸡肉洋葱圈 香脆薯饼 烤肠 蛋饺锅 三河米饺 蒿子粑粑 安庆锅贴 烧肉粽 肉燕 芋子包 酸菜猪肉饺子 东北大拉皮 烧饵块 biangbiang面 裤带面 西安灌汤包 酸汤水饺 子长煎饼 酱板鸭'.split(' '))
};
function isReviewedMeal(recipe){
 if(recipe.retirement_reason||['甜品','饮品','调料','半成品'].includes(recipe.source_category))return false;
 return !!reviewedMeals[recipe.source_type]?.has(recipe.source_title||recipe.name)&&
  recipe.ingredient_items.some(item=>item.optional!==true)&&
  recipe.steps?.some(step=>typeof step==='string'&&step.trim().length>3);
}
function isMealStaple(recipe){
 if(recipe.retirement_reason||recipe.source_category!=='主食')return false;
 const title=recipe.source_title||recipe.name;
 // Ambiguous or incomplete source lists stay viewable but are not promoted.
 if(recipe.source_type==='howtocook_original'&&sourceStapleExclusions[title])return false;
 if(recipe.source_type==='howtocook_original'&&!reviewedHowToCookStaples.has(title))return false;
 if(!/饭|粥|面$|面条|挂面|泡面|粉$|粉干|米线|牛河|炒馍/.test(title))return false;
 if(!recipe.steps?.some(step=>typeof step==='string'&&step.trim().length>3))return false;
 return recipe.ingredient_items.some(item=>item.optional!==true&&stapleNames.has(item.name));
}
function applyMealEligibility(recipes){
 for(const recipe of recipes)if(isMealStaple(recipe)||isReviewedMeal(recipe))recipe.menu_eligible=true;
 // Equivalent historical IDs must never become a second recommendation.
 const canonical=new Set();
 for(const recipe of recipes){
  if(!recipe.canonical_source_id)continue;
  if(canonical.has(recipe.canonical_source_id))recipe.menu_eligible=false;
  else canonical.add(recipe.canonical_source_id);
 }
 return recipes;
}
module.exports={isMealStaple,isReviewedMeal,applyMealEligibility,sourceStapleExclusions};
