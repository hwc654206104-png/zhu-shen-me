const F=require('../../utils/recipe-favorites');
const S=require('../../utils/store');
const request=data=>wx.cloud.callFunction({name:'pigFriends',data}).then(r=>{if(!r.result||!r.result.ok)throw Error((r.result&&r.result.code)||'SERVICE_UNAVAILABLE');return r.result;});
const decorate=m=>({...m,names:m.ids.map(id=>(S.byId.get(id)||{}).name||'菜谱已更新').join(' · '),date:new Date(m.createdAt).toLocaleDateString(),items:m.ids.map(id=>S.byId.get(id)).filter(Boolean)});
const library=menus=>{const seen=new Set();return menus.flatMap(m=>m.ids.filter(id=>{if(seen.has(id))return false;seen.add(id);return true;}).map(recipeId=>({...decorate({...m,ids:[recipeId]}),recipeId,key:m.id+'_'+recipeId})));};
Page({
 data:{profile:{},achievement:{},menus:[],selected:null,loading:true,error:'',saving:false},
 onLoad(q){this.friend=q.friend||'';},
 onShow(){this.refresh();},
 onHide(){this.requestGeneration=(this.requestGeneration||0)+1;this.setData({menus:[],selected:null,profile:{},achievement:{},loading:false});},
 onUnload(){this.requestGeneration=(this.requestGeneration||0)+1;},
 async refresh(){
  const generation=this.requestGeneration=(this.requestGeneration||0)+1;this.setData({loading:true,error:'',menus:[],selected:null,profile:{},achievement:{}});
  try{const r=await request({action:'friendMenus',friend:this.friend});if(generation!==this.requestGeneration)return;this.setData({profile:r.profile,achievement:r.achievement,menus:library(r.menus)});}
  catch(e){if(generation===this.requestGeneration)this.setData({error:e.message==='FORBIDDEN'?'已解除好友，无法查看':'暂时无法查看，请重试'});}
  finally{if(generation===this.requestGeneration)this.setData({loading:false});}
 },
 async openMenu(e){
  const generation=this.requestGeneration=(this.requestGeneration||0)+1;this.setData({selected:null,error:'',loading:true});
  try{const r=await request({action:'friendMenu',friend:this.friend,menu:e.currentTarget.dataset.id});if(generation!==this.requestGeneration)return;const recipeId=e.currentTarget.dataset.recipe;this.setData({selected:decorate({...r.menu,ids:recipeId&&r.menu.ids.includes(recipeId)?[recipeId]:r.menu.ids})});}
  catch(e){if(generation===this.requestGeneration)this.setData({menus:[],error:e.message==='FORBIDDEN'?'已解除好友，无法查看':'菜单已取消收藏或暂不可用'});}
  finally{if(generation===this.requestGeneration)this.setData({loading:false});}
 },
 dish(e){if(!this.data.selected||!this.data.selected.ids.includes(e.currentTarget.dataset.id))return;wx.navigateTo({url:'/recipe-book/pages/detail/index?friend='+this.friend+'&menu='+this.data.selected.id+'&recipe='+e.currentTarget.dataset.id});},
 async save(e){
  if(!this.data.selected||this.data.saving)return;this.setData({saving:true});
  try{const r=await request({action:'friendMenu',friend:this.friend,menu:this.data.selected.id});const id=e.currentTarget.dataset.id;if(!r.menu.ids.includes(id)||!S.byId.has(id))throw Error('RECIPE_NOT_FOUND');S.change(s=>F.set(s,id,true,{people:r.menu.people}));wx.showToast({title:'已收藏这道菜'});}
  catch(e){this.setData({selected:null,error:e.message==='FORBIDDEN'?'已解除好友，无法查看':'收藏失败，请重试'});}
  finally{this.setData({saving:false});}
 },
 close(){this.requestGeneration=(this.requestGeneration||0)+1;this.setData({selected:null,loading:false});}
});
