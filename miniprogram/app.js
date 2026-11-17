const ENV_ID = 'cloud1-d0g0ntbbyaddfb364';

App({
  globalData: {
    envId: ENV_ID,
    cloudInitialized: false,
    cloudVerified: false,
    apiVerified: false
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('Cloud API unavailable in this runtime');
      return;
    }
    try {
      wx.cloud.init({ env: ENV_ID });
      if (typeof wx.onNetworkStatusChange === 'function') {
        wx.onNetworkStatusChange(status => {
          if (status.isConnected) this.onShow();
        });
      }
      this.globalData.cloudInitialized = true;require('./utils/favorites-sync').schedule(require('./utils/store').load());
      this.globalData.cloudCheck = wx.cloud.callFunction({ name: 'health', data: {} })
        .then(({ result }) => {
          const verified = !!result && result.ok === true && result.envId === ENV_ID;
          this.globalData.cloudVerified = verified;
          console.info('PIG_CLOUD_HEALTH', JSON.stringify({
            verified,
            envId: verified ? result.envId : ENV_ID,
            code: verified ? 'OK' : ((result && result.code) || 'INVALID_RESPONSE')
          }));
          if (verified) this.globalData.bootstrapCheck = this.bootstrap();
          return verified;
        })
        .catch(error => {
          this.globalData.cloudVerified = false;
          console.error('PIG_CLOUD_HEALTH_FAILED', error.errCode || 'CALL_FAILED');
          return false;
        });
    } catch (error) {
      console.error('Cloud initialization failed', error.errCode || 'INIT_FAILED');
    }
  },
  onShow() {
    if (this.globalData.cloudInitialized) {
      const favorites=require('./utils/favorites-sync');
      if(typeof favorites.flush==='function')favorites.flush().catch(()=>{});
      require('./utils/fridge-sync').sync().then(() => this.refreshFridgeView()).catch(() => {});
    }
  },
  refreshFridgeView() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const page = pages[pages.length - 1];
    if (page && page.route === 'pages/home/index' && typeof page.onShow === 'function') page.onShow();
    if (page && page.route === 'pages/fridge/index' && !page.data.dirty && typeof page.onShow === 'function') page.onShow();
  },
  bootstrap() {
    return wx.cloud.callFunction({ name: 'pigApi', data: { action: 'bootstrap' } })
      .then(async ({ result }) => {
        const valid = !!result && result.ok === true && typeof result.recipeVersion === 'string' &&
          !!result.fridge && Array.isArray(result.fridge.foodIds) &&
          Number.isSafeInteger(result.fridge.revision) && result.fridge.revision >= 0;
        this.globalData.apiVerified = valid;
        if (valid) {
          this.globalData.bootstrapData = result;
          await require('./utils/fridge-sync').sync();
          this.refreshFridgeView();
        }
        console.info('PIG_API_BOOTSTRAP', JSON.stringify({ verified: valid,
          code: valid ? 'OK' : ((result && result.code) || 'INVALID_RESPONSE') }));
        return valid;
      })
      .catch(error => {
        this.globalData.apiVerified = false;
        console.error('PIG_API_BOOTSTRAP_FAILED', error.errCode || 'CALL_FAILED');
        return false;
      });
  }
});
