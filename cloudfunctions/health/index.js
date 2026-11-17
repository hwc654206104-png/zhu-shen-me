const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const APP_ID = 'wx0cb3da57b3344189';
const ENV_ID = 'cloud1-d0g0ntbbyaddfb364';

exports.main = async () => {
  const caller = cloud.getWXContext();
  if (caller.APPID !== APP_ID || !caller.OPENID) {
    return { ok: false, code: 'UNAUTHORIZED' };
  }
  const actualEnv = caller.ENV || process.env.TCB_ENV || process.env.SCF_NAMESPACE;
  if (actualEnv !== ENV_ID) {
    return { ok: false, code: 'ENV_MISMATCH' };
  }
  return { ok: true, envId: actualEnv, version: 'health-1', readOnly: true };
};
