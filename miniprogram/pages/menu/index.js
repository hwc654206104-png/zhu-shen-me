const S=require('../../utils/store');
const F=require('../../utils/recipe-favorites');
Page({onShareTimeline(){return {title:'猪什么 · 今天煮什么，一起好好吃饭',query:''};},onShareAppMessage(){return {title:'猪什么 · 今天煮什么，一起好好吃饭',path:'/pages/home/index'};},
  data:{ongoing:[],saved:[],completed:[],doingOpen:false,savedOpen:false,completedOpen:false},
  onLoad(q){if(q&&q.open==='saved')this.setData({savedOpen:true});},
  onShow(){
    if(wx.getStorageSync('open_saved_menu')){wx.removeStorageSync('open_saved_menu');this.setData({savedOpen:true});}
    const meals=(S.load().meals||[]).map(m=>{
      const ids=Array.isArray(m.ids)?m.ids:[];
      const names=ids.map(id=>{const recipe=S.byId&&S.byId.get(id);return recipe&&recipe.name?recipe.name:'菜谱已更新';}).join(' · ');
      const d=new Date(Number(m.completedAt||m.createdAt)||Date.now());
      const displayTitle=`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
      return {...m,ids,names,done:Array.isArray(m.done)?m.done:[],displayTitle};
    });
    this.setData({ongoing:meals.filter(m=>m.started&&m.done.length<m.ids.length),saved:F.list(S.load()).map(m=>({...m,name:(S.byId.get(m.recipeId)||{}).name||'菜谱已更新'})),completed:meals.filter(m=>m.ids.length>0&&m.done.length===m.ids.length)});
  },
  toggleDoing(){this.setData({doingOpen:!this.data.doingOpen});},
  toggleCompleted(){this.setData({completedOpen:!this.data.completedOpen});},
  toggleSaved(){this.setData({savedOpen:!this.data.savedOpen});},
  goWizard(){wx.navigateTo({url:'/pages/wizard/index'});},
  open(e){const id=e.currentTarget.dataset.id;const from=this.data.saved.some(m=>m.id===id)?'saved':'';wx.navigateTo({url:'/pages/result/index?id='+id+(from?'&from=saved':'')});},
  continueCooking(e){const id=e.currentTarget.dataset.id,m=S.meal(id);if(!m||!m.started||m.done.length===m.ids.length)return this.onShow();const recipe=m.ids.includes(m.viewId)&&!m.done.includes(m.viewId)?m.viewId:m.ids.find(r=>!m.done.includes(r));wx.navigateTo({url:'/recipe-book/pages/detail/index?meal='+id+'&recipe='+recipe});},
  endCooking(e){const id=e.currentTarget.dataset.id;S.change(s=>{const m=s.meals.find(x=>x.id===id);if(!m||!m.started)return;m.started=false;m.done=[];delete m.completedAt;m.viewId=(m.ids||[])[0];});this.onShow();},
  openFavorite(e){const id=e.currentTarget.dataset.recipe;if(!S.byId.has(id))return wx.showToast({title:'该菜谱已更新，可取消收藏',icon:'none'});let target;S.change(s=>{target=F.ensureMeal(s,id);});wx.navigateTo({url:'/pages/result/index?id='+target.id+'&from=saved'});},
  remove(e){S.change(s=>F.set(s,e.currentTarget.dataset.recipe,false));wx.showToast({title:'已取消收藏',icon:'success'});this.onShow();},
  deleteMeal(e){const id=e.currentTarget.dataset.id;S.change(s=>{const favorites=F.list(s).filter(m=>m.id===id);s.meals=(s.meals||[]).filter(m=>m.id!==id);for(const row of favorites)F.set(s,row.recipeId,true,{people:row.people,note:row.note,preserveLegacy:true});});this.onShow();wx.showToast({title:"已删除",icon:"success"});},
  edit(e){const id=e.currentTarget.dataset.recipe;const row=F.list(S.load()).find(m=>m.recipeId===id)||{};wx.showModal({title:'编辑备注',editable:true,content:row.note||'',success:r=>{if(r.confirm){S.change(s=>F.note(s,id,(r.content||'').slice(0,300)));this.onShow();}}});}
});
