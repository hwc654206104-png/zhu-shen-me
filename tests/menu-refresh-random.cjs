const assert=require('assert'), S=require('../miniprogram/utils/store');
const food=S.data.foods.find(x=>x.name==='猪肉').id, n=S.data.recipes.length;
const rng=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
const key=ids=>ids.slice().sort().join('|');
try{
 for(let i=0;i<12;i++)S.data.recipes.push({recipe_id:'random-test-'+i,name:'随机菜'+i,cuisine:'__random',ingredientIds:[food],meal_kind:'meat'});
 const outputs=new Set();
 for(let seed=1;seed<=20;seed++){
  const a=['random-test-0','random-test-1'];const history=[key(a),'random-test-2|random-test-3'];
  const out=S.select({cuisine:'__random',strictPantry:true},2,[food],history,rng(seed),a);
  assert.equal(out.length,2);assert(!history.includes(key(out)));outputs.add(key(out));
 }
 assert(outputs.size>1,'Distinct random sequences should vary the resulting menu');
}finally{S.data.recipes.splice(n);}
console.log('PASS: refresh varies with random input and never repeats unordered menu history');
