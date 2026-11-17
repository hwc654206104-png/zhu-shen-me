const recipeIds=new Set(require('./recipe-ids.json'));
const crypto=require('crypto');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const view=d=>({completed:d.completed,favorites:d.favorites,updatedAt:d.updatedAt});
const valid=e=>e.consent===true&&['completed','favorites'].every(k=>Number.isSafeInteger(e[k])&&e[k]>=0&&e[k]<=100000);
function createService({db,identity,now=()=>Date.now(),moderate,deleteFiles}){return async e=>{try{
 const c=identity();if(!c||c.APPID!=='wx0cb3da57b3344189'||!c.OPENID||c.ENV!=='cloud1-d0g0ntbbyaddfb364')return {ok:false,code:'UNAUTHORIZED'};
 const me=hash(c.APPID+':'+c.OPENID),shares=db.collection('shares'),links=db.collection('viewed_shares');
 const get=async(col,id)=>(await col.where({_id:id}).limit(1).get()).data[0];
 if(!e)return {ok:false,code:'INVALID_REQUEST'};
 const state=require('./sharing-state').createSharingState(db,now);
 const write=(collection,id,data,owners=[me],mustExist=false,guard)=>state.write(collection,id,data,owners,mustExist,guard);
 if(e.action==='resumeSharing'){if(e.consent!==true)return {ok:false,code:'INVALID_REQUEST'};return await state.resume(me)?{ok:true}:{ok:false,code:'SHARING_PAUSED'};}
 const profile=async()=>{const p=e.profile||{name:'下厨好友',avatar:''};if(typeof p.name!=='string'||!p.name.trim()||Array.from(p.name).length>20||typeof p.avatar!=='string'||(p.avatar&&!p.avatar.startsWith('cloud://cloud1-d0g0ntbbyaddfb364.'))||(p.avatar&&!p.avatar.includes('/friend-avatars/'+me+'/')))throw Error('PROFILE_INVALID');const clean={name:p.name.trim(),avatar:p.avatar};if(moderate)await moderate(clean,c.OPENID);else if(p.name!=='下厨好友'||p.avatar)throw Error('MODERATION_UNAVAILABLE');return clean;};
 if(e.action==='registerAvatar'){
  const file=e.fileID;
  if(typeof file!=='string'||!file.startsWith('cloud://cloud1-d0g0ntbbyaddfb364.')||!file.includes('/friend-avatars/'+me+'/'))return {ok:false,code:'FORBIDDEN'};
  const id='avatar_'+hash(file);await write('shares',id,{kind:'avatar',owner:me,fileID:file});return {ok:true};
 }
 if(e.action==='deleteSharedData'){
  if(e.confirm!==true)return {ok:false,code:'INVALID_REQUEST'};
  if(e.fileID&&(typeof e.fileID!=='string'||!e.fileID.startsWith('cloud://cloud1-d0g0ntbbyaddfb364.')||!e.fileID.includes('/friend-avatars/'+me+'/')))return {ok:false,code:'FORBIDDEN'};
  const token=await state.begin(me);if(!token)return {ok:false,code:'SHARING_PAUSED'};
  try{
  const all=async(col,q)=>{let rows=[],offset=0;while(true){const page=(await col.where(q).skip(offset).limit(100).get()).data;rows=rows.concat(page);if(page.length<100)break;offset+=page.length;}return rows;};
  const own=await all(shares,{owner:me});const relationships=[...await all(links,{owner:me}),...await all(links,{peer:me})];
  const files=new Set(own.flatMap(d=>[d.fileID,d.profile&&d.profile.avatar]).concat(relationships.map(d=>(d.owner===me?d.ownerProfile:d.peerProfile)||{}).map(p=>p.avatar)).filter(f=>typeof f==='string'&&f.startsWith('cloud://cloud1-d0g0ntbbyaddfb364.')&&f.includes('/friend-avatars/'+me+'/')));
  if(e.fileID){if(typeof e.fileID!=='string'||!e.fileID.startsWith('cloud://cloud1-d0g0ntbbyaddfb364.')||!e.fileID.includes('/friend-avatars/'+me+'/'))return {ok:false,code:'FORBIDDEN'};files.add(e.fileID);}
  // Persist every discovered file before removing relationships (including legacy avatars).
  for(const fileID of files){const id='avatar_'+hash(fileID);if(!await get(shares,id))await shares.add({data:{_id:id,kind:'avatar',owner:me,fileID}});}
  for(const d of relationships)await links.where({_id:d._id}).remove();
  // Keep asset records until storage deletion succeeds, so retries remain possible.
  if(files.size){if(!deleteFiles)throw Error('STORAGE_UNAVAILABLE');await deleteFiles([...files]);}
  for(const fileID of files)await shares.where({_id:'avatar_'+hash(fileID)}).remove();
  for(const d of own)await shares.where({_id:d._id}).remove();
  if(!await state.finish(me,true,token))return {ok:false,code:'SHARING_PAUSED'};return {ok:true};
  }catch(err){await state.finish(me,false,token);throw err;}
 }
 if(e.action==='menusSync'){
  if(e.consent!==true||!Array.isArray(e.menus)||e.menus.length>1000)return {ok:false,code:'INVALID_REQUEST'};
  const menus=[];const seen=new Set();for(const m of e.menus){if(!m||typeof m.id!=='string'||!/^meal_[0-9]+_[a-z0-9]{1,16}$/.test(m.id)||seen.has(m.id)||!Array.isArray(m.ids)||!m.ids.length||m.ids.length>10||new Set(m.ids).size!==m.ids.length||m.ids.some(id=>!recipeIds.has(id))||!Number.isInteger(m.people)||m.people<1||m.people>10||!Number.isSafeInteger(m.createdAt)||m.createdAt<0)return {ok:false,code:'INVALID_REQUEST'};seen.add(m.id);menus.push({id:m.id,ids:m.ids,people:m.people,createdAt:m.createdAt});}
  const id='favorite_library_'+me;await write('shares',id,{kind:'favorite_library',owner:me,menus,updatedAt:now()});return {ok:true};
 }
 if(e.action==='friendMenus'||e.action==='friendMenu'){
  if(typeof e.friend!=='string'||!/^friendship_[a-f0-9]{64}$/.test(e.friend))return {ok:false,code:'INVALID_REQUEST'};
  const d=await get(links,e.friend);if(!d||d.kind!=='friend'||(d.owner!==me&&d.peer!==me))return {ok:false,code:'FORBIDDEN'};
  const other=d.owner===me?d.peer:d.owner;const library=await get(shares,'favorite_library_'+other);const menus=library&&library.kind==='favorite_library'&&library.owner===other?library.menus:[];
  if(!await state.active(me)||!await state.active(other))return {ok:false,code:'FORBIDDEN'};
  const current=await get(links,e.friend);if(!current||current.kind!=='friend'||(current.owner!==me&&current.peer!==me))return {ok:false,code:'FORBIDDEN'};
  if(e.action==='friendMenu'){const menu=menus.find(m=>m.id===e.menu);return menu?{ok:true,menu}:{ok:false,code:'MENU_UNAVAILABLE'};}
  return {ok:true,profile:(d.owner===me?d.peerProfile:d.ownerProfile)||{name:'下厨好友',avatar:''},achievement:d.owner===me?d.peerStats:d.ownerStats,menus};
 }
 if(e.action==='checkProfile'){if(e.consent!==true)return {ok:false,code:'INVALID_REQUEST'};await profile();return {ok:true};}
 if(e.action==='uploadPath'){if(!await state.active(me))return {ok:false,code:'SHARING_PAUSED'};return {ok:true,path:'friend-avatars/'+me+'/'+crypto.randomBytes(12).toString('hex')+'.png'};}
 if(e.action==='remove'||e.action==='revoke'){
  const col=e.action==='remove'?links:shares;
  if(typeof e.id!=='string'||!(e.action==='remove'?/^friendship_[a-f0-9]{64}$/:/^friend_[a-f0-9]{48}$/).test(e.id))return {ok:false,code:'INVALID_REQUEST'};
  const d=await get(col,e.id);
  if(!d)return {ok:true};
  if(d.kind!=='friend'||(d.owner!==me&&(e.action!=='remove'||d.peer!==me)))return {ok:false,code:'FORBIDDEN'};
  await col.where({_id:e.id}).remove();return {ok:true};
 }
 if(e.action==='invite'){
  if(!valid(e))return {ok:false,code:'INVALID_REQUEST'};
  const sharedProfile=await profile();const id='friend_'+crypto.randomBytes(24).toString('hex');
  await write('shares',id,{kind:'friend',owner:me,profile:sharedProfile,...view({...e,updatedAt:now()}),expiresAt:now()+7*86400000});return {ok:true,invite:id};
 }
 if(e.action==='preview'||e.action==='accept'){
  if(typeof e.invite!=='string'||!/^friend_[a-f0-9]{48}$/.test(e.invite))return {ok:false,code:'INVALID_REQUEST'};
  const d=await get(shares,e.invite);if(!d||d.kind!=='friend'||d.expiresAt<=now())return {ok:false,code:'INVITE_EXPIRED'};
  if(!await state.active(d.owner))return {ok:false,code:'INVITE_EXPIRED'};
  if(d.owner===me)return {ok:false,code:'SELF_INVITE'};
  if(e.action==='preview')return {ok:true,achievement:view(d)};
  if(!valid(e))return {ok:false,code:'INVALID_REQUEST'};
  const sharedProfile=await profile();const id='friendship_'+hash([me,d.owner].sort().join(':'));
  if(!await get(links,id))await write('viewed_shares',id,{kind:'friend',owner:d.owner,peer:me,ownerProfile:d.profile||{name:'下厨好友',avatar:''},peerProfile:sharedProfile,ownerStats:view(d),peerStats:view({...e,updatedAt:now()}),createdAt:now()},[me,d.owner],false,{id:e.invite});
  return {ok:true};
 }
 if(e.action==='list'){
  if(!await state.active(me))return {ok:true,friends:[],sharingPaused:true};
  const a=(await links.where({kind:'friend',owner:me}).limit(100).get()).data,b=(await links.where({kind:'friend',peer:me}).limit(100).get()).data;
  const rows=[...new Map([...a,...b].map(d=>[d._id,d])).values()];
  if(e.consent===true&&e.profile&&valid(e)){const p=await profile();for(const d of rows){const mine=d.owner===me?'owner':'peer';await write('viewed_shares',d._id,{[mine+'Profile']:p,[mine+'Stats']:view({...e,updatedAt:now()})},[d.owner,d.peer],true);}}
  return {ok:true,friends:rows.map(d=>({id:d._id,profile:(d.owner===me?d.peerProfile:d.ownerProfile)||{name:'下厨好友',avatar:''},achievement:d.owner===me?d.peerStats:d.ownerStats}))};
 }
 return {ok:false,code:'INVALID_REQUEST'};
 }catch(err){if(err.message==='CONTENT_CHECK_UNAVAILABLE')return {ok:false,code:err.message,providerCode:err.providerCode};return {ok:false,code:['PROFILE_INVALID','CONTENT_REJECTED','IMAGE_TOO_LARGE','SHARING_PAUSED','INVITE_EXPIRED'].includes(err.message)?err.message:'SERVICE_UNAVAILABLE'};}};}module.exports={createService};
