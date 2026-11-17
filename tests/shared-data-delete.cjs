const assert=require('assert');const {createService}=require('../cloudfunctions/pigFriends/service');
const {db,tables}=require('./helpers/friends-db.cjs').createDB();let user='a',fail=false;const deleted=[];
const api=createService({db,identity:()=>({APPID:'wx0cb3da57b3344189',ENV:'cloud1-d0g0ntbbyaddfb364',OPENID:user}),moderate:async()=>{},deleteFiles:async files=>{if(fail)throw Error('fail');deleted.push(...files);}});
(async()=>{
const path=(await api({action:'uploadPath'})).path;
const file='cloud://cloud1-d0g0ntbbyaddfb364.bucket/'+path;
assert((await api({action:'registerAvatar',fileID:file})).ok);
const invite=await api({action:'invite',consent:true,completed:1,favorites:0,profile:{name:'a',avatar:file}});
user='b';assert.equal((await api({action:'registerAvatar',fileID:file})).code,'FORBIDDEN');
assert((await api({action:'accept',invite:invite.invite,consent:true,completed:0,favorites:0})).ok);
user='a';assert.equal((await api({action:'deleteSharedData'})).code,'INVALID_REQUEST');
fail=true;assert.equal((await api({action:'deleteSharedData',confirm:true})).code,'SERVICE_UNAVAILABLE');assert(tables.shares.size>0);
assert.equal((await api({action:'resumeSharing',consent:true})).code,'SHARING_PAUSED');
fail=false;assert((await api({action:'deleteSharedData',confirm:true})).ok);assert(deleted.includes(file));assert.equal([...tables.shares.values()].filter(d=>d.kind!=='sharing_control').length,0);
assert.equal((await api({action:'menusSync',consent:true,menus:[]})).code,'SHARING_PAUSED');
user='b';assert.equal((await api({action:'list'})).friends.length,0);
user='a';assert((await api({action:'deleteSharedData',confirm:true})).ok);
// Legacy avatars must survive a failed storage delete even after relationships are removed.
const crypto=require('crypto');const owner=crypto.createHash('sha256').update('wx0cb3da57b3344189:a').digest('hex');
const legacy=file.replace(/[^/]+$/, 'legacy.png');
tables.viewed_shares.set('legacy',{_id:'legacy',kind:'friend',owner,peer:'other',ownerProfile:{avatar:legacy}});
for(let i=0;i<205;i++)tables.shares.set('page_'+i,{_id:'page_'+i,owner,kind:'friend'});
tables.shares.set('other',{_id:'other',owner:'other',kind:'favorite_library',menus:[]});
fail=true;assert.equal((await api({action:'deleteSharedData',confirm:true})).code,'SERVICE_UNAVAILABLE');
assert([...tables.shares.values()].some(d=>d.fileID===legacy));
assert.equal(tables.viewed_shares.size,0);
fail=false;assert((await api({action:'deleteSharedData',confirm:true})).ok);
assert(deleted.includes(legacy));assert.deepEqual([...tables.shares.values()].filter(d=>d.kind!=='sharing_control').map(d=>d._id),['other']);
assert((await api({action:'resumeSharing',consent:true})).ok);
// An invitation already awaiting moderation must not recreate data after deletion.
let release,entered;const waiting=new Promise(r=>entered=r);const gate=new Promise(r=>release=r);
const racing=createService({db,identity:()=>({APPID:'wx0cb3da57b3344189',ENV:'cloud1-d0g0ntbbyaddfb364',OPENID:'a'}),moderate:async()=>{entered();await gate;},deleteFiles:async()=>{}});
const late=racing({action:'invite',consent:true,completed:0,favorites:0});await waiting;
assert((await api({action:'deleteSharedData',confirm:true})).ok);release();assert.equal((await late).code,'SHARING_PAUSED');
assert.equal([...tables.shares.values()].filter(d=>d.owner===owner).length,0);
console.log('PASS: owner isolation, pagination, avatar retry, paused sharing, explicit resume and in-flight write barrier');
})().catch(e=>{console.error(e);process.exitCode=1;});
