function createDB(){
 const tables={};let queue=Promise.resolve();
 const db={collection(name){const table=tables[name]||(tables[name]=new Map());return {
  doc(id){return {async get(){return {data:table.has(id)?[structuredClone(table.get(id))]:[]};},async set({data}){table.set(id,{...structuredClone(data),_id:id});}};},
  where(q){let offset=0,count=100;const matches=d=>Object.keys(q).every(k=>d[k]===q[k]);return {skip(n){offset=n;return this;},limit(n){count=n;return this;},async get(){return {data:[...table.values()].filter(matches).slice(offset,offset+count).map(d=>structuredClone(d))};},async update({data}){for(const d of table.values())if(matches(d))Object.assign(d,structuredClone(data));},async remove(){for(const [id,d] of table)if(matches(d))table.delete(id);}};},
  async add({data}){if(table.has(data._id))throw Error('duplicate');table.set(data._id,structuredClone(data));}
 };},runTransaction(fn){const run=queue.then(async()=>{const snapshot=structuredClone(tables);try{return await fn(db);}catch(err){for(const key of Object.keys(tables)){tables[key].clear();for(const [id,d] of snapshot[key]||[])tables[key].set(id,d);}throw err;}});queue=run.catch(()=>{});return run;}};
 return {db,tables};
}
module.exports={createDB};
