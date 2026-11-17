// Curated original-text records from a pinned repository declaring MIT.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../docs/miniapp/recipes');
const repository='Jiayu-zheng1/EveryDay_Food',commit='9ac80b0b716fd3aff073b044378c3f30c3b90dd0';
const ref=path.join(dir,'references/everyday-food');
const {parseIngredients}=require('./recipe-ingredient-parser.cjs');
let selected=['腐乳烧肉','干豆角烧肉','黄豆炖猪蹄','千张结烧肉','榨菜肉丝','双菇炒肉片','毛豆炒肉丁','肉末蒸豆腐','沙姜鸡','茶树菇炖鸭','笋干老鸭汤','板栗烧鸭','腐竹烧鸭','酱油鸡','香煎鲳鱼','蛤蜊冬瓜汤','冬瓜丸子汤','豆腐丸子汤','苦瓜排骨汤','莲藕花生汤','粉丝白菜汤','白萝卜羊肉汤','丝瓜蛋汤','蒜蓉茼蒿','清炒荷兰豆','蚝油杏鲍菇','凉拌腐竹','葱烧豆腐','香煎豆腐'];
selected.push('蒜香鸡翅','板栗烧鸡','炖土鸡','酸萝卜老鸭汤','土豆烧鸡','排骨炖豆角','山药炖鸡汤','黄豆猪蹄汤','玉米胡萝卜汤','清炖狮子头','红烧鲅鱼','滑蛋虾仁','西湖牛肉羹','腊肉炒蒜苔','苦瓜炒肉','香菇油菜','蒜泥蒸茄子','红烧豆腐','白灼秋葵','洋葱炒蛋','韭菜炒豆芽','素炒三丝','酸辣藕丁','清炒山药');
const canonical={猪肉末:'猪肉',三黄鸡:'鸡肉',老鸭:'鸭肉',干茶树菇:'茶树菇',干笋干:'笋干',板栗仁:'板栗',葱:'小葱',干腐竹:'腐竹',鸡蛋清:'鸡蛋',姜末:'姜',小青菜:'小白菜',红衣花生:'花生',红薯粉丝:'粉丝',蒜末:'蒜',蒜片:'蒜',泡发腐竹:'腐竹',泡发木耳:'木耳',嫩豆腐:'豆腐',北豆腐:'豆腐'};
const condiments=new Set(['红腐乳','腐乳汁','冰糖','生抽','料酒','八角','老抽','白糖','食用油','蚝油','盐','花生油','桂皮','干辣椒','淀粉','香油','白胡椒粉','水淀粉','香醋','辣椒油','蒸鱼豉油']);
const supplements={腐乳烧肉:['食用油'],干豆角烧肉:['食用油'],黄豆炖猪蹄:['食用油'],千张结烧肉:['食用油'],榨菜肉丝:['淀粉'],双菇炒肉片:['淀粉'],毛豆炒肉丁:['淀粉','盐'],肉末蒸豆腐:['蒸鱼豉油'],茶树菇炖鸭:['食用油'],板栗烧鸭:['食用油'],腐竹烧鸭:['食用油'],香煎鲳鱼:['淀粉']};
const cuisines={generic:'家常菜',yue:'粤菜',suzhe:'江浙菜',lu:'鲁菜'};
Object.assign(canonical,{大蒜:'蒜',土鸡:'鸡肉',铁棍山药:'山药',干黄豆:'黄豆',甜玉米:'玉米',蒜泥:'蒜',绿豆芽:'豆芽',小米椒:'小米椒'});
for(const name of ['蜂蜜','黑胡椒','白芝麻','花椒','白醋'])condiments.add(name);
Object.assign(supplements,{蒜香鸡翅:['食用油'],板栗烧鸡:['食用油'],土豆烧鸡:['食用油'],排骨炖豆角:['食用油'],红烧鲅鱼:['料酒','盐']});
// 羹中的料酒在原步骤中明确使用，原材料表未列出。
supplements.西湖牛肉羹=['料酒'];
Object.assign(cuisines,{chuan:'川菜',bei:'东北菜',xiang:'湘菜',e:'鄂菜',min:'闽菜'});
function digest(s){return crypto.createHash('sha256').update(s).digest('hex');}
function merge(output,foods){
 const raw=fs.readFileSync(path.join(ref,'meals.json'),'utf8'),source=JSON.parse(raw),license=fs.readFileSync(path.join(ref,'LICENSE'),'utf8'),snapshot=JSON.parse(fs.readFileSync(path.join(ref,'snapshot.json'),'utf8'));
 // The source contains several categories. Expand only complete home-cooking records;
 // drinks, bakery, nutrition/medical entries and records with placeholder ingredients stay out.
 selected=[...new Set(selected.concat(source.filter(s=>s.steps?.length>=3&&s.ingredients?.length>=2&&s.name).map(s=>s.name+'#'+s.id)))];
 assert(license.includes('MIT License')&&license.includes('Jiayu Zheng'));
 assert.equal(digest(raw),snapshot.sha256);assert.equal(snapshot.commit,commit);
 const deleted=require('../docs/miniapp/recipes/deleted-recipes.json').recipes,blocked=new Set(deleted.map(r=>r.id)),deletedNames=new Set(deleted.map(r=>r.name));
 const active=()=>output.filter(r=>!blocked.has(r.recipe_id));const audit=[],seen=new Set();
 const approved=new Set(require('../docs/miniapp/recipes/everyday-food-approved-baseline.json').recipes.map(r=>r.id));
 const composition=require('../miniprogram/utils/recipe-composition').composition;
 for(let name of selected){
  const sourceId=name.includes('#')?name.slice(name.indexOf('#')+1):null;
  const title=sourceId?name.slice(0,name.indexOf('#')):name;
  const candidates=source.filter(r=>sourceId?r.id===sourceId:r.name===title);assert.equal(candidates.length,1,name);const s=candidates[0];
  name=title;
  if(seen.has(s.id))continue;seen.add(s.id);
  assert(s.steps.length>=3&&s.ingredients.length>=2);
  if(deletedNames.has(name)){audit.push({name,sourceId:s.id,action:'excluded_deleted'});continue;}
  if(!approved.has('everyday-'+digest(s.id).slice(0,16))&&/黄芪|当归|川贝|沙参|玉竹|茯苓|阿胶|酸枣仁|决明子|三七|天麻|野生菌|牛肝菌|青头菌|沙虫|乌龟|活珠子|整羊|猪膘|酸肉/.test(s.ingredients.join('、'))){audit.push({name,sourceId:s.id,action:'excluded_specialty'});continue;}
  let parsed;try{parsed=parseIngredients(s.ingredients);}catch(e){audit.push({name,sourceId:s.id,action:'excluded_parse',reason:e.message});continue;}
  // Incomplete dependencies and highly specialized ingredients are not standalone household recipes.
  if(!approved.has('everyday-'+digest(s.id).slice(0,16))&&parsed.some(i=>i.kind==='food'&&/^(?:卤牛肉|卤蛋|熟牛肉|熟肥肠|卤肥肠|荠菜鲜肉馄饨|熟鸡丝|熟鸡块|炸鸡腿|番茄肉酱|鸡米花|鸡肉洋葱圈|熟牛杂|红烧牛肉片|卤鸡爪|卤鸡翅|咸鸡爪|风干牛肉|熟牛肉片|鸡汤鸡肉丝|臭鳜鱼|问政山笋|水发海参|花胶|肉燕|西施舌|石花草|石花膏|干巴菌|鲜鸡枞菌|诺邓火腿|乳扇|乳饼|熟猪皮|熟鸡皮|熏马肠|烤肉|糯米粽子|芷江鸭|晒兰肉|猪血丸子|火焙鱼|熟猪肚|熟牛肚|血粑|野生.*)$/.test(i.name))){audit.push({name,sourceId:s.id,action:'excluded_dependency'});continue;}
  if(!parsed.some(i=>i.kind==='food')){audit.push({name,sourceId:s.id,action:'excluded_empty'});continue;}
  const seasonings=[],items=[];
  for(const parsedItem of parsed){const {original,amount}=parsedItem;
   if(parsedItem.kind==='seasoning'){seasonings.push(parsedItem.name);continue;}
    for(const foodName of [canonical[parsedItem.name]||parsedItem.name]){
     let food=foods.find(f=>f.name===foodName)||foods.find(f=>(f.aliases||[]).includes(foodName));
     const normalized=food?.name||foodName;
     if(!items.some(i=>i.name===normalized))items.push({name:normalized,quantity:null,unit:'原谱',source_name:original,source_amount:amount});
   }
  }
  seasonings.push(...(supplements[name]||[]));
  const probe={name,ingredient_items:items};
  const duplicates=active().filter(r=>r.name===name||r.source_title===name||composition(r).combinationKey===composition(probe).combinationKey||
   (name==='土豆烧鸡'&&r.name==='土豆炖鸡腿肉'&&JSON.stringify(composition(r).core)===JSON.stringify(composition(probe).core)));
  if(duplicates.length){audit.push({name,sourceId:s.id,action:'duplicate',targets:duplicates.map(r=>({id:r.recipe_id,name:r.name}))});continue;}
  if(active().length>=2000){audit.push({name,sourceId:s.id,action:'excluded_limit'});continue;}
  for(const i of items)if(!foods.some(f=>f.name===i.name))foods.push({id:'everyday-food-'+digest(i.name).slice(0,12),name:i.name,aliases:[]});
  const spicy=/干辣椒|辣椒油|辣椒粉|辣酱|泡椒|豆瓣酱|剁椒/.test(seasonings.join('、'))||items.some(i=>/小米椒|泡椒|剁椒/.test(i.name))?'中辣':items.some(i=>/椒|酸萝卜/.test(i.name))?'微辣':'不辣';
  const category=s.category==='bakery'?'甜品':/粥|炒饭|焖饭|面$|面条|饼$|包$|饺|馄饨|粽|烧麦|饭团|米线|米粉$/.test(name)?'主食':/汤|羹/.test(name)?'汤羹':/糖水|奶茶|豆浆|茶$|饮$/.test(name)?'饮品':/鱼|虾|花蛤|蛏|蟹|贝|蚝|鱿/.test(items[0].name)?'水产':/猪|五花肉|鸡肉|鸡翅|鸡腿|鸭|排骨|羊排|腊肉|牛肉|牛里脊/.test(items.map(i=>i.name).join('、'))?'荤菜':'素菜';
  const safety='原谱时间仅供参考：肉、蛋、水产及豆类须充分熟透；不能只凭变色、浮起或开口判断熟度。';
  const notes=['保留原料原始用量，原谱未明确可缩放份数，不自动按人数换算。','本程序补充：'+safety];
  if(!seasonings.length)seasonings.push('无需额外调料');
  if(supplements[name])notes.push('食材清单补充原步骤已使用但原清单未列出的调料：'+supplements[name].join('、')+'；未补造用量。');
  if(name==='沙姜鸡')notes.push('冰镇须使用洁净容器和可直接饮用的水；先确认鸡肉充分熟透，再冷却切块。');
  if(name==='蛤蜊冬瓜汤')notes.push('花蛤须提前吐沙，弃去死亡、破损及煮后仍不开口的贝；开口后仍须充分加热。');
  if(name==='清炒荷兰豆')notes.push('荷兰豆须炒熟后食用；火力与厚度不同，应延长加热至熟透。');
  const r={recipe_id:'everyday-'+digest(s.id).slice(0,16),name,cuisine:cuisines[s.cuisine]||'家常菜',servings:1,prep_minutes:0,cook_minutes:0,original_amounts:true,ingredient_items:items,ingredients:items.map(i=>i.name),seasonings:[...new Set(seasonings)],steps:s.steps.slice(),step_details:s.steps.map(instruction=>({instruction,minutes:null,heat:'按原谱步骤调整',materials:items.map(i=>i.name)})),spicy_level:spicy,salt_level:'适中',source_category:category,source_cooking_method:s.methods.join('、'),menu_eligible:['水产','荤菜','素菜','汤羹'].includes(category)&&!['bakery','snack'].includes(s.category),familiar:approved.has('everyday-'+digest(s.id).slice(0,16))||require('./mainstream-recipes.cjs').familiarNames.has(name),source_type:'everyday_original',source_title:name,source_name:'每日食光',source_repository:'https://github.com/'+repository,source_path:'public/data/meals.json#'+s.id,source_url:'https://github.com/'+repository+'/blob/'+commit+'/public/data/meals.json',source_commit:commit,source_sha256:digest(JSON.stringify(s)),source_license:'MIT',source_license_notice:license,hide_source_credit:true,source_foods:items.map(i=>i.name),source_seasonings:[...new Set(seasonings)],source_ingredients:s.ingredients.join('\n'),source_calculation:s.ingredients.join('\n'),source_extra:notes.join('\n'),doneness_check:safety,verification_status:'source_transcribed_not_cook_tested',classification_basis:'按原谱原料和做法推断辣度及分类；青红椒品种不明保守归微辣，咸淡默认适中，非实测'};
  output.push(r);audit.push({name,sourceId:s.id,action:'added',id:r.recipe_id,sha256:r.source_sha256});
 }
 fs.writeFileSync(path.join(dir,'everyday-food-import-audit.json'),JSON.stringify({repository,commit,license:'MIT',selected:audit.length,sourceRecords:source.length,added:audit.filter(x=>x.action==='added').length,duplicates:audit.filter(x=>x.action==='duplicate').length,recipes:audit},null,2)+'\n');
}
module.exports={merge};
