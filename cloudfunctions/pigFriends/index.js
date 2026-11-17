const cloud=require('wx-server-sdk');const {createService}=require('./service');cloud.init({env:cloud.DYNAMIC_CURRENT_ENV,throwOnNotFound:false});
async function moderate(profile,openid){try{
 const text=await cloud.openapi.security.msgSecCheck({openid,scene:2,version:2,content:profile.name});
 if(!text.result||text.result.suggest!=='pass')throw Error('CONTENT_REJECTED');
 if(profile.avatar){const r=await cloud.downloadFile({fileID:profile.avatar});if(!r.fileContent||r.fileContent.length>1024*1024)throw Error('IMAGE_TOO_LARGE');const check=await cloud.openapi.security.imgSecCheck({media:{contentType:r.fileContent[0]===255&&r.fileContent[1]===216?'image/jpeg':'image/png',value:r.fileContent}});if(check.errCode!==0)throw Error('CONTENT_REJECTED');}
}catch(err){if(['CONTENT_REJECTED','IMAGE_TOO_LARGE'].includes(err.message))throw err;const e=Error('CONTENT_CHECK_UNAVAILABLE');e.providerCode=Number.isSafeInteger(err.errCode)?err.errCode:null;throw e;}
}
exports.main=createService({db:cloud.database(),moderate,deleteFiles:async files=>{for(let i=0;i<files.length;i+=50){const batch=files.slice(i,i+50);const r=await cloud.deleteFile({fileList:batch});if(!Array.isArray(r.fileList)||r.fileList.length!==batch.length||r.fileList.some(f=>f.status!==0||!batch.includes(f.fileID))||new Set(r.fileList.map(f=>f.fileID)).size!==batch.length)throw Error('STORAGE_DELETE_FAILED');}},identity:()=>{const c=cloud.getWXContext();return {...c,ENV:c.ENV||process.env.TCB_ENV||process.env.SCF_NAMESPACE};}});
