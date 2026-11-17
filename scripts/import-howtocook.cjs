// Reproducible, local-only import of a hash-verified upstream snapshot.
// Original amounts and instructions take precedence; never infer missing grams.
const fs=require('node:fs'), path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/miniapp/recipes');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const write=(n,v)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(v,null,2)+'\n');
// Keep each source's matching vocabulary isolated: historical descriptors must
// never become new HowToCook ingredient matches on subsequent imports.
const baseline=read('recipes-before-howtocook.json'),catalog=read('ingredient-import-vocabulary.json').filter(f=>!f.id.startsWith('sichuan-food-'));
const identity=read('howtocook-identity-baseline.json');
const tree=JSON.parse(fs.readFileSync(path.join(root,'build/recipe-research/howtocook-tree.json'),'utf8'));
const {composition}=require('../miniprogram/utils/recipe-composition');
const {parseOperation,isOptionalIngredient,optionalIngredientName}=require('./howtocook-steps.cjs');
const categories={aquatic:'水产',breakfast:'早餐',condiment:'调料',dessert:'甜品',drink:'饮品',meat_dish:'荤菜','semi-finished':'半成品',soup:'汤羹',staple:'主食',vegetable_dish:'素菜'};
const plain=s=>s.replace(/!\[[^\]]*\]\([^\n]*?\)/g,'').replace(/\[([^\]]+)\]\([^\n]*?\)/g,'$1').replace(/[`_]/g,'').replace(/\*\*/g,'').replace(/^\s*\*\s+/gm,'• ').trim();
const norm=s=>s.replace(/的做法$/,'').replace(/西红柿/g,'番茄').replace(/青菜/g,'菜心').replace(/豆角/g,'四季豆').replace(/枝竹/g,'腐竹').replace(/炒蛋/g,'炒鸡蛋').replace(/[\s·（）()、]/g,'');
const synonyms={'西红柿':'番茄','葱花':'小葱','小葱叶':'小葱','生姜':'姜','大蒜':'蒜','蒜瓣':'蒜','青葱':'小葱','黄豆芽':'豆芽','绿豆芽':'豆芽','干木耳':'木耳','黑木耳':'木耳','生菜叶':'生菜','荷兰豆':'荷兰豆','腊肠':'腊肠','花菜':'花菜','腐竹':'腐竹','芋头':'芋头','莴笋':'莴笋','菠萝':'菠萝','包菜':'包菜','四季豆':'四季豆','面条':'面条','红薯':'红薯','小麦面粉':'小麦面粉'};
const seasoning=/^(水|清水|饮用水|温水|开水|食用油|油$|盐|食盐|细盐|白糖|糖|冰糖|红糖|生抽|老抽|酱油|蚝油|料酒|黄酒|白酒|啤酒|白醋|陈醋|米醋|醋|香醋|香油|芝麻油|花生油|橄榄油|菜籽油|玉米油|猪油|牛油|黄油|酵母|泡打粉|小苏打|淀粉|玉米淀粉|生粉|番茄酱|沙拉酱|豆瓣酱|甜面酱|辣椒酱|咖喱粉|咖喱块|黑胡椒|白胡椒|胡椒|十三香|五香粉|孜然|味精|鸡精|鸡粉|八角|桂皮|香叶|花椒|干辣椒|辣椒粉|辣椒油|小米椒|辣椒面|豆豉|蜂蜜|味醂|蚝油|鱼露|南乳|腐乳|蚝油|柠檬汁|淡奶油|奶油|浓汤宝|高汤|鸡汤|牛肉汤|虾酱|甜辣酱|椒盐)/;
const tool=/锅|碗|盘|刀|砧板|铲|勺|筷|杯|盆|筛|擀面杖|烤箱|微波炉|空气炸锅|电饭煲|电磁炉|保鲜膜|保鲜袋|手套|厨房纸|锡纸|硅油纸|烘焙纸|电子秤|温度计|料理机|搅拌机|打蛋器|面包机|压面机|咖啡机|滤纸|滤网|漏斗|容器|竹签|炭|火枪|模具|研磨|密封罐|饮料瓶|保温|计时器|食品级|蒸笼|漏勺|牙签|纱布|剪刀|烧烤架|烤架|漏网|去皮器|捣蒜器/;
const foodByName=new Map(catalog.map(f=>[f.name,f]));let next=200;
const additionalFoods=new Set('青蟹 椰浆 小龙虾 香菜 柠檬 鳝丝 黑鳕鱼 巴沙鱼 草鱼 千张 白芝麻 生蚝 芝麻 鲤鱼 五花肉 年糕 红椒 罗氏虾 桂鱼 海参 蛏子 螃蟹 鳊鱼 面粉 火腿 芝士 糯米 红枣 桂圆 燕麦 牛奶 培根 茴香 草莓 低筋面粉 高筋面粉 糯米粉 巧克力 紫薯粉 酸奶 核桃 腰果 杏仁 葡萄干 奇异果 苹果 百香果 橙子 牛油果 蒜苗 鸡肉 虫草花 兔肉 牛腱子 鸡爪 血肠 酸菜 羊腩 梅菜 猪皮 牛蛙 牛排 猪蹄 茭白 猪肝 藕带 蒜苔 蒜薹 乳鸽 小麦面粉 荷兰豆 腊肠 花菜 腐竹 芋头 莴笋 菠萝 包菜 四季豆 面条 红薯 鸭血 鲮鱼 白鱔 干香菇 咸鸭蛋 面筋 苦瓜 小米 银耳 莲子 绿豆 黄豆 板栗 枸杞 黑米 红腰豆 绿豆芽 鹰嘴豆 火腿肠 咸肉 冬笋 意大利面 午餐肉 馒头 粉条 凉粉 萝卜干 红芸豆 米粉 蕨根粉 汤圆 醪糟 皮冻 空心菜 蟹味菇 白玉菇 毛豆 莴笋叶 话梅 黄花菜 海苔 螺蛳 油麦菜 榨菜 紫薯 蚕豆 松子 红茶 绿茶 咖啡 薄荷 金酒 伏特加 威士忌 白朗姆酒 豆干 牛百叶 猪肚 肥牛 香肠 黄瓜'.split(' '));
Object.assign(synonyms,{'香菇':'鲜香菇','西蓝花':'西兰花','花椰菜':'花菜','枝竹':'腐竹','豇豆':'四季豆','豆角':'四季豆','凤梨':'菠萝','新鲜鸡蛋':'鸡蛋','鸡蛋清':'鸡蛋','鸡蛋黄':'鸡蛋','蛋清':'鸡蛋','蛋黄':'鸡蛋','内酯豆腐':'豆腐','内脂豆腐':'豆腐','白豆腐':'豆腐','老豆腐':'豆腐','大白菜':'白菜','新鲜菜心':'菜心','熟花生':'花生','熟花生米':'花生','花生碎':'花生','玉米粒':'玉米','新鲜玉米':'玉米','青豆':'豌豆','红萝卜':'胡萝卜','胡箩卜':'胡萝卜','黄洋葱':'洋葱','白洋葱':'洋葱','葱':'小葱','香葱':'小葱','小香葱':'小葱','姜末':'姜','姜片':'姜','姜丝':'姜','蒜末':'蒜','蒜头':'蒜','蒜片':'蒜','蒜蓉':'蒜','蒜仔':'蒜','老姜':'姜','肉末':'猪肉','肉沫':'猪肉','猪肉末':'猪肉','猪肉馅':'猪肉','猪肉片':'猪肉','猪瘦肉':'猪肉','瘦肉':'猪肉','猪里脊肉':'猪里脊','牛里脊':'牛肉','肥牛片':'肥牛','肥牛卷':'肥牛','鲜虾':'虾仁','活虾':'虾仁','海虾':'虾仁','大虾':'虾仁','鸡腿':'鸡腿肉','大鸡腿':'鸡腿肉','手枪腿':'鸡腿肉','新鲜鸡翅':'鸡翅','鸡翅中':'鸡翅','鸡全翅':'鸡翅','新鲜鸡翅中':'鸡翅','鸭子':'鸭肉','鲜仔鸭肉':'鸭肉','荔浦芋头':'芋头','小南瓜':'南瓜','北方大米':'大米','米':'大米','干面条':'面条','鲜面条':'面条','挂面':'面条'});
Object.assign(synonyms,{'豆干':'香干','香芹':'芹菜','香芹/芹菜':'芹菜','生姜片':'姜','生姜末':'姜','葱末':'小葱','葱段':'小葱','葱结':'小葱','小葱花':'小葱','葱姜蒜':'小葱','新鲜薄荷叶':'薄荷','薄荷叶':'薄荷','菠菜叶':'菠菜','熟透的牛油果':'牛油果','冷牛奶':'牛奶','全脂牛奶':'牛奶','纯牛奶':'牛奶','泡发好的海参':'海参','活海参':'海参','鱼头一个':'鱼头','黑虎虾 or 明虾':'虾仁','虾':'虾仁','原味酸奶':'酸奶','新鲜吐司':'吐司','方形吐司片':'吐司','面包片':'吐司','吐司片':'吐司','新鲜欧芹':'欧芹','罐头菠萝片':'菠萝','带皮五花肉':'五花肉','带皮猪五花肉':'五花肉','猪五花肉':'五花肉','新鲜鸡翅中':'鸡翅','鸡翅中':'鸡翅','带皮羊排肉':'羊排','带皮羊排':'羊排','去皮猪肉':'猪肉','前腿肉':'猪肉','江南米或北方大米':'大米','蔬菜':'叶菜','叶菜类蔬菜':'叶菜','青菜':'叶菜','鱼':'鲜鱼','面':'面条','泡面':'方便面','未过期的一袋速冻水饺':'速冻水饺','未过期的一袋速冻馄饨':'速冻馄饨','速冻汤圆':'汤圆','未过期的一袋速冻汤圆':'汤圆','红薯粉丝':'粉丝','土豆干粉条':'粉条','泡好的粉丝':'粉丝','白蘑菇':'蘑菇','板豆腐':'豆腐','莴笋叶':'莴笋叶','红葱头':'红葱头'});
for(const n of '鱼头 叶菜 鲜鱼 吐司 面包 花卷 羊排 方便面 速冻水饺 速冻馄饨 欧芹 红葱头 果酱 芝士片 奶酪 蛋挞皮 手抓饼皮 凉皮 商芝 蒜苔 鱼肉馅 虾滑馅 咖啡豆'.split(' '))additionalFoods.add(n);
Object.assign(synonyms,{'阿根廷红虾':'虾仁','剑骨鱼或鲤鱼':'鲤鱼','翘嘴鱼':'鲜鱼','半只鸡':'鸡肉','鸡':'鸡肉','梅头猪肉':'猪梅肉','肋排':'排骨','手枪腿鸡腿':'鸡腿肉','牛柳或牛肩肉':'牛肉','生鸡肝':'鸡肝','五花肉/瘦肉':'五花肉','牛蛙肉':'牛蛙','爪猪前肘':'猪肘','鳜鱼':'桂鱼','猪五花肉或猪肉排骨':'五花肉','东北酸菜':'酸菜','纯瘦肉':'猪肉','猪通脊肉':'猪里脊','五花肉薄片':'五花肉','五花肉条':'五花肉','猪前肘':'猪肘','甘竹牌鲮鱼罐头':'鲮鱼','农村玉米鸡':'鸡肉','牛腱子肉':'牛腱子','黔式腊肠':'腊肠'});
Object.assign(synonyms,{'羊肉或羊杂':'羊肉'});for(const n of '鸡肝 猪肘 油麦菜 羊肉'.split(' '))additionalFoods.add(n);
// Append IDs above the existing range; never renumber a saved fridge ingredient.
next=Math.max(199,...catalog.map(x=>Number(x.id.replace('food-',''))||0))+1;
const extraAliases={'普通面粉':'面粉','中筋面粉':'面粉','小麦粉':'小麦面粉','香菜叶':'香菜','芹菜段':'芹菜','熟白芝麻':'白芝麻','芝麻粒':'芝麻','米饭':'米饭','冷饭':'米饭','冷冻花卷':'花卷','火腿片':'火腿','无菌鸡蛋':'鸡蛋','熟蛋黄':'鸡蛋','去壳核桃':'核桃','去心莲子':'莲子','栗子':'板栗','黄花':'黄花菜','里脊肉':'猪里脊','牛肉末':'牛肉','碎牛肉':'牛肉','肉馅':'猪肉','干豆腐':'千张','金菇':'金针菇','冬菇':'干香菇','粟米':'玉米','冷冻玉米粒':'玉米','冷冻青豆':'豌豆','西红柿一个':'番茄','香菜一颗':'香菜','日本豆腐':'日本豆腐','玉子豆腐':'日本豆腐','菜椒':'甜椒','灯笼椒':'甜椒','长条青椒':'青椒','青辣椒':'青椒','红辣椒':'红椒','线椒':'线椒','螺丝椒':'螺丝椒','美人椒':'美人椒','美人辣':'美人椒','青红椒':'青椒','青红辣椒':'青椒','尖椒':'尖椒','鲜虾':'虾','活虾':'虾','海虾':'虾','大虾':'虾','阿根廷红虾':'虾','黑虎虾 or 明虾':'虾','冷冻去皮基围虾':'虾仁','豇豆':'豇豆','豆角':'豇豆','肉蟹':'螃蟹','梭子蟹':'梭子蟹','大闸蟹':'大闸蟹','大田螺':'田螺','萝卜':'白萝卜','青茄子':'茄子','闽星茶树菇':'茶树菇','熟松子仁':'松子','小汤圆':'汤圆','东北米':'大米'};
Object.assign(synonyms,extraAliases);
synonyms['笋']='竹笋';
synonyms['虾']='虾';
synonyms['大肉']='五花肉';
// Source wording for ordinary cooked staples; use existing food identities.
Object.assign(synonyms,{
 '挂面或者鲜面条也行':'面条','热干面特有的碱水面':'面条',
 '风干快熟面/任何牌子的快熟面':'面条','肉丁/肉末':'猪肉',
 '午餐肉罐头':'午餐肉'
});
const seasoningAliases={'食用盐':'盐','精盐':'盐','白砂糖':'白糖','绵白糖':'白糖','植物油':'食用油','耗油':'蚝油','郫县豆瓣酱':'豆瓣酱','郫县豆瓣':'豆瓣酱','红油豆瓣酱':'豆瓣酱','蒸鱼豉油':'蒸鱼豉油','黄豆酱':'黄豆酱','芝麻酱':'芝麻酱','柱侯酱':'柱侯酱','柱候酱':'柱侯酱','泡椒':'泡椒','小米辣':'小米椒','青花椒':'青花椒','大料':'八角','麻油':'香油','味淋':'味醂','日式味淋':'味醂','花雕酒':'黄酒','米酒':'米酒','蛋黄酱':'蛋黄酱','蒜粉':'蒜粉','姜粉':'姜粉','姜黄粉':'姜黄粉','香菜粉':'香菜粉','红辣椒粉':'辣椒粉','韩式辣酱':'韩式辣酱'};
function seasoningName(line){let s=plain(line).replace(/^\s*[-+•]\s*/,'').replace(/^(?:\[可选\]|可选|必备|辅料|调味料)\s*[:：]?\s*/,'').replace(/^\d+(?:\.\d+)?\s*(?:ml|g|毫升|克)\s*/i,'');const alias=Object.keys(seasoningAliases).sort((a,b)=>b.length-a.length).find(n=>s.startsWith(n));if(alias)return seasoningAliases[alias];const match=s.match(seasoning);return match?match[0]:null;}
for(const n of '虾 豇豆 米饭 三文鱼 虾皮 酸笋 日本豆腐 茶树菇 田螺 紫苏叶 甜椒 尖椒 线椒 螺丝椒 美人椒 梭子蟹 大闸蟹 白萝卜 面包糠 马斯卡彭芝士 手指饼干 红柚果肉 奶粉 棉花糖 饼干 混合坚果 乌枣 乌梅 山楂片 山楂 柚子 马蹄 南瓜花 糍粑 通心粉 糯米粉 粘米粉 全麦面粉 鹰嘴豆粉 荞麦面 河粉 烧卖皮 酸豆角 橄榄菜 瓠瓜 西洋参 石斛 玉竹 麦冬 椰子水 椰汁 蛋挞液 半成品薯条 鱼丸 笋 黑芝麻'.split(' '))additionalFoods.add(n);
function food(name){if(!foodByName.has(name)){const f={id:'food-'+next++,name,aliases:[]};catalog.push(f);foodByName.set(name,f);}return name;}
function splitIngredients(line){let depth=0,out=[''];for(const ch of line){if('（('.includes(ch))depth++;if('）)'.includes(ch))depth=Math.max(0,depth-1);if(depth===0&&'、，,'.includes(ch))out.push('');else out[out.length-1]+=ch;}return out;}
function ingredientName(line){
 if(/^[\s*+•-]*肉（最好为五花肉）/.test(line))return '五花肉';
 let s=plain(line).replace(/^\s*(?:[-+•]|\d+[.)、])\s*/,'').replace(/^[（(]?可选[）):：]?\s*/, '').trim();
 if(!s||s.startsWith('!')||s.startsWith('#')||/^[|>]/.test(s))return null;
 s=s.replace(/^(主料|辅料|原料|配料|必备|可选)\s*[:：]\s*/,'').replace(/^\d+(?:\.\d+)?\s*(?:g|kg|ml|克|毫升|个|片|袋)\s*/i,'');
 s=s.split(/\s*[=＝:：]|[（(]|\s+[-–—]\s+|\s*[0-9０-９]/)[0].trim().replace(/[，,。；;].*$/,'');
 if(!s||s.length>16||tool.test(s)||seasoning.test(s))return null;
 if(synonyms[s])return synonyms[s];
 if(foodByName.has(s))return s;
 if(/^(适量|少许|若干|一|二|三|四|五|六|七|八|九|十|半|每|总|根据|准备|建议|需要|可|用|将|把|选|约|推荐|备注|注意|其余|以上|以下)/.test(s))return null;
 if(/[或/]|以及|和|种|等|套|包材|工具/.test(s))return null;
 return additionalFoods.has(s)?s:null;
}
const entries=[],excluded=[],replacements=[],aliases=[];
for(const e of tree.tree.filter(e=>e.type==='blob'&&e.path.startsWith('dishes/')&&e.path.endsWith('.md'))){
 const b=fs.readFileSync(path.join(dir,'references/howtocook-full',e.path));
 assert.equal(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),e.sha,e.path);
 if(e.path.split('/')[1]==='template'){excluded.push({path:e.path,reason:'示例模板，不是菜谱'});continue;}
 const text=b.toString('utf8'),name=plain(text.match(/^#\s+(.+)$/m)?.[1]||path.basename(e.path,'.md')).replace(/的做法$/,'');
 const section=heading=>text.split('## '+heading)[1]?.split(/^## /m)[0]?.trim()||'';
 const rawIngredients=plain(section('必备原料和工具')),calculation=plain(section('计算'));
 const operation=section('操作'),extra=plain(section('附加内容')).replace(/如果您遵循本指南[\s\S]*$/,'').trim();
 const lines=section('必备原料和工具').split('\n').filter(s=>/^\s*[-*+]\s+/.test(s));
 const candidates=lines.flatMap(splitIngredients);
 const optionalCandidates=[...candidates,...section('计算').split('\n').filter(s=>/^\s*[-*+]\s+/.test(s))].filter(isOptionalIngredient);
 const sourceOptionalIngredients=[...new Map(optionalCandidates.map(s=>{const name=optionalIngredientName(s,plain);return [name,{name,matched_name:ingredientName(s)}];}).filter(([name])=>name&&name.length<=16&&!tool.test(name)&&!/秤|秒表|捣药|锡箔|雪克|搅拌|冰块|发光|^冰$|^(?:根据|如果|其他|配菜|香料)/.test(name))).values()];
 const optionalNames=new Set(sourceOptionalIngredients.map(i=>i.name)),optionalFoods=new Set(sourceOptionalIngredients.map(i=>i.matched_name).filter(Boolean));
 const optionalSeasonings=new Set(optionalCandidates.map(seasoningName).filter(Boolean));
 const requiredCandidates=candidates.filter(s=>!isOptionalIngredient(s));
 const requiredFoods=new Set(requiredCandidates.map(ingredientName).filter(Boolean));
 // Preserve all historically indexed food identities. Optionality affects
 // pantry requirements, never whether a saved ingredient ID still exists.
 const ingredients=[...new Set(candidates.flatMap(s=>/葱姜蒜/.test(s)?['小葱','姜','蒜']:/葱姜末/.test(s)?['小葱','姜']:/^[\s*+•-]*姜蒜/.test(s)?['姜','蒜']:/^[\s*+•-]*青红(?:辣)?椒/.test(s)?['青椒','红椒']:/^[\s*+•-]*无骨肉/.test(s)?['猪肉','鱼丸','火腿肠']:[ingredientName(s)]).filter(Boolean).map(food))];
 // Exact source blocks remain available even when a free-form ingredient cannot be indexed.
 const amounts=Object.fromEntries(ingredients.map(n=>[n,calculation.split('\n').filter(l=>l.includes(n)||Object.entries(synonyms).some(([a,b])=>b===n&&l.includes(a))).join('\n')||'按原谱配料说明']));
 const stepDetails=parseOperation(operation,plain),steps=stepDetails.map(step=>step.instruction);
 const category=categories[e.path.split('/')[1]];
 const r={recipe_id:'howtocook-'+crypto.createHash('sha256').update(e.path).digest('hex').slice(0,16),name,cuisine:'家常菜',servings:1,source_servings:null,prep_minutes:0,cook_minutes:0,time_known:false,
 ingredient_items:ingredients.map(n=>({name:n,quantity:null,unit:'',source_amount:amounts[n],...(optionalFoods.has(n)&&!requiredFoods.has(n)?{optional:true}:{})})),ingredients:ingredients.length?ingredients.map(n=>n+'：'+amounts[n]):[rawIngredients],
 seasonings:[...new Set(requiredCandidates.filter(s=>!optionalNames.has(optionalIngredientName(s,plain))&&!optionalSeasonings.has(seasoningName(s))).map(seasoningName).filter(Boolean))],steps,
 step_details:stepDetails,source_steps_structured:true,doneness_check:'按原谱操作与熟度说明',
 spicy_level:/辣椒|豆瓣酱|小米椒|剁椒|辣酱/.test(rawIngredients)?'微辣':'不辣',salt_level:'适中',taste_unverified:true,
 source_type:'howtocook_original',verification_status:'source_preserved',source_category:category,
 menu_eligible:['水产','荤菜','素菜','汤羹'].includes(category)&&ingredients.some(n=>!['小葱','大葱','姜','蒜','香菜','薄荷'].includes(n)),
 source_ingredients:rawIngredients,source_calculation:calculation,source_extra:extra,source_optional_ingredients:sourceOptionalIngredients,
 source_references:[{title:name,url:'https://github.com/Anduin2017/HowToCook/blob/'+tree.sha+'/'+e.path,blob_sha:e.sha,license:'Unlicense'}],
 source_path:e.path,notes:'HowToCook 原谱；未试做。原谱用量、份数和步骤原样呈现，不自动换算未确认的份量。'};
 if(!r.seasonings.length)r.seasonings=['按原谱配料说明'];
 assert(r.steps.length>0,name);entries.push(r);
}
// Only fix verified omissions after the complete source-reading phase, so the
// historical food registration order and all saved food IDs remain unchanged.
require('./reviewed-meal-ingredients.cjs').correctSourceIngredients(entries);
// Preserve IDs of ALL old dishes, including conservative same-core/method aliases.
const byName=new Map();for(const r of entries){const k=norm(r.name);if(!byName.has(k))byName.set(k,[]);byName.get(k).push(r);}
const byCore=new Map();for(const r of entries){const c=composition(r);if(c.core.length>=2){if(!byCore.has(c.combinationKey))byCore.set(c.combinationKey,[]);byCore.get(c.combinationKey).push(r);}}
const canonicalId=new Map(),output=baseline.map(old=>{
 const exact=byName.get(norm(old.name));const c=composition(old);const similar=byCore.get(c.combinationKey);
 const fixed=identity.recipes.find(r=>r.id===old.recipe_id);
 const candidates=fixed?.path?entries.filter(r=>r.source_path===fixed.path):fixed?null:exact?.length===1?exact:similar?.length===1?similar:null;
 if(!candidates)return old;
 const source=candidates[0];if(!canonicalId.has(source.recipe_id))canonicalId.set(source.recipe_id,old.recipe_id);
 replacements.push({id:old.recipe_id,oldName:old.name,sourceName:source.name,sourcePath:source.source_path,reason:exact?.length===1?'菜名归一化一致':'主料集合与烹调方法一致'});
 return {...source,recipe_id:old.recipe_id,name:old.name,cuisine:old.cuisine,source_title:source.name,canonical_source_id:source.recipe_id};
});
for(const source of entries){if(canonicalId.has(source.recipe_id)){aliases.push({sourceId:source.recipe_id,recipeId:canonicalId.get(source.recipe_id),path:source.source_path});continue;}let name=source.name;if(output.some(r=>r.name===name))name+='（HowToCook）';output.push({...source,name});canonicalId.set(source.recipe_id,source.recipe_id);}
// Do not expose a second equivalent recommendation; old saved IDs remain readable.
const recommended=new Set();for(const r of output){if(r.canonical_source_id){r.menu_eligible=r.menu_eligible&&canonicalId.get(r.canonical_source_id)===r.recipe_id;}if(r.source_type==='howtocook_original'&&r.menu_eligible)recommended.add(r.recipe_id);}
const mainstream=require('./mainstream-recipes.cjs');
const editorialAdditions=mainstream.additions(output);
output.push(...editorialAdditions);
for(const recipe of output)recipe.familiar=mainstream.familiarNames.has(recipe.source_title||recipe.name)||mainstream.familiarNames.has(recipe.name);
// Retain historical IDs, but retire synthetic cuisine templates from new meals.
const retired=output.filter(r=>r.source_type==='original'&&!r.familiar&&(
 /调味方向编写的家常创作/.test(r.style_note||'')||
 /^(丝瓜|蘑菇)(炒|蒸|炖)(鸡胸肉|鸡腿肉)$|^蘑菇鸡腿肉汤$/.test(r.name)));
for(const r of retired){r.menu_eligible=false;r.retirement_reason='已下架：模板化组合或不常见搭配，保留历史菜单查看。';}
write('retired-recipes-audit.json',{total:retired.length,policy:'Excluded from generation and blind boxes; historical recipe IDs preserved',recipes:retired.map(r=>({id:r.recipe_id,name:r.name,reason:r.retirement_reason}))});
const beforeSichuan=output.length;
let foods=require('./import-sichuan.cjs').mergeSichuan(output,catalog);
require('./import-jcyicai.cjs').merge(output,foods);
require('./import-cooklikehoc.cjs').merge(output,foods);
require('./import-everyday-food.cjs').merge(output,foods);
require('./import-tidy-cookbook.cjs').merge(output,foods);
require('./import-cooklikehoc.cjs').merge(output,foods,{expand:true});
require('./import-chishenme.cjs').merge(output,foods);
require('./import-chishenme.cjs').merge(output,foods,{ref:'fridge-expiry'});
require('./import-chishenme.cjs').merge(output,foods,{ref:'chisha'});
require('./reviewed-meal-ingredients.cjs').correctSourceIngredients(output);
for(const recipe of output)require('./recipe-classification.cjs').classify(recipe);
require('./menu-eligibility.cjs').applyMealEligibility(output);
for(const f of foods){f.aliases=[...new Set([...f.aliases,...Object.entries(synonyms).filter(([a,b])=>b===f.name&&a!==b&&!/[或/]| or /.test(a)).map(([a])=>a)])].filter(a=>a!==f.name&&!foods.some(x=>x.name===a)).sort();}
for(const previous of identity.foods)assert(foods.some(f=>f.id===previous.id&&f.name===previous.name),'Preserve ingredient identity '+previous.name);
for(const previous of identity.recipes)assert(output.some(r=>r.recipe_id===previous.id),'Preserve recipe identity '+previous.id);
assert.equal(new Set(output.map(r=>r.recipe_id)).size,output.length);assert.equal(new Set(output.map(r=>r.name)).size,output.length);
assert(baseline.every(old=>output.some(r=>r.recipe_id===old.recipe_id)));
// Explicit deletions override historical-ID retention. Keep source archives for
// provenance, but never regenerate deleted records into any published catalog.
const deletedIds=new Set(read('deleted-recipes.json').recipes.map(r=>r.id));
for(let i=output.length-1;i>=0;i--)if(deletedIds.has(output[i].recipe_id))output.splice(i,1);
const usedFoods=new Set(output.flatMap(r=>r.ingredient_items.map(i=>i.name)));
foods=foods.filter(f=>usedFoods.has(f.name));
write('recipes-howtocook.json',entries);write('recipes.json',output);write('ingredient-catalog.json',foods);
write('catalog-policy.json',{total:output.length,cantonese:output.filter(r=>r.cuisine==='粤菜').length,minimumRecipesPerFood:1,deleted:deletedIds.size,policy:'Explicit cold-dish deletion list enforced; surviving IDs preserved. No invented cuisine quota.'});
write('howtocook-import-audit.json',{commit:tree.sha,sourceDocuments:373,imported:entries.length,excluded,added:output.filter(r=>!baseline.some(b=>b.recipe_id===r.recipe_id)).length,deleted:deletedIds.size,upstreamAdded:beforeSichuan-baseline.length-editorialAdditions.length,sichuanAdded:output.length-beforeSichuan,editorialAdded:editorialAdditions.length,replaced:replacements.length,replacements,aliases,total:output.length,foods:foods.length,sourceRecipes:entries.map(r=>({path:r.source_path,id:canonicalId.get(r.recipe_id),name:r.name,category:r.source_category,indexedIngredients:r.ingredient_items.map(i=>i.name)})),cloudStatus:'Importer is local-only; actual cloud state is recorded in ../howtocook-cloud-verification.json'});
console.log(JSON.stringify({imported:entries.length,added:output.length-baseline.length,replaced:replacements.length,total:output.length,foods:foods.length}));
