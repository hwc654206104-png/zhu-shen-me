const seasoningIndex=require('../../data/seasoning-index');
const ingredientIndex=require('../../data/ingredient-index');
const S=require('../../utils/store');
const F=require('../../utils/recipe-favorites');
Page({
 data:{meal:{},items:[],missing:[],minutes:0,complete:false,ingredients:[],seasonings:[],fromSaved:false,lockedIds:[]},
 onLoad(q){this.id=q.id;const m=S.meal(this.id);const ids=m&&m.preferences&&Array.isArray(m.preferences.__lockedIds)?m.preferences.__lockedIds:[];this.setData({fromSaved:q.from==='saved',lockedIds:ids.filter(id=>m.ids.includes(id))});},
 onShow(){
  const m=S.meal(this.id);
  if(!m||!Array.isArray(m.ids)||!m.ids.length||m.ids.some(id=>!S.byId.has(id))){this.setData({error:'菜单不存在或已失效',meal:{},items:[],ingredients:[],seasonings:[],missing:[]});return;}
  const s=S.load(),items=m.ids.map(id=>({...S.byId.get(id),favorited:F.has(s,id),locked:(this.data.lockedIds||[]).includes(id)})),foodNames=new Map(S.foodGroups.catalog.map(f=>[f.id,f.name]));
  const available=S.availableFoods(s.foods);
  const missing=[...new Set(items.flatMap(r=>S.requiredFoods(r)).filter(id=>!available.has(id)).map(id=>S.foodGroups.canonical(id)))].map(id=>foodNames.get(id)||'待确认食材');
  const ingredients=S.foodGroups.names(items.flatMap(r=>ingredientIndex[r.recipe_id]||[])),seasonings=[...new Set(items.flatMap(r=>seasoningIndex[r.recipe_id]||[]))];
  this.setData({error:'',meal:m,items,missing,ingredients,seasonings,timeKnown:items.every(r=>Number.isFinite(r.prep_minutes)&&Number.isFinite(r.cook_minutes)&&r.prep_minutes+r.cook_minutes>0),minutes:items.reduce((n,r)=>n+r.prep_minutes+r.cook_minutes,0),complete:m.done.length===m.ids.length});
 },
 backWizard(){wx.navigateBack({delta:1});},
 dish(e){if(!S.meal(this.id)||!S.byId.has(e.currentTarget.dataset.id))return;wx.navigateTo({url:'/recipe-book/pages/detail/index?meal='+this.id+'&recipe='+e.currentTarget.dataset.id});},
 start(){const m=S.meal(this.id);if(!m||!m.ids.length)return this.onShow();const complete=m.done.length===m.ids.length;const id=complete?m.ids[0]:(m.ids.includes(m.viewId)&&!m.done.includes(m.viewId)?m.viewId:m.ids.find(id=>!m.done.includes(id)));if(!complete&&!m.started)S.update(this.id,item=>{item.started=true;item.viewId=id;});this.dish({currentTarget:{dataset:{id}}});},
 favorite(e){const id=e.currentTarget.dataset.id;if(!S.byId.has(id))return;try{S.change(s=>F.set(s,id,!F.has(s,id),{people:this.data.meal.people}));this.onShow();}catch(_){wx.showToast({title:'保存失败',icon:'none'});}},
 toggleLock(e){const id=e.currentTarget.dataset.id,m=S.meal(this.id);if(!m||!m.ids.includes(id)||this.data.fromSaved||m.done.length===m.ids.length||m.preferences&&m.preferences.__blind)return;const locks=this.data.lockedIds||[];this.setData({lockedIds:locks.includes(id)?locks.filter(x=>x!==id):locks.concat(id)});this.onShow();},
 refresh(){
  const m=S.meal(this.id);if(!m||!m.ids.length)return this.onShow();
  if(this.data.fromSaved||m.done.length===m.ids.length)return;
  const preferences=m.preferences||{};
  const lockedIds=(this.data.lockedIds||[]).filter(id=>m.ids.includes(id));
  if(lockedIds.length===m.ids.length)return wx.showToast({title:'请先解除一道菜的保留',icon:'none'});
  const history=[...new Set([...(Array.isArray(preferences.__generationHistory)?preferences.__generationHistory:[]),[...new Set(m.ids)].sort().join('|')])];
  const previousKeys=new Set(history.map(key=>[...new Set(key.split('|'))].sort().join('|')));
  const usedRecipes=new Set(history.flatMap(key=>key.split('|')));
  const s=S.load(),blindPool=S.data.recipes.filter(r=>r.menu_eligible!==false&&!usedRecipes.has(r.recipe_id));
  let ids=m.preferences&&m.preferences.__blind?(blindPool.length?[blindPool[Math.floor(Math.random()*blindPool.length)].recipe_id]:[]):S.select(preferences,m.ids.length,s.foods,history,Math.random,m.ids,lockedIds);
  if(!ids.length||lockedIds.some(id=>!ids.includes(id))||previousKeys.has([...new Set(ids)].sort().join('|')))return wx.showToast({title:'暂无新的合适菜单，请调整食材或口味',icon:'none'});
  if(lockedIds.length){const remaining=ids.filter(id=>!lockedIds.includes(id));ids=m.ids.map(id=>lockedIds.includes(id)?id:remaining.shift());}
  try{const next=S.create(ids,m.people,{...preferences,__lockedIds:lockedIds,__generationHistory:[...history,[...new Set(ids)].sort().join('|')]});wx.redirectTo({url:'/pages/result/index?id='+next.id});}catch(_){wx.showToast({title:'保存失败，请重试',icon:'none'});}
 }
});
