const assert = require('node:assert/strict');
const { createApi } = require('../cloudfunctions/pigApi/service');
const catalog = require('../cloudfunctions/pigApi/catalog.json');
const docs = new Map();
let fail = false;
const db = { collection(name) {
  assert.equal(name, 'fridges');
  return {
    where(query) { return {
      limit() { return this; },
      async get() { if (fail) throw Error('private SDK error'); return { data: docs.has(query._id) ? [structuredClone(docs.get(query._id))] : [] }; },
      async update({ data }) { const old = docs.get(query._id); if (!old || old.revision !== query.revision) return { stats: { updated: 0 } }; docs.set(query._id, { ...old, ...structuredClone(data) }); return { stats: { updated: 1 } }; }
    }; },
    async add({ data }) { if (docs.has(data._id)) throw Error('duplicate'); docs.set(data._id, structuredClone(data)); }
  };
} };
const identity = { APPID: 'wx0cb3da57b3344189', ENV: 'cloud1-d0g0ntbbyaddfb364', OPENID: 'user-a' };
const api = createApi({ db, getIdentity: () => identity });
const request = { action: 'fridge.set', foodIds: [catalog.foodIds[0]], expectedRevision: 0, operationId: 'operation_0000001' };
(async () => {
  assert.deepEqual((await api({ action: 'bootstrap', __platformMeta: true })).fridge, { foodIds: [], revision: 0 });
  for (const patch of [{ foodIds: ['unknown'] }, { foodIds: [catalog.foodIds[0], catalog.foodIds[0]] }, { expectedRevision: NaN }, { expectedRevision: -1 }, { operationId: 'short' }, { OPENID: 'user-b' }, { collection: 'shares' }]) {
    assert.equal((await api({ ...request, ...patch })).code, 'INVALID_REQUEST');
  }
  const results = await Promise.all([api(request), api(request)]);
  assert(results.every(result => result.ok));
  assert.equal(docs.size, 1);
  assert.equal((await api(request)).duplicate, true);
  assert.equal((await api({ ...request, foodIds: [] })).code, 'OPERATION_REUSED');
  assert.equal((await api({ ...request, operationId: 'operation_0000002' })).code, 'CONFLICT');
  const concurrent = await Promise.all([2, 3].map(i => api({ ...request, expectedRevision: 1, operationId: 'operation_000000' + i })));
  assert.equal(concurrent.filter(result => result.ok).length, 1);
  assert.equal(concurrent.filter(result => result.code === 'CONFLICT').length, 1);
  identity.OPENID = 'user-b';
  assert.equal((await api({ action: 'bootstrap' })).fridge.revision, 0);
  assert((await api(request)).ok);
  assert.equal(docs.size, 2);
  identity.APPID = 'forged';
  assert.equal((await api(request)).code, 'UNAUTHORIZED');
  identity.APPID = 'wx0cb3da57b3344189'; identity.ENV = 'other';
  assert.equal((await api(request)).code, 'ENV_MISMATCH');
  identity.ENV = 'cloud1-d0g0ntbbyaddfb364'; fail = true;
  assert.deepEqual(await api({ action: 'bootstrap' }), { ok: false, code: 'SERVICE_UNAVAILABLE' });
  console.log('PASS pigApi: schema, catalog, idempotency, CAS concurrency, identity isolation, safe failures (mock database)');
})().catch(error => { console.error(error); process.exitCode = 1; });
