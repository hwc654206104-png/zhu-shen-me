const assert=require('assert'),fs=require('fs'),vm=require('vm');
for(const name of ['home','blind','menu','profile']){
 let page;vm.runInNewContext(fs.readFileSync(`miniprogram/pages/${name}/index.js`,'utf8'),{require:()=>({}),Page:p=>page=p,wx:{}});
 const timeline=page.onShareTimeline();assert(timeline.title.includes('猪什么'));assert.equal(timeline.query,'');assert(!timeline.path);
 const share=page.onShareAppMessage();assert.equal(share.path,'/pages/home/index');assert(share.title.includes('猪什么'));assert(!share.path.includes('?'));
}
const app=JSON.parse(fs.readFileSync('miniprogram/app.json','utf8'));
assert(app.pages.includes('pages/home/index'));
assert(app.pages.includes('pages/friends/index'));
let friends;
vm.runInNewContext(fs.readFileSync('miniprogram/pages/friends/index.js','utf8'),{require:()=>({}),Page:p=>friends=p,wx:{}});
assert.equal(friends.onShareAppMessage.call({data:{invite:''}}).path,'/pages/friends/index');
const invite='friend_'+'a'.repeat(48);
assert.equal(friends.onShareAppMessage.call({data:{invite}}).path,'/pages/friends/index?invite='+invite);
console.log('PASS: main-page friend/timeline sharing, registered destinations and friend invitation links');
