// Preserve historical units and source files; never fabricate grams or step times.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../docs/miniapp/recipes');
const {classify}=require('./recipe-classification.cjs');
const simple=s=>s.normalize('NFKC').replace(/[\s·（）()]/g,'');
function plain(s){return s.replace(/\\footnotemark(?:\[[^\]]*\])?/g,'').replace(/\\hint\[([^\]]*)\]/g,'$1：').replace(/%[^\n]*/g,'').replace(/\\(?:footnote|textit|textbf|emph)\{([^{}]*)\}/g,'$1').replace(/\\[A-Za-z]+\*?(?:\[[^\]]*\])?\{([^{}]*)\}/g,'$1').replace(/\\(?:par|noindent|smallskip|medskip|bigskip)\b/g,'').replace(/[{}]/g,'').replace(/\n\s*\n/g,'\n\n').replace(/([^\n])\n([^\n])/g,'$1$2').trim();}
const replacements={'猪肥膘':'五花肉','肥膘肉':'五花肉','肥膘':'五花肉','肥肉':'五花肉','大肉':'五花肉','鸡脯肉':'鸡胸肉','鸡脯':'鸡胸肉','鸡脯皮':'鸡皮','鸡蛋清':'鸡蛋','鸡蛋白':'鸡蛋','蛋白':'鸡蛋','蛋黄':'鸡蛋','蛋清':'鸡蛋','母鸡':'鸡肉','公鸡':'鸡肉','仔鸡':'鸡肉','全鸡':'鸡肉','鸡子':'鸡肉','鸭子':'鸭肉','全鸭':'鸭肉','仔鸭':'鸭肉','活鸭':'鸭肉','肥鸭':'鸭肉','葱':'小葱','青葱':'小葱','黄葱':'小葱','葱花':'小葱','葱白':'小葱','生姜':'姜','老姜':'姜','姜片':'姜','姜米':'姜','姜丝':'姜','姜末':'姜','姜汁':'姜','蒜瓣':'蒜','大蒜':'蒜','蒜泥':'蒜','蒜米':'蒜','蒜末':'蒜','蒜片':'蒜','青笋':'莴笋','冬笋':'竹笋','玉兰片':'竹笋','冬菇':'鲜香菇','口蘑':'蘑菇','黄秧白':'白菜','黄秧白菜':'白菜','白菜心':'白菜','黄秧白心':'白菜','黄秧白心子':'白菜','小白菜':'白菜','瓢儿白':'白菜','洋芋':'土豆','红萝卜':'胡萝卜','珧柱':'干贝','鸡汤':'鸡汤','黄酒':'料酒','绍酒':'料酒','红酱油':'酱油','咸红酱油':'酱油','甜红酱油':'酱油','豆瓣':'豆瓣酱','豆瓣辣酱':'豆瓣酱','豆粉':'淀粉','干豆粉':'淀粉','水豆粉':'淀粉','化猪油':'猪油','化油':'猪油','熟猪油':'猪油','化鸡油':'鸡油','胡椒面':'胡椒粉','胡椒':'胡椒粉','红海椒':'干辣椒','红辣椒':'干辣椒','海椒':'干辣椒','辣椒面':'辣椒粉','椒面':'辣椒粉','麻油':'香油','甜酱':'甜面酱','酒米':'糯米','酒米粉':'糯米粉','阴米粉':'糯米粉','肥儿粉':'面粉','鲜藕':'莲藕','藕':'莲藕','新鲜胡豆':'蚕豆','新鲜蚕豆':'蚕豆','桃米':'核桃仁','核桃米':'核桃仁','湘莲':'莲子','陕西枣':'红枣','陕枣':'红枣','鱼肉':'鱼肉馅','鸡蒙':'鸡胸肉','鸡茸':'鸡胸肉','鲢鱼':'鲢鱼','胖头鱼':'鱼头','肥头鱼':'鱼头','豌豆尖':'豌豆苗','豆尖':'豌豆苗','椿芽尖':'香椿','椿芽':'香椿','田鸡':'牛蛙','田鸡腿':'牛蛙','大田鸡':'牛蛙','白木耳':'银耳','水牛脑顶肉':'牛肉','瘦牛肉':'牛肉','黄牛肉':'牛肉','嫩牛肉':'牛肉','猪腿肉':'猪肉','后腿肉':'猪肉','夹心肉':'猪肉','猪瘦肉':'猪肉','猪后腿瘦肉':'猪肉','肥瘦猪肉':'猪肉','肥瘦肉':'猪肉','猪肥瘦肉':'猪肉','熟瘦肉':'猪肉'};
Object.assign(replacements,{'猪肥膘':'猪肥膘','肥膘肉':'猪肥膘','肥膘':'猪肥膘','肥肉':'猪肥膘','二汤':'高汤','清水':'水','豆腐乳水':'腐乳汁','大料面':'五香粉','葱姜末':'姜','豌豆仁':'豌豆','豌豆米':'豌豆','金钩':'虾米','香菌':'鲜香菇','苡仁':'薏米','莲米':'莲子','大鲢鱼肉':'鲢鱼','大鲤鱼一尾':'鲤鱼','青嫩鲜蚕豆仁':'蚕豆','石膏豆腐':'豆腐','黄秧白菜心':'白菜','黄牛尾':'牛尾','笋':'竹笋'});
const seasoning=/盐|味精|酱|醋|糖|油|酒|胡椒|花椒|辣椒|海椒|豆粉|淀粉|面粉|苏打|白矾|草碱|香料|八角|桂皮|丁香|清汤|鸡汤|高汤|肉汤|姜汁|卤水|椒盐|芥末|红曲|胭脂|茶叶|香糟|醪糟|高汤|腐乳汁|五香粉|清水|二汤|\b水\b/;
const equipment=/^(柴|杠炭|木炭|细麻绳|麻绳|新纱布|纱布|土饼子|竹签|锯末|柏枝|香樟树叶)$/;
const historical=/硝|白矾|草碱|红色素|红食色|桃红食色|胭脂糖/;
Object.assign(replacements,{'细葱':'小葱','葱子':'小葱','葱节':'小葱','葱丝':'小葱','葱叶':'小葱','葱白丁':'小葱','葱白段':'小葱','葱白末':'小葱','白葱头':'小葱','老姜米':'姜','子姜':'姜','蒜丝':'蒜','独蒜':'蒜','大蒜片':'蒜','青笋片':'莴笋','莴笋头':'莴笋','莴笋尖':'莴笋','茗笋':'竹笋','笋子':'竹笋','兰片':'竹笋','兰片尖':'竹笋','冬笋剥皮去根':'竹笋','剥净鲜笋':'竹笋','白菌菰':'蘑菇','大金钩':'虾米','活虾':'虾','活鲫鱼':'鲫鱼','鲫鱼三尾':'鲫鱼','活鲤鱼':'鲤鱼','鲤鱼一尾':'鲤鱼','鲤鱼肉':'鲤鱼','岩鲤鱼':'岩鲤','鳝鱼':'鳝丝','青鳝':'鳝丝','鲢鱼头':'鱼头','鱼块':'鲜鱼','鱼一尾':'鲜鱼','大鱼':'鲜鱼','小白菜嫩心':'白菜','小白菜秧':'白菜','白菜秧心子':'白菜','青叶菜':'叶菜','青菜心':'叶菜','绿色小菜':'叶菜','绿色菜叶':'叶菜','小菜':'叶菜','菜':'叶菜','莲花白':'包菜','红苕':'红薯','莲米':'莲子','湘莲子':'莲子','新鲜白果':'银杏','白果':'银杏','金丝蜜枣':'蜜枣','腱子肉':'牛腱子','猪蹄膀':'猪肘','猪肘子':'猪肘','肘子':'猪肘','鸡足':'鸡爪','鸡丝':'鸡胸肉','膘肉':'猪肥膘','肉片':'猪肉','肉':'猪肉','猪心子':'猪心','腰花':'猪腰','肝片':'猪肝','大鸭腰':'鸭腰','猪肺一副':'猪肺','猪肥肠四段':'猪肥肠','猪肥肠头':'猪肥肠','洗沙':'豆沙','沙':'豆沙','特级奶汤':'高汤','奶汤':'高汤','虾汤':'高汤','开水':'水','南豆腐乳水':'腐乳汁','五香面':'五香粉','细豆瓣':'豆瓣酱','泡海椒':'泡椒','泡红海椒':'泡椒','泡红辣椒':'泡椒','青黄豆':'毛豆','青豆':'豌豆','大红番茄':'番茄','大丝瓜':'丝瓜','萝卜':'白萝卜','大茨菰':'茨菰','芹黄':'芹菜','土饼子':'土饼子'});
function canonical(raw,catalog){
 let n=raw.replace(/（[^）]*）|\([^)]*\)/g,'').replace(/\\[A-Za-z]+/g,'').trim();
 if(n==='干贝')return '干贝';
 if(replacements[n])return replacements[n];
 const exact=catalog.find(f=>!f.id.startsWith('sichuan-food-')&&(f.name===n||f.aliases.includes(n)));if(exact)return exact.name;
 n=n.replace(/^(罐头|水发|水浸|发好|发胀|去壳|去骨|去皮|剔刺|带皮|带壳|有壳|净|鲜|嫩|熟|生|干|瘦|肥|上庄)+/g,'').replace(/[一二三四五六七八九十两\d]+(?:只|个|枚|条)$/,'');
 if(replacements[n])return replacements[n];
 if(catalog.some(f=>f.name===n))return n;
 if(/鸡.*(?:脯|胸)/.test(n))return '鸡胸肉';
 if(/鸡.*腿/.test(n))return '鸡腿肉';
 if(/鸡.*翅/.test(n))return '鸡翅';
 if(/(?:公|母|仔|嫩|肥|全)?鸡(?:肉)?$/.test(n))return '鸡肉';
 if(/鸭(?:子|肉)?$/.test(n))return '鸭肉';
 if(/排骨/.test(n))return '排骨';
 if(/火腿/.test(n))return '火腿';
 if(/猪.*(?:肥膘|肥肉)|肥膘/.test(n))return '猪肥膘';
 if(/猪.*肉/.test(n))return '猪肉';
 if(/鸡蛋|蛋白|蛋黄|蛋清/.test(n))return '鸡蛋';
 return n||raw;
}
function mergeSichuan(recipes,catalog){
 const ref=path.join(dir,'references/sichuan-cookbook');
 const files=fs.readdirSync(path.join(ref,'latex')).filter(f=>/^recipe-\d+\.tex$/.test(f)).sort();assert.equal(files.length,312);
 const audit=[],newRecipes=[];const names=new Map();
 for(const r of recipes)for(const name of [r.name,r.source_title,...(r.source_aliases||[])].filter(Boolean))if(!names.has(simple(name)))names.set(simple(name),r);
 const aliasMap={'香酥鸭子':'香酥鸭','清汤白菜':'开水白菜','罐烧肉':'东坡肉','冷汁盐水鸭':'盐水鸭','番茄炒虾仁':'番茄炒虾仁','豆芽拌鸡丝':'凉拌鸡丝'};
 for(const file of files){
  const raw=fs.readFileSync(path.join(ref,'latex',file),'utf8');const text=raw.split('\n').filter(l=>!l.trim().startsWith('%')).join('\n');
  const m=text.match(/\\begin\{recipe\}(?:\[([^\]]+)\])?\{([^}]+)\}/);assert(m,file);const name=m[2],aliases=[m[1],aliasMap[name]].filter(Boolean);
  const pairs=[...text.matchAll(/\\ingredient\{([^}]+)\}(?:\[[^\]]*\])?\{([^}]+)\}/g)].map(m=>[plain(m[1]),plain(m[2])]);assert(pairs.length,file);assert.equal(pairs.length,(text.match(/\\ingredient\{/g)||[]).length,file+' must retain every ingredient row');
  const prep=text.split('\\preparation')[1]?.split(/\\(?:features|end\{recipe\})/)[0]?.replace(/\\begin\{(figure|wrapfigure)\}[\s\S]*?\\end\{\1\}/g,'').replace(/\\vbadness=\d+|\\hbadness=\d+/g,'').replace(/\\ref\{[^}]+\}/g,'原谱配图').replace(/\\,/g,'');assert(prep,file);
  const steps=prep.split(/\\step\s*/).map(plain).filter(Boolean);assert(steps.length,file);
  const ingredients=[],seasonings=[],tools=[],historicalMaterials=[];
  for(const [rawName,amount]of pairs)for(const part of rawName.replace(/（[^）]*）|\([^)]*\)/g,'').split('、')){
   const n=canonical(part,catalog);
   if(equipment.test(n)){tools.push({name:n,amount});continue;}
   if(historical.test(n)){historicalMaterials.push({name:n,amount});continue;}
   if((seasoning.test(n)&&!['油豆腐','豆油皮'].includes(n))||/^(?:汤|水|食盐|整香料|食醋|泡椒|干辣椒|五香粉|腐乳汁)$/.test(n)){seasonings.push(n);continue;}
   const old=ingredients.find(i=>i.name===n);if(old){old.source_amount+='；'+rawName+'：'+amount;continue;}
   ingredients.push({name:n,quantity:null,unit:'原谱',source_name:rawName,source_amount:amount});
   if(!catalog.some(f=>f.name===n))catalog.push({id:'sichuan-food-'+crypto.createHash('sha256').update(n).digest('hex').slice(0,12),name:n,aliases:[]});
  }
  // Source-only recipes must still have their real ingredients indexed.
  assert(ingredients.length,file+' lacks substantive foods');
  const spicy=/辣|海椒|豆瓣|泡椒|剁椒|红油|芥末/.test(pairs.map(p=>p[0]).join('、')+'、'+seasonings.join('、')+'、'+steps.join(''))?'中辣':'不辣';
  const features=plain(text.split('\\features')[1]?.split('\\end{recipe}')[0]||'');
  const sourcePath='latex/'+file;
  const source={source_equipment:tools,source_historical_materials:historicalMaterials,source_foods:ingredients.map(i=>i.name),source_seasonings:[...new Set(seasonings)],source_name:'四川菜谱（1972年版开源整理）',source_license:'BSD-3-Clause',source_repository:'https://github.com/neo954/sichuan-cookbook',source_path:sourcePath,source_url:'https://github.com/neo954/sichuan-cookbook/blob/master/'+sourcePath,source_sha256:crypto.createHash('sha256').update(raw).digest('hex'),source_title:name,source_aliases:aliases,source_ingredients:pairs.map(p=>p.join('：')).join('\n'),source_calculation:pairs.map(p=>p.join('：')).join('\n'),source_extra:features,steps,step_details:steps.map(instruction=>({instruction,minutes:null,heat:'以原谱步骤为准',materials:ingredients.map(i=>i.name)}))};
  const sourceClass=classify({name,source_title:name,ingredient_items:ingredients,seasonings,spicy_level:spicy});
  Object.assign(source,{spicy_level:spicy,salt_level:'适中',cuisine:'川菜',dish_category:sourceClass.dish_category,source_category:sourceClass.source_category,flavor_tags:sourceClass.flavor_tags,cooking_method:sourceClass.cooking_method,meal_kind:sourceClass.meal_kind});
  const existing=[name,...aliases].map(n=>names.get(simple(n))).find(Boolean);
  if(existing){existing.source_variants=existing.source_variants||[];existing.source_variants.push(source);audit.push({file,name,id:existing.recipe_id,action:'linked-existing'});continue;}
  const recommended=require('./research-household-names.cjs').has(name)&&historicalMaterials.length===0&&!ingredients.some(i=>i.name==='新鲜三菌');
  const r=classify({...source,recipe_id:'sichuan-1972-'+file.match(/\d+/)[0],name,cuisine:'川菜',servings:1,prep_minutes:0,cook_minutes:0,ingredient_items:ingredients,ingredients:ingredients.map(i=>i.source_name+'：'+i.source_amount),seasonings:[...new Set(seasonings.length?seasonings:['按原谱配料说明'])],spicy_level:spicy,salt_level:'适中',classification_basis:'按原谱配料和菜式推断；咸淡为默认分类，非测量值',source_type:'sichuan_original',original_amounts:true,verification_status:'source_transcribed_not_cook_tested',doneness_check:'原谱熟度说明见步骤，时间未提供时不虚构计时；肉类须确认中心充分熟透。',menu_eligible:recommended,familiar:recommended,notes:'保留传统原谱用量，不自动按人数换算。'});
  recipes.push(r);newRecipes.push(r);for(const n of [name,...aliases])names.set(simple(n),r);
  audit.push({file,name,id:r.recipe_id,action:'added'});
 }
 // Discard foods found solely in duplicate sources, which do not affect matching.
 const used=new Set(recipes.flatMap(r=>r.ingredient_items.map(i=>i.name)));
 const foods=catalog.filter(f=>used.has(f.name));
 fs.writeFileSync(path.join(dir,'sichuan-import-audit.json'),JSON.stringify({sourceDocuments:312,added:newRecipes.length,linkedExisting:audit.length-newRecipes.length,sourceRecipes:audit,license:'BSD-3-Clause',cloudStatus:'Local build only; not uploaded'},null,2)+'\n');
 return foods;
}
module.exports={mergeSichuan};
