const {tutorials}=require('../../data/tutorials');
const {foodIndex}=require('../../../utils/store');
Page({
 data:{query:'',category:'全部',categories:['全部','荤菜','素菜','水产','汤羹','主食','早餐','甜品','饮品','调料','半成品'],rows:[],count:0},
 onLoad(){this.render();},search(e){this.setData({query:e.detail.value.trim()});this.render();},category(e){this.setData({category:e.currentTarget.dataset.category});this.render();},
 render(){
  const matches=this.data.query?foodIndex.searchRecipes(this.data.query):null;
  const rows=Object.values(tutorials).filter(r=>(this.data.category==='全部'||r.dish_category===this.data.category)&&(!matches||matches.has(r.recipe_id)||foodIndex.normalize(r.source_title||r.name).includes(foodIndex.normalize(this.data.query)))).map(r=>({id:r.recipe_id,name:r.source_title||r.name,category:r.dish_category||r.source_category}));
  this.setData({rows,count:rows.length});
 },
 open(e){wx.navigateTo({url:'/recipe-book/pages/detail/index?catalog=1&recipe='+e.currentTarget.dataset.id});}
});
