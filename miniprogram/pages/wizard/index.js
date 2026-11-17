const S=require('../../utils/store');
const pantryModeKey='pig_strict_pantry_v1';
Page({
  data:{people:2,count:2,prefs:{},strictPantry:true,groups:[{key:'cuisine',label:'菜系',options:Object.keys(S.data.metadata.byCuisine)},{key:'spicy',label:'辣度',options:Object.keys(S.data.metadata.bySpicyLevel)},{key:'salt',label:'咸淡',options:Object.keys(S.data.metadata.bySaltLevel)}],error:''},
  onLoad(){try{this.setData({strictPantry:wx.getStorageSync(pantryModeKey)!==false});}catch(_){}},
  pantryMode(e){const strictPantry=e.detail.value.includes('strict');this.setData({strictPantry,error:''});try{wx.setStorageSync(pantryModeKey,strictPantry);}catch(_){}},
  people(e){this.setData({people:Math.max(1,Math.min(10,Math.round(e.detail.value)))});},
  count(e){this.setData({count:Math.max(1,Math.min(10,Math.round(e.detail.value)))});},
  taste(e){const {key,value}=e.currentTarget.dataset;const prefs={...this.data.prefs};prefs[key]=prefs[key]===value?'':value;this.setData({prefs});},
  generate(){this.setData({error:''});try{const s=S.load();const prefs={...this.data.prefs,strictPantry:this.data.strictPantry,__generationHistory:[]};const ids=S.select(prefs,this.data.count,s.foods,[]);if(!ids.length)return this.setData({error:'暂无新的合适菜单，请调整食材、菜数或口味。'});const m=S.create(ids,this.data.people,{...prefs,__generationHistory:[ids.slice().sort().join('|')]});wx.navigateTo({url:'/pages/result/index?id='+m.id});}catch(_){this.setData({error:'保存失败，请重试'});}}
});
