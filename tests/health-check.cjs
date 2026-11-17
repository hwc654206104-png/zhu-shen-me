const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('cloudfunctions/health/index.js', 'utf8');

async function run(caller) {
  const sandbox = {
    exports: {}, process: { env: {} },
    require(name) {
      assert.equal(name, 'wx-server-sdk');
      return { init() {}, DYNAMIC_CURRENT_ENV: 'dynamic', getWXContext: () => caller };
    }
  };
  vm.runInNewContext(code, sandbox);
  return JSON.parse(JSON.stringify(await sandbox.exports.main({ OPENID: 'spoof' })));
}

(async () => {
  const valid = { APPID: 'wx0cb3da57b3344189', OPENID: 'test-user', ENV: 'cloud1-d0g0ntbbyaddfb364' };
  assert.equal((await run({ ...valid, APPID: 'another-app' })).code, 'UNAUTHORIZED');
  assert.equal((await run({ ...valid, OPENID: '' })).code, 'UNAUTHORIZED');
  assert.equal((await run({ ...valid, ENV: 'another-env' })).code, 'ENV_MISMATCH');
  assert.deepEqual(await run(valid), {
    ok: true, envId: valid.ENV, version: 'health-1', readOnly: true
  });
  console.log('PASS: caller isolation, environment match and response allowlist');
})().catch(error => { console.error(error); process.exitCode = 1; });
