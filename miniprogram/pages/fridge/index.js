const S = require('../../utils/store');
const sync = require('../../utils/fridge-sync');
Page({
  data: {owned:[],results:[],sheet:false,height:55,dirty:false},
  onLoad() {this.originalFoods=S.load().foods.slice();this.draftFoods=this.originalFoods.slice();},
  onHide() {this.commit();},
  onUnload() {this.commit();},
  commit() {
    if(!this.data.dirty)return;
    const removed=new Set(this.originalFoods.filter(id=>!this.draftFoods.includes(id)).map(id=>S.foodGroups.canonical(id)));
    const added=this.draftFoods.filter(id=>!this.originalFoods.includes(id));
    const ids=[...new Set(S.load().foods.filter(id=>!removed.has(S.foodGroups.canonical(id))).concat(added))];
    this.originalFoods=ids.slice();this.draftFoods=ids.slice();
    this.setData({dirty:false});
    sync.setFoods(ids).catch(()=>{});
  },
  onShow() {if(!this.data.dirty){this.originalFoods=S.load().foods.slice();this.draftFoods=this.originalFoods.slice();}this.render();},
  render() {
    const ids=this.draftFoods||[];
    const all=S.foodGroups.catalog.map(f=>({...f,aliasText:f.aliases.join('、'),owned:ids.some(id=>S.foodGroups.canonical(id)===f.id)}));
    const catalogMatches=new Set(S.foodIndex.findFoods(this.catalogQuery).map(food=>food.id));
    this.setData({owned:all.filter(f=>f.owned),results:all.filter(f=>catalogMatches.has(f.id))});
  },
  searchCatalog(e){this.catalogQuery=e.detail.value.trim();this.render();},
  openSheet(){this.catalogQuery='';this.setData({sheet:true,height:55});this.render();},
  closeSheet(){this.setData({sheet:false});},noop(){},
  dragStart(e){this.startY=e.touches[0].clientY;this.startHeight=this.data.height;},
  dragMove(e){this.setData({height:Math.max(12,Math.min(85,this.startHeight+(this.startY-e.touches[0].clientY)/wx.getWindowInfo().windowHeight*100))});},
  dragEnd(){if(this.data.height<30)this.closeSheet();},
  toggle(e){const id=e.currentTarget.dataset.id,ids=this.draftFoods;this.save(ids.some(value=>S.foodGroups.canonical(value)===id)?S.foodGroups.remove(ids,[id]):ids.concat(id));},
  remove(e){this.save(S.foodGroups.remove(this.draftFoods,[e.currentTarget.dataset.id]));},
  save(ids){this.draftFoods=[...new Set(ids)];this.setData({dirty:this.draftFoods.slice().sort().join('|')!==this.originalFoods.slice().sort().join('|')});this.render();},
});


