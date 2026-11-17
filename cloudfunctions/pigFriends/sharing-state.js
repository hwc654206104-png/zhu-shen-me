// All shared writes and deletion barriers use the same transactional control document.
function createSharingState(db,now=()=>Date.now()){
 const ref=(owner,source=db)=>source.collection('shares').doc('sharing_control_'+owner);
 const read=async(owner,source=db)=>{const r=await ref(owner,source).get();if(r.code)throw Error('STATE_READ_FAILED');return Array.isArray(r.data)?r.data[0]:r.data;};
 const transaction=fn=>db.runTransaction(fn);
 return {
  async active(owner){const d=await read(owner);return !d||d.phase==='active';},
  async resume(owner){return transaction(async tx=>{const d=await read(owner,tx);if(d&&['deleting','failed'].includes(d.phase))return false;await ref(owner,tx).set({data:{kind:'sharing_control',subject:owner,phase:'active'}});return true;});},
  async begin(owner){return transaction(async tx=>{const d=await read(owner,tx);if(d&&d.phase==='deleting'&&now()-(Number.isFinite(d.startedAt)?d.startedAt:now())<90000)return false;const token=require('crypto').randomBytes(16).toString('hex');await ref(owner,tx).set({data:{kind:'sharing_control',subject:owner,phase:'deleting',startedAt:now(),token}});return token;});},
  async finish(owner,success,token){return transaction(async tx=>{const d=await read(owner,tx);if(!d||d.token!==token||d.phase!=='deleting')return false;await ref(owner,tx).set({data:{kind:'sharing_control',subject:owner,phase:success?'paused':'failed'}});return true;});},
  async write(collection,id,data,owners,mustExist=false,guard){return transaction(async tx=>{
   for(const owner of [...new Set(owners)].sort()){
    const d=await read(owner,tx);if(d&&d.phase!=='active')throw Error('SHARING_PAUSED');
    // Touching the barrier makes a simultaneous deletion conflict and retry.
    await ref(owner,tx).set({data:{kind:'sharing_control',subject:owner,phase:'active',revision:(d&&d.revision||0)+1}});
   }
   const target=tx.collection(collection).doc(id);
   if(guard){const r=await tx.collection('shares').doc(guard.id).get();if(r.code)throw Error('STATE_READ_FAILED');const invite=Array.isArray(r.data)?r.data[0]:r.data;if(!invite||invite.expiresAt<=now())throw Error('INVITE_EXPIRED');}
   if(mustExist){const r=await target.get();if(r.code)throw Error('STATE_READ_FAILED');const current=Array.isArray(r.data)?r.data[0]:r.data;if(!current)return;const {_id,...previous}=current;data={...previous,...data};}
   await target.set({data});
  });}
 };
}
module.exports={createSharingState};
