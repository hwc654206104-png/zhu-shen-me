const store=require('./store');
const pendingKey='pig_fridge_pending_v2';
const confirmedKey='pig_fridge_confirmed_v2';
let flight,retryTimer;
const validFridge=f=>f&&Array.isArray(f.foodIds)&&f.foodIds.every(id=>typeof id==='string')&&Number.isSafeInteger(f.revision)&&f.revision>=0;
const operationId=()=>'fridge_'+Date.now()+'_'+Math.random().toString(36).slice(2);
function rebase(pending,remote){
 const base=Array.isArray(pending.baseFoodIds)?pending.baseFoodIds:null;
 const removed=new Set(base?base.filter(id=>!pending.foodIds.includes(id)):[]);
 const removedGroups=new Set(pending.removedGroupIds||[]);
 // An uninitialized cloud fridge has no baseline from which to infer remote
 // deletions. Legacy pending edits may carry a populated local base: preserve
 // their current explicit target, including foods the user has re-added.
 const initialRemote=remote.revision===0&&!remote.foodIds.length;
 const added=base&&!initialRemote?pending.foodIds.filter(id=>!base.includes(id)):pending.foodIds;
 const foodIds=base?[...new Set(remote.foodIds.filter(id=>!removed.has(id)&&!removedGroups.has(store.foodGroups?store.foodGroups.canonical(id):id)).concat(added))]:pending.foodIds;
 const initializedBase=initialRemote&&base?{baseFoodIds:[],removedGroupIds:[...new Set([...removedGroups,...[...removed].map(id=>store.foodGroups?store.foodGroups.canonical(id):id)])]}:{};
 return {...pending,...initializedBase,foodIds,expectedRevision:remote.revision,operationId:operationId()};
}
function persist(pending){
 wx.setStorageSync(pendingKey,pending);
 store.change(s=>{s.foods=pending.foodIds;});
}
async function sync(){
 if(flight)return flight;
 flight=(async()=>{
  try{
   const {result:remote}=await wx.cloud.callFunction({name:'pigApi',data:{action:'bootstrap'}});
   if(!remote||!remote.ok||!validFridge(remote.fridge))throw Error('READ_FAILED');
   let pending=wx.getStorageSync(pendingKey);
   const confirmed=wx.getStorageSync(confirmedKey);
   // An older bootstrap must not overwrite a newer acknowledged write/read.
   if(validFridge(confirmed)&&remote.fridge.revision<confirmed.revision)remote.fridge=confirmed;
   if(!pending){
    const local=typeof store.load==='function'?store.load().foods:[];
    if(remote.fridge.revision===0&&!remote.fridge.foodIds.length&&Array.isArray(local)&&local.length){
     // Revision zero means no cloud fridge has ever been saved. Preserve and
     // migrate existing local inventory instead of treating it as consumption.
     pending={foodIds:local.slice(),baseFoodIds:[],removedGroupIds:[],operationId:operationId()};
     wx.setStorageSync(pendingKey,pending);
    }else if(!validFridge(confirmed)&&remote.fridge.foodIds.length&&Array.isArray(local)&&local.some(id=>!remote.fridge.foodIds.includes(id))){
     // Upgrade migration only: older clients did not keep a cloud baseline.
     // Preserve unconfirmed local entries once, then all later pulls use the
     // acknowledged revision so actual cross-device deletions still apply.
     pending={foodIds:[...new Set(remote.fridge.foodIds.concat(local))],baseFoodIds:remote.fridge.foodIds.slice(),removedGroupIds:[],operationId:operationId()};
     wx.setStorageSync(pendingKey,pending);
    }else{
     store.change(s=>{s.foods=remote.fridge.foodIds;});
     wx.setStorageSync(confirmedKey,remote.fridge);
     return '已同步';
    }
   }
   if(!Array.isArray(pending.foodIds))throw Error('INVALID_PENDING');
   if(pending.expectedRevision===undefined){pending=rebase(pending,remote.fridge);persist(pending);}
   for(let attempt=0;attempt<3;attempt++){
    const {foodIds,expectedRevision,operationId}=pending;
    const {result}=await wx.cloud.callFunction({name:'pigApi',data:{action:'fridge.set',foodIds,expectedRevision,operationId}});
    const latest=wx.getStorageSync(pendingKey);
    if(!result||!result.ok){
     if(result&&result.code==='CONFLICT'&&validFridge(result.fridge)){
      if(latest&&latest.operationId!==pending.operationId)return 'pending';
      pending=rebase(pending,result.fridge);persist(pending);continue;
     }
     throw Error('SAVE_FAILED');
    }
    if(validFridge(result.fridge))wx.setStorageSync(confirmedKey,result.fridge);
    if(latest&&latest.operationId===pending.operationId)wx.removeStorageSync(pendingKey);
    return '已同步';
   }
   throw Error('CONFLICT_RETRY');
  }catch(_){
   if(!retryTimer)retryTimer=setTimeout(()=>{retryTimer=null;if(wx.getStorageSync(pendingKey))sync();},3000);
   return 'pending';
  }
 })().finally(()=>{flight=null;});return flight;
}
async function setFoods(ids){
 const previous=wx.getStorageSync(pendingKey);
 const current=typeof store.load==='function'?store.load().foods:undefined;
 const confirmed=wx.getStorageSync(confirmedKey);
 // Keep the last cloud baseline across unsent edits. Using the current local
 // list as the next baseline turns earlier offline additions into old foods,
 // so rebasing onto the server would silently drop them.
 let base=previous&&Array.isArray(previous.baseFoodIds)?previous.baseFoodIds.slice():
  validFridge(confirmed)?confirmed.foodIds.slice():Array.isArray(current)?[]:undefined;
 // Capture an explicit add now, before any network response. A legacy base
 // may still contain an item previously removed and now deliberately re-added;
 // it must remain a local addition even if bootstrap stays offline until a
 // different device has already created a versioned cloud fridge.
 const currentGroups=new Set((Array.isArray(current)?current:[]).map(id=>store.foodGroups?store.foodGroups.canonical(id):id));
 const explicitAdds=new Set(ids.map(id=>store.foodGroups?store.foodGroups.canonical(id):id).filter(id=>!currentGroups.has(id)));
 if(base)base=base.filter(id=>!explicitAdds.has(store.foodGroups?store.foodGroups.canonical(id):id));
 store.change(s=>{s.foods=ids;});
 const remainingGroups=new Set(ids.map(id=>store.foodGroups?store.foodGroups.canonical(id):id));
 const removalBase=[...(base||[]),...(Array.isArray(current)?current:[])];
 const removedGroupIds=[...new Set([...(previous&&previous.removedGroupIds||[]),...removalBase.map(id=>store.foodGroups?store.foodGroups.canonical(id):id)])].filter(id=>!remainingGroups.has(id));
 wx.setStorageSync(pendingKey,{foodIds:ids,operationId:operationId(),removedGroupIds,...(base?{baseFoodIds:base}:{})});
 if(flight)await flight;
 return sync();
}
module.exports={sync,setFoods};
