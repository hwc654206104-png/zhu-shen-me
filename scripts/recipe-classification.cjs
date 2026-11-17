const meat=/猪|牛(?!奶|油果)|羊(?!奶)|鸡肉|鸡胸|鸡腿|鸡翅|鸡皮|鸡爪|鸡肫|鸭|鹅|兔|鱼|虾|蟹|蛏|蚝|海参|火腿|红肠|香肠|培根|排骨|肘|肝|腰|肚|肥膘|乳鸽|鸽蛋|鳝|蛙|鱿|肉|骨|(?<!马)蹄|鱼翅|熊掌|鹿筋|螺蛳|田螺|花蛤|蛤蜊|扇贝/;
function classify(r){
 const ingredients=r.ingredient_items.filter(item=>item.optional!==true);
 const foods=ingredients.map(x=>x.name).join('、'), name=r.source_title||r.name;
 const hasMeat=ingredients.some(i=>!['蟹味菇','鸡腿菇','羊肚菌','牛肝菌','猪肚菇','鱼腥草','龙眼肉','桂圆肉','椰肉','果肉'].includes(i.name)&&meat.test(i.name));
 const aquatic=hasMeat&&/鱼|虾|蟹|蛏|蚝|海参|鳝|鱿|珧柱|螺蛳|田螺|花蛤|蛤蜊|扇贝/.test(ingredients[0]?.name||'');
 const category=/糖水|豆沙|银耳|甜烧白|枣糕|核桃泥|酿梨/.test(name)?'甜品':/汤|羹/.test(name)?'汤羹':/粥|面条|炒饭|糯米鸡|糯米全鸭/.test(name)?'主食':aquatic?'水产':hasMeat?'荤菜':'素菜';
 r.dish_category=r.source_category||category;
 // A source's vegetable section may include pork or seafood; actual ingredients
 // decide the meat/vegetable split, while soups, staples and desserts keep theirs.
 if(r.dish_category==='素菜'&&hasMeat)r.dish_category=aquatic?'水产':'荤菜';
 r.source_category=r.dish_category;
 r.meal_kind=['甜品','饮品','调料','半成品'].includes(r.dish_category)?'neutral':hasMeat?'meat':r.dish_category==='素菜'?'veg':'neutral';
 r.cooking_method=r.source_cooking_method||(/蒸/.test(name)?'蒸':/炖|煨/.test(name)?'炖':/汤|羹/.test(name)?'煮':/炸|酥/.test(name)?'炸':/煎|锅贴/.test(name)?'煎':/拌|冷汁/.test(name)?'拌':/烧|焖/.test(name)?'烧焖':/炒|煸/.test(name)?'炒':'综合');
 const seasonings=r.seasonings.join('、');const flavors=[];
 // Explicit hot peppers must not be advertised as non-spicy. Sweet/bell peppers
 // and black/white pepper alone do not imply a chilli heat level.
 if(r.spicy_level==='不辣'&&(ingredients.some(i=>i.name==='辣椒')||/小米椒|小米辣|干辣椒|朝天椒|线椒|杭椒|尖椒|辣椒粉|辣椒油|辣椒酱|辣酱|泡椒|剁椒|郫县豆瓣酱/.test(foods+'、'+seasonings)))r.spicy_level='微辣';
 if(r.spicy_level!=='不辣')flavors.push('香辣');
 if(/花椒|椒麻/.test(seasonings+name))flavors.push('麻香');
 if(/糖醋|松鼠|酸甜/.test(name))flavors.push('酸甜');
 else if(/醋|酸/.test(seasonings+name))flavors.push('酸香');
 if(r.dish_category==='甜品')flavors.push('香甜');
 if(/五香|卤|熏|酱/.test(name))flavors.push('酱香');
 if(!flavors.length)flavors.push(/清蒸|白灼|清炖|清汤/.test(name)?'清鲜':'咸鲜');
 r.flavor_tags=[...new Set(flavors)];
 return r;
}
module.exports={classify};
