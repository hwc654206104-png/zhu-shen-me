// Import only complete recipes from a pinned, locally archived MIT source.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../docs/miniapp/recipes'),ref=path.join(dir,'references/jcyicai-cookbook');
const rows=[
 ['三杯鸡','meat_dish','三杯鸡','台湾菜',[['新鲜鸡腿','鸡腿肉'],['新鲜罗勒叶(九层塔)','罗勒'],['姜片','姜'],['大蒜粒','蒜'],['葱白','小葱']],['干辣椒','米酒','生抽','老抽','冰糖','香油','食用油'],'微辣'],
 ['爆炒蛳螺','meat_dish','爆炒蛳螺','江浙菜',[['螺蛳','螺蛳'],['葱白','小葱'],['姜片','姜'],['大蒜','蒜']],['干辣椒','花椒','料酒','白糖','生抽','老抽','豆瓣酱','食用油'],'中辣'],
 ['糖醋排骨','meat_dish','糖醋排骨'],
 ['红烧大头虾','meat_dish','红烧大头虾','江浙菜',[['大头虾(罗氏虾)','罗氏虾'],['姜片','姜'],['葱','小葱']],['料酒','生抽','老抽','冰糖','食用油'],'不辣'],
 ['红烧肉','meat_dish','南派红烧肉'],
 ['清炒苋菜','vegetable_dish','清炒苋菜','江浙菜',[['苋菜','苋菜'],['蒜','蒜']],['蚝油','盐','食用油'],'不辣'],
 ['煲仔饭','staple_dish'],['丝瓜炒蛋','vegetable_dish'],['芦蒿炒香干','vegetable_dish'],['葱油蚕豆','vegetable_dish']
];
function sections(raw){const parts={};let current='';for(const line of raw.split(/\r?\n/)){if(/^## /.test(line)){current=line.slice(3).trim();parts[current]=[];}else if(/^\s*-\s*\S/.test(line)&&current)parts[current].push(line.replace(/^\s*-\s*/,''));}return parts;}
function merge(output,foods){
 const snap=JSON.parse(fs.readFileSync(path.join(ref,'snapshot.json'),'utf8')),license=fs.readFileSync(path.join(ref,'LICENSE'),'utf8');
 assert(license.includes('MIT License')&&license.includes('Jason Chen'));
 const audit=[];
 for(const [title,folder,target,cuisine,mappings,seasonings,spicy] of rows){
  const sourcePath=`menu/${folder}/${title}/${title}.md`,raw=fs.readFileSync(path.join(ref,sourcePath),'utf8'),parts=sections(raw),hash=crypto.createHash('sha256').update(raw).digest('hex');
  if(!parts['食材']?.length||!parts['做法']?.length){audit.push({title,path:sourcePath,sha256:hash,action:'excluded_empty'});continue;}
  if(!mappings){const old=output.find(r=>r.name===target);assert(old,'Duplicate target missing: '+target);audit.push({title,path:sourcePath,sha256:hash,action:'duplicate_existing',id:old.recipe_id});continue;}
  const items=mappings.map(([rawName,name])=>{const line=parts['食材'].find(l=>l.startsWith(rawName+' '));assert(line,'Missing ingredient '+rawName);if(!foods.some(f=>f.name===name))foods.push({id:'jcyicai-food-'+crypto.createHash('sha256').update(name).digest('hex').slice(0,12),name,aliases:name==='罗勒'?['九层塔']:[]});return {name,quantity:null,unit:'原谱',source_name:rawName,source_amount:line.slice(rawName.length).trim()};});
  const steps=parts['做法'].map(s=>s.replace(/\*\*/g,''));
  const recipe={recipe_id:'jcyicai-'+crypto.createHash('sha256').update(sourcePath).digest('hex').slice(0,16),name:title,cuisine,servings:1,prep_minutes:0,cook_minutes:0,original_amounts:true,ingredient_items:items,ingredients:parts['食材'],seasonings,steps,step_details:steps.map(instruction=>({instruction,minutes:null,heat:'按原谱步骤调整',materials:items.map(i=>i.name)})),source_type:'jcyicai_original',source_name:'一人一食 · Jason Chen',source_title:title,source_path:sourcePath,source_repository:'https://github.com/'+snap.repository,source_url:'https://github.com/'+snap.repository+'/blob/'+snap.commit+'/'+sourcePath,source_commit:snap.commit,source_sha256:hash,source_license:'MIT',source_license_notice:license,source_ingredients:parts['食材'].join('\n'),source_calculation:parts['食材'].join('\n'),source_foods:items.map(i=>i.name),source_seasonings:seasonings,source_extra:(parts['小贴士']||[]).join('\n'),spicy_level:spicy,salt_level:'适中',classification_basis:'根据原谱食材、步骤推断菜系及口味，咸淡默认适中；未实测',menu_eligible:true,familiar:true,verification_status:'source_transcribed_not_cook_tested',doneness_check:title==='爆炒蛳螺'?'螺肉必须彻底熟透；原谱时间不作为充分杀菌的保证。':'肉类和水产须充分熟透；不以表面变色代替熟度判断。'};
  // Keep upstream steps intact and distinguish supplemental food-safety guidance.
  recipe.source_extra+='\n本程序补充：'+recipe.doneness_check;
  output.push(recipe);audit.push({title,path:sourcePath,sha256:hash,action:'added',id:recipe.recipe_id});
 }
 fs.writeFileSync(path.join(dir,'jcyicai-import-audit.json'),JSON.stringify({repository:snap.repository,commit:snap.commit,license:'MIT',added:audit.filter(r=>r.action==='added').length,duplicates:audit.filter(r=>r.action==='duplicate_existing').length,empty:audit.filter(r=>r.action==='excluded_empty').length,recipes:audit},null,2)+'\n');
}
module.exports={merge};
