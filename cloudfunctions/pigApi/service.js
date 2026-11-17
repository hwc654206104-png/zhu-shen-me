const crypto = require('crypto');
const catalog = require('./catalog.json');
const APP_ID = 'wx0cb3da57b3344189';
const ENV_ID = 'cloud1-d0g0ntbbyaddfb364';
const foodIds = new Set(catalog.foodIds);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwnProperty.call(value, key));
const fridgeView = doc => ({ foodIds: doc ? doc.foodIds : [], revision: doc ? doc.revision : 0 });

// All queries target a server-derived owner key. No client query/owner/collection is accepted.
function createApi({ db, getIdentity, now = () => Date.now() }) {
  return async event => {
    try {
      const identity = getIdentity();
      if (!identity || identity.APPID !== APP_ID || typeof identity.OPENID !== 'string' || !identity.OPENID) return { ok: false, code: 'UNAUTHORIZED' };
      if (identity.ENV !== ENV_ID) return { ok: false, code: 'ENV_MISMATCH' };
      const userKey = hash(APP_ID + ':' + identity.OPENID);
      const collection = db.collection('fridges');
      const read = async () => (await collection.where({ _id: userKey }).limit(1).get()).data[0];
      // The platform may add invocation metadata to an event; bootstrap is read-only.
      if (plain(event) && event.action === 'bootstrap') {
        return { ok: true, recipeVersion: catalog.recipeVersion, fridge: fridgeView(await read()) };
      }
      if (!exactKeys(event, ['action', 'foodIds', 'expectedRevision', 'operationId']) || event.action !== 'fridge.set' ||
          !Number.isSafeInteger(event.expectedRevision) || event.expectedRevision < 0 || event.expectedRevision >= Number.MAX_SAFE_INTEGER ||
          typeof event.operationId !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(event.operationId) ||
          !Array.isArray(event.foodIds) || event.foodIds.length > foodIds.size ||
          event.foodIds.some(id => typeof id !== 'string' || !foodIds.has(id)) || new Set(event.foodIds).size !== event.foodIds.length) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }
      const selected = [...event.foodIds].sort();
      const payloadHash = hash(JSON.stringify({ foodIds: selected, expectedRevision: event.expectedRevision }));
      const receiptResult = doc => {
        const receipt = doc?.receipts?.find(item => item.operationId === event.operationId);
        if (!receipt) return null;
        return receipt.payloadHash === payloadHash
          ? { ok: true, duplicate: true, appliedRevision: receipt.revision, fridge: fridgeView(doc) }
          : { ok: false, code: 'OPERATION_REUSED' };
      };
      const previous = await read();
      const duplicate = receiptResult(previous);
      if (duplicate) return duplicate;
      if ((previous?.revision || 0) !== event.expectedRevision) return { ok: false, code: 'CONFLICT', fridge: fridgeView(previous) };
      const revision = event.expectedRevision + 1;
      const data = { foodIds: selected, revision, updatedAt: now(), recipeVersion: catalog.recipeVersion,
        receipts: [...(previous?.receipts || []).slice(-19), { operationId: event.operationId, payloadHash, revision }] };
      if (!previous) {
        try {
          await collection.add({ data: { _id: userKey, ...data } });
        } catch (error) {
          // Re-read once to identify a concurrent creator; otherwise retain the storage failure.
          const current = await read();
          if (!current) throw error;
          return receiptResult(current) || { ok: false, code: 'CONFLICT', fridge: fridgeView(current) };
        }
      } else {
        const result = await collection.where({ _id: userKey, revision: event.expectedRevision }).update({ data });
        if (result.stats.updated !== 1) {
          const current = await read();
          return receiptResult(current) || { ok: false, code: 'CONFLICT', fridge: fridgeView(current) };
        }
      }
      return { ok: true, duplicate: false, appliedRevision: revision, fridge: fridgeView(data) };
    } catch (_) {
      // Never return SDK errors, raw event, identity, or environment variables.
      return { ok: false, code: 'SERVICE_UNAVAILABLE' };
    }
  };
}
module.exports = { createApi };
