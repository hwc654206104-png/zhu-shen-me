const recipes = require('../data/recipe-index').recipes;
const known = new Set(recipes.map(r=>r.recipe_id));
function list(state) {
 const seen=new Set(),rows=[];
 for(const m of state.meals||[]) {
  if(!m.favorite)continue;
  const excluded=new Set(m.favoriteExcludedIds||[]);
  for(const recipeId of m.ids||[])if(!excluded.has(recipeId)&&!seen.has(recipeId)){
   seen.add(recipeId);rows.push({...m,recipeId,ids:[recipeId],done:[],started:false});
  }
 }
 return rows;
}
function has(state,id){return list(state).some(m=>m.recipeId===id);}
function set(state,id,value,options={}){
 if(value&&!known.has(id)&&options.preserveLegacy!==true)throw Error('RECIPE_NOT_FOUND');
 if(value&&has(state,id))return;
 for(const m of state.meals||[])if(m.favorite&&(m.ids||[]).includes(id)){
  if(m.ids.length===1)m.favorite=false;
  else m.favoriteExcludedIds=[...new Set([...(m.favoriteExcludedIds||[]),id])];
 }
 if(value){
  const now=Date.now();
  const existing=(state.meals||[]).find(m=>m.favoriteOnly&&m.ids.length===1&&m.ids[0]===id);
  if(existing){existing.favorite=true;existing.favoriteExcludedIds=[];return;}
  state.meals.unshift({id:'meal_'+now+'_'+Math.random().toString(36).slice(2,10),ids:[id],people:options.people||2,preferences:{__catalog:true},done:[],favorite:true,favoriteOnly:true,started:false,viewId:id,title:'收藏菜谱',note:options.note||'',createdAt:now});
 }
}
function note(state,id,text){
 const old=list(state).find(m=>m.recipeId===id);if(!old)return;
 set(state,id,false);set(state,id,true,{people:old.people,note:text,preserveLegacy:true});
 const row=(state.meals||[]).find(m=>m.favorite&&m.favoriteOnly&&m.ids[0]===id);if(row)row.note=text;
}
function ensureMeal(state,id){
 const row=list(state).find(m=>m.recipeId===id);if(!row||!known.has(id))throw Error('RECIPE_NOT_FOUND');
 const existing=(state.meals||[]).find(m=>m.favorite&&m.ids.length===1&&m.ids[0]===id&&!(m.favoriteExcludedIds||[]).includes(id));
 if(existing)return existing;
 set(state,id,false);set(state,id,true,{people:row.people,note:row.note});
 return (state.meals||[]).find(m=>m.favorite&&m.ids.length===1&&m.ids[0]===id);
}
function shareId(id){let a=2166136261,b=5381;for(let i=0;i<id.length;i++){a=Math.imul(a^id.charCodeAt(i),16777619);b=Math.imul(b,33)^id.charCodeAt(i);}return 'meal_0_'+(a>>>0).toString(36)+(b>>>0).toString(36);}
function shared(state){return list(state).filter(m=>known.has(m.recipeId)).map(m=>({id:shareId(m.recipeId),ids:[m.recipeId],people:Number.isInteger(m.people)&&m.people>=1&&m.people<=10?m.people:2,createdAt:Number.isSafeInteger(m.createdAt)&&m.createdAt>=0?m.createdAt:0}));}
module.exports={list,has,set,note,ensureMeal,shared,shareId};
