const assert=require('assert');const {createDB}=require('./helpers/friends-db.cjs');const {createSharingState}=require('../cloudfunctions/pigFriends/sharing-state');
(async()=>{
 const {db,tables}=createDB();let time=1000;const state=createSharingState(db,()=>time);
 assert(await state.active('a'));await state.write('shares','asset',{owner:'a'},['a']);
 const first=await state.begin('a');assert(first);assert.equal(await state.begin('a'),false);assert.equal(await state.resume('a'),false);
 await assert.rejects(state.write('shares','late',{owner:'a'},['a']),/SHARING_PAUSED/);assert(!tables.shares.has('late'));
 time+=90001;const second=await state.begin('a');assert(second);assert.equal(await state.finish('a',true,first),false);await state.finish('a',false,second);assert.equal(await state.resume('a'),false);
 const third=await state.begin('a');assert(third);await state.finish('a',true,third);assert(await state.resume('a'));
 await state.write('viewed_shares','existing',{owner:'a',peer:'b',peerProfile:{name:'new'}},['a','b']);
 await state.write('viewed_shares','existing',{ownerProfile:{name:'mine'}},['a','b'],true);assert.equal(tables.viewed_shares.get('existing').peerProfile.name,'new');
 await assert.rejects(state.write('viewed_shares','revoked',{owner:'a',peer:'b'},['a','b'],false,{id:'revoked_invite'}),/INVITE_EXPIRED/);
 await state.write('viewed_shares','removed',{owner:'a',peer:'b'},['a','b'],true);assert(!tables.viewed_shares.has('removed'));
 await state.begin('b');await assert.rejects(state.write('viewed_shares','link',{owner:'a',peer:'b'},['a','b']),/SHARING_PAUSED/);
 console.log('PASS: deletion barrier, stale recovery, failed deletion pause, resume and peer isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
