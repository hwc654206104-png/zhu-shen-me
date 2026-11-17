// Lossless, JSON-only recipe storage; no eval, binary runtime or network dependency.
function unpack(payload) {
  if(payload && payload.format===3) {
    const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', bytes=[];
    let bits=0,value=0;
    if(typeof payload.text!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(payload.text))throw Error('INVALID_RECIPE_DATA');
    for(const ch of payload.text){const n=alphabet.indexOf(ch);if(n<0)continue;value=(value<<6)|n;bits+=6;if(bits>=8){bits-=8;bytes.push((value>>bits)&255);}}
    return unpack(JSON.parse(require('./inflate').inflate(new Uint8Array(bytes),{to:'string'})));
  }
  if(payload && payload.format===2) return unpack(JSON.parse(require('./text-codec').decompress(payload.text)));
  if (Array.isArray(payload)) return payload; // Existing development snapshots remain readable.
  if (!payload || payload.format !== 1 || !Array.isArray(payload.dictionary) || !Array.isArray(payload.records)) throw Error('INVALID_RECIPE_DATA');
  function decode(value) {
    if (Array.isArray(value)) {
      if (value.length === 2 && value[0] === '$s' && Number.isInteger(value[1])) {
        if (typeof payload.dictionary[value[1]] !== 'string') throw Error('INVALID_RECIPE_STRING');
        return payload.dictionary[value[1]];
      }
      return value.map(decode);
    }
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) out[key] = decode(value[key]);
      return out;
    }
    return value;
  }
  return payload.records.map(record => {
    const recipe = decode(record);
    if (!recipe.steps) recipe.steps = recipe.step_details.map(step => step.instruction);
    if (!recipe.ingredients) recipe.ingredients = recipe.ingredient_items.map(item => item.name + item.quantity + item.unit);
    return recipe;
  });
}
module.exports = { unpack };
