const cloud = require('wx-server-sdk');
const { createApi } = require('./service');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const api = createApi({ db: cloud.database(), getIdentity: () => {
  const caller = cloud.getWXContext();
  return { ...caller, ENV: caller.ENV || process.env.TCB_ENV || process.env.SCF_NAMESPACE };
} });
exports.main = event => api(event);
