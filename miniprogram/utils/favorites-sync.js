const F=require('./recipe-favorites');
let pending=null,running=false,timer=null;
function schedule(state){if(!wx.cloud||wx.getStorageSync('pig_friend_consent')!==true)return;pending=F.shared(state);if(pending.length>1000){pending=null;wx.setStorageSync('pig_favorites_sync_error',true);return;}if(timer)clearTimeout(timer);timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},500);}
async function flush(){if(running)return;if(!pending)return;running=true;try{while(pending){if(wx.getStorageSync('pig_friend_consent')!==true){pending=null;break;}const menus=pending;pending=null;try{const r=await wx.cloud.callFunction({name:'pigFriends',data:{action:'menusSync',consent:true,menus}});if(!r.result||!r.result.ok)throw Error('SYNC_FAILED');wx.removeStorageSync('pig_favorites_sync_error');}catch(e){if(!pending)pending=menus;wx.setStorageSync('pig_favorites_sync_error',true);throw e;}}}finally{running=false;}}
async function stop(){pending=null;if(timer){clearTimeout(timer);timer=null;}while(running)await new Promise(resolve=>setTimeout(resolve,25));pending=null;}
module.exports={schedule,flush,stop};
