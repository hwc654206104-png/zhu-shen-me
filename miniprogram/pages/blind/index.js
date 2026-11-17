const F=require('../../utils/recipe-favorites');
const S=require('../../utils/store');
Page({
 onShareTimeline(){return {title:'猪什么 · 今天煮什么，一起好好吃饭',query:''};},
 onShareAppMessage(){return {title:'猪什么 · 今天煮什么，一起好好吃饭',path:'/pages/home/index'};},
 data:{recipe:null,opening:false,mealId:'',favorited:false},
 onShow(){if(this.data.recipe)this.setData({favorited:F.has(S.load(),this.data.recipe.recipe_id)});},
 onHide(){this.cancelDraw();},onUnload(){this.cancelDraw();},
 cancelDraw(){if(this.openTimer){clearTimeout(this.openTimer);this.openTimer=null;}if(this.data.opening)this.setData({opening:false});},
 draw(){
  if(this.data.opening)return;
  const candidates=S.data.recipes.filter(r=>r.menu_eligible!==false&&(!this.data.recipe||r.recipe_id!==this.data.recipe.recipe_id));
  if(!candidates.length)return wx.showToast({title:'暂无其他菜谱，请稍后再试',icon:'none'});
  const next=candidates[Math.floor(Math.random()*candidates.length)];this.setData({opening:true});
  this.openTimer=setTimeout(()=>{this.openTimer=null;this.setData({recipe:next,opening:false,mealId:'',favorited:F.has(S.load(),next.recipe_id)});},520);
 },
 favorite(){
  if(!this.data.recipe||this.data.opening)return;
  try{const id=this.data.recipe.recipe_id,value=!F.has(S.load(),id);S.change(s=>F.set(s,id,value));this.setData({favorited:value});wx.showToast({title:value?'已收藏':'已取消收藏',icon:'success'});}
  catch(_){wx.showToast({title:'收藏失败，请重试',icon:'none'});}
 },
 open(){
  if(!this.data.recipe||this.data.opening)return;
  try{let m=this.data.mealId&&S.meal(this.data.mealId);if(!m){m=S.create([this.data.recipe.recipe_id],2,{__blind:true});this.setData({mealId:m.id});}wx.navigateTo({url:'/pages/result/index?id='+m.id});}
  catch(_){wx.showToast({title:'打开失败，请重试',icon:'none'});}
 }
});
