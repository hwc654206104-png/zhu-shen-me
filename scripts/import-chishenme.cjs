// Complete original text only, from a pinned MIT source; never fill missing source steps.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const dir=path.resolve(__dirname,'../docs/miniapp/recipes');
function merge(output,foods,options={}){
 const ref=path.join(dir,'references',options.ref||'chishenme');
 const read=f=>fs.readFileSync(path.join(ref,f),'utf8'),snapshot=JSON.parse(read('snapshot.json'));
 for(const [file,sha]of Object.entries(snapshot.files))assert.equal(hash(read(file)),sha);
 const rows=JSON.parse(read('dishes.json')),howto=JSON.parse(read('howto.json')),license=read('LICENSE');assert(license.includes('MIT License'));
 const deleted=require('../docs/miniapp/recipes/deleted-recipes.json').recipes,blocked=new Set(deleted.map(x=>x.id));
 const active=()=>output.filter(r=>!blocked.has(r.recipe_id)),audit=[];
 const {parseIngredients,condimentNames,aliases}=require('./recipe-ingredient-parser.cjs'),{composition}=require('../miniprogram/utils/recipe-composition');
 const normalize=s=>s.replace(/西红柿/g,'番茄').replace(/青瓜/g,'黄瓜').replace(/炒蛋$/,'炒鸡蛋');
 for(const row of rows){
  const name=row.name,record={name};
  if(deleted.some(x=>x.name===name)){audit.push({...record,action:'excluded_deleted'});continue;}
  if(/时蔬|例汤|佛跳墙|臭鳜鱼|驴肉|汽锅|蒸槐花|沔阳三蒸|瓦罐汤|胶东大包子|烤鸭$|清炒芦蒿|九转大肠|把子肉|松鼠鳜鱼|鲤鱼焙面|酸汤鱼|刀削面|麻豆腐/.test(name)){audit.push({...record,action:'excluded_specialty_or_vague'});continue;}
  const sourceSteps=howto[name]?.steps,text=Array.isArray(sourceSteps)?sourceSteps.join('\n'):sourceSteps,steps=Array.isArray(sourceSteps)?sourceSteps.slice():text?.split(/[①②③④⑤⑥⑦⑧⑨⑩]/).map(x=>x.trim()).filter(Boolean);
  if(!steps||steps.length<3){audit.push({...record,action:'excluded_incomplete'});continue;}
  let parsed;try{parsed=parseIngredients(row.ingredients);}catch(e){audit.push({...record,action:'excluded_parse',reason:e.message});continue;}
  // Include actual foods explicitly present in steps but missing from the short source list.
  // Longest-first token matching prevents 牛肉末 from being mistaken for 猪肉末.
  const lexicon=new Map(foods.flatMap(f=>[[f.name,f.name],...f.aliases.map(a=>[a,f.name])]));
  for(const [a,n]of Object.entries(aliases))if(!condimentNames.has(n))lexicon.set(a,n);
  for(const a of ['蛋液','蛋花','蛋清'])lexicon.set(a,'鸡蛋');
  lexicon.set('葱姜','小葱');lexicon.set('紫苏','紫苏');
  const escaped=[...lexicon.keys()].filter(x=>x.length>=2&&/^[\p{Script=Han}a-zA-Z]+$/u.test(x)).sort((a,b)=>b.length-a.length);
  const sanitized=[...condimentNames].sort((a,b)=>b.length-a.length).reduce((s,n)=>s.split(n).join(' '),text);
  for(const match of sanitized.matchAll(new RegExp(escaped.join('|'),'g'))){const name=lexicon.get(match[0]);if(['肚子','不用调料'].includes(name))continue;if(name==='鸡肉'&&parsed.some(x=>/^鸡腿|^鸡胸|^鸡翅/.test(x.name)))continue;if(!parsed.some(x=>x.name===name||match[0].startsWith(x.name)))parsed.push({name,kind:'food',original:match[0],amount:'原谱步骤提及，未列用量'});}
  if(text.includes('葱姜')&&!parsed.some(x=>x.name==='姜'))parsed.push({name:'姜',kind:'food',original:'葱姜',amount:'原谱步骤提及，未列用量'});
  if(parsed.some(x=>x.name==='五花肉')){const i=parsed.findIndex(x=>x.name==='猪肉');if(i>=0)parsed.splice(i,1);}
  const items=[],seasonings=parsed.filter(x=>x.kind==='seasoning').map(x=>x.name);
  for(const i of parsed.filter(x=>x.kind==='food')){const food=foods.find(f=>f.name===i.name)||foods.find(f=>f.aliases.includes(i.name));const name=food?.name||i.name;if(!items.some(x=>x.name===name))items.push({name,quantity:null,unit:'原谱',source_name:i.original,source_amount:i.amount||'原谱未列用量'});}
  // Only supplement condiments explicitly named in the source steps. Amounts stay in the steps.
  for(const n of [...condimentNames].sort((a,b)=>b.length-a.length))if(text.includes(n))seasonings.push(n);
  for(const [a,n] of Object.entries(aliases))if(condimentNames.has(n)&&text.includes(a))seasonings.push(n);
  if(!items.length){audit.push({...record,action:'excluded_empty'});continue;}
  const probe={name,ingredient_items:items},key=composition(probe).combinationKey;
  const duplicates=active().filter(r=>normalize(r.name)===normalize(name)||normalize(r.source_title||'')===normalize(name)||composition(r).combinationKey===key);
  if(duplicates.length){audit.push({...record,action:'duplicate',targets:duplicates.map(x=>x.recipe_id)});continue;}
  if(active().length>=2000){audit.push({...record,action:'excluded_limit'});continue;}
  for(const item of items)if(!foods.some(f=>f.name===item.name))foods.push({id:(snapshot.namespace||'chishenme')+'-food-'+hash(item.name).slice(0,12),name:item.name,aliases:[]});
  const safety='肉、蛋、水产和豆类须充分熟透；原谱时间不能作为熟度保证。';
  const category=/汤|羹/.test(name)?'汤羹':['主食','饮品','甜品'].includes(row.category)?row.category:/鱼|虾|蟹|蚝|贝|蛤|蛏/.test(items[0].name)?'水产':row.category==='荤菜'?'荤菜':'素菜';
  const r={recipe_id:(snapshot.namespace||'chishenme')+'-'+hash(name).slice(0,16),name,cuisine:({'广东':'粤菜','山东':'鲁菜','四川':'川菜','湖南':'湘菜','浙江':'浙菜','江苏':'苏菜','福建':'闽菜','安徽':'徽菜','东北':'东北菜','云南':'滇菜','湖北':'鄂菜','贵州':'黔菜','河南':'豫菜','北京':'京菜','山西':'晋菜','河北':'冀菜'})[row.province]||'家常菜',servings:1,prep_minutes:0,cook_minutes:0,original_amounts:true,ingredient_items:items,ingredients:items.map(x=>x.name),seasonings:seasonings.length?[...new Set(seasonings)]:['无需额外调料'],steps,step_details:steps.map(instruction=>({instruction,minutes:null,heat:'按原谱步骤调整',materials:items.map(x=>x.name)})),spicy_level:row.spicy>=2?'中辣':row.spicy===1?'微辣':/辣椒|豆瓣酱|泡椒/.test(seasonings.join('、'))?'微辣':'不辣',salt_level:'适中',source_category:category,menu_eligible:['荤菜','素菜','汤羹','水产'].includes(category),familiar:require('./mainstream-recipes.cjs').familiarNames.has(name),source_type:snapshot.sourceType||'chishenme_original',source_title:name,source_name:snapshot.title||'吃什么',source_repository:'https://github.com/'+snapshot.repository,source_path:(snapshot.recipePath||'app/data/howto.json')+'#'+name,source_url:'https://github.com/'+snapshot.repository+'/blob/'+snapshot.commit+'/'+(snapshot.recipePath||'app/data/howto.json'),source_commit:snapshot.commit,source_sha256:hash(JSON.stringify({row,howto:howto[name]})),source_license:'MIT',source_license_notice:license,hide_source_credit:true,source_ingredients:row.ingredients.join('\n'),source_calculation:row.ingredients.join('\n'),source_extra:'原谱未注明可缩放份数或完整用量，不自动按人数换算。\n本程序补充：'+safety,doneness_check:safety,verification_status:'source_transcribed_not_cook_tested',classification_basis:'按原谱菜系、原料和辣度归类；咸淡默认适中，未试做实测'};
  output.push(r);audit.push({...record,action:'added',id:r.recipe_id});
 }
 fs.writeFileSync(path.join(dir,(snapshot.namespace||'chishenme')+'-import-audit.json'),JSON.stringify({...snapshot,selected:rows.length,added:audit.filter(x=>x.action==='added').length,recipes:audit},null,2)+'\n');
}
module.exports={merge};
