// Pinned, original-text MIT recipe records. Descriptions/health claims are not imported.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../docs/miniapp/recipes'),ref=path.join(dir,'references/tidy-cookbook');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function merge(output,foods){
 const snapshot=JSON.parse(fs.readFileSync(path.join(ref,'snapshot.json'),'utf8'));
 assert.equal(hash(fs.readFileSync(path.join(ref,'raw.ts'))),snapshot.sha256);
 const rows=JSON.parse(fs.readFileSync(path.join(ref,'recipes.json'),'utf8')),license=fs.readFileSync(path.join(ref,'LICENSE'),'utf8');
 assert(license.includes('MIT License')&&license.includes('2026 ruiovo'));
 const deleted=require('../docs/miniapp/recipes/deleted-recipes.json').recipes,ids=new Set(deleted.map(x=>x.id)),names=new Set(deleted.map(x=>x.name));
 const active=()=>output.filter(r=>!ids.has(r.recipe_id)),audit=[];
 const {parseIngredients}=require('./recipe-ingredient-parser.cjs'),{composition}=require('../miniprogram/utils/recipe-composition');
 for(const row of rows){
  const [id,name,,sub,spice,,ingredients,instructions]=row;
  const entry={sourceId:id,name};
  if(names.has(name)){audit.push({...entry,action:'excluded_deleted'});continue;}
  if([19,37,79,81,82,83,85,86,87,88,89].includes(id)){audit.push({...entry,action:'excluded_specialty_or_vague'});continue;}
  let parsed;try{parsed=parseIngredients(ingredients.split('@').flatMap(x=>x.split('|')[1].split(';')));}catch(e){audit.push({...entry,action:'excluded_parse',reason:e.message});continue;}
  const items=[],seasonings=[];
  for(const i of parsed){if(i.kind==='seasoning'){seasonings.push(i.name);continue;}
   const food=foods.find(f=>f.name===i.name)||foods.find(f=>f.aliases.includes(i.name));const name=food?.name||i.name;
   if(!items.some(x=>x.name===name))items.push({name,quantity:null,unit:'原谱',source_name:i.original,source_amount:i.amount});
  }
  if(!items.length){audit.push({...entry,action:'excluded_empty'});continue;}
  const probe={name,ingredient_items:items},key=composition(probe).combinationKey;
  const duplicates=active().filter(r=>r.name===name||r.source_title===name||composition(r).combinationKey===key);
  if(duplicates.length){audit.push({...entry,action:'duplicate',targets:duplicates.map(r=>r.recipe_id)});continue;}
  if(active().length>=2000){audit.push({...entry,action:'excluded_limit'});continue;}
  const steps=instructions.split('@');if(steps.length<3)throw Error('Incomplete recipe '+name);
  for(const i of items)if(!foods.some(f=>f.name===i.name))foods.push({id:'tidy-food-'+hash(i.name).slice(0,12),name:i.name,aliases:[]});
  const category=['rice','noodle'].includes(sub)?'主食':['sweet','snack'].includes(sub)?'甜品':sub==='soup'?'汤羹':['fish','shrimp','crab','shellfish'].includes(sub)?'水产':['pork','beef','chicken'].includes(sub)?'荤菜':'素菜';
  const recipe={recipe_id:'tidy-'+hash(String(id)).slice(0,16),name,cuisine:/湘味|小炒黄牛|麻婆/.test(name)?'湘菜':/广式|顺德|粤式/.test(name)?'粤菜':'家常菜',servings:1,prep_minutes:0,cook_minutes:0,original_amounts:true,ingredient_items:items,ingredients:items.map(x=>x.name),seasonings:seasonings.length?[...new Set(seasonings)]:['无需额外调料'],steps,step_details:steps.map(instruction=>({instruction,minutes:null,heat:'按原谱步骤调整',materials:items.map(x=>x.name)})),spicy_level:spice>=3?'重辣':spice===2?'中辣':spice===1?'微辣':/辣椒|辣酱|豆瓣酱/.test(seasonings.join('、'))?'微辣':'不辣',salt_level:'适中',source_category:category,menu_eligible:['水产','荤菜','素菜','汤羹'].includes(category),familiar:require('./mainstream-recipes.cjs').familiarNames.has(name),source_type:'tidy_original',source_title:name,source_name:'Tidy Cookbook',source_repository:'https://github.com/'+snapshot.repository,source_commit:snapshot.commit,source_path:'src/data/raw.ts#'+id,source_url:'https://github.com/'+snapshot.repository+'/blob/'+snapshot.commit+'/src/data/raw.ts',source_sha256:hash(JSON.stringify(row)),source_license:'MIT',source_license_notice:license,hide_source_credit:true,source_foods:items.map(x=>x.name),source_seasonings:[...new Set(seasonings)],source_ingredients:ingredients,source_calculation:ingredients,source_extra:'保留原谱用量和步骤，原谱未明确可缩放份数，不自动按人数换算。\n本程序补充：肉、蛋、水产和豆类须充分熟透，原谱时间不能作为熟度保证。',verification_status:'source_transcribed_not_cook_tested',classification_basis:'分类按原谱菜类和原料判定；辣度沿用原谱等级，咸淡默认适中，未试做实测'};
  if(name==='麻婆豆腐')recipe.cuisine='川菜';
  recipe.doneness_check='肉、蛋、水产和豆类须充分熟透，原谱时间不能作为熟度保证。';
  output.push(recipe);audit.push({...entry,action:'added',id:recipe.recipe_id});
 }
 fs.writeFileSync(path.join(dir,'tidy-cookbook-import-audit.json'),JSON.stringify({...snapshot,selected:rows.length,added:audit.filter(x=>x.action==='added').length,recipes:audit},null,2)+'\n');
}
module.exports={merge};
