// Shared definition for recipe-library audits and runtime pantry matching.
const aromaticNames = ['小葱','大葱','姜','蒜','豆豉','陈皮','冰糖','干辣椒','小米椒','薄荷'];
function composition(recipe) {
  const core = [...new Set(recipe.ingredient_items.filter(item=>item.optional!==true).map(item => item.name)
    .filter(name => !aromaticNames.includes(name)))].sort();
  const name = recipe.name || '';
  const method = /汤|粥|糖水|豆沙/.test(name) ? '汤粥' : /蒸|蒸盘/.test(name) ? '蒸' :
    /炖|焖|煲/.test(name) ? '炖焖' : /拌|老醋/.test(name) ? '凉拌' : /炒|小炒|滑鸡|滑蛋|木须肉|家常豆腐/.test(name) ? '炒' :
    /煎|炸/.test(name) ? '煎炸' : name;
  return { core, combinationKey: JSON.stringify([method, core]), isCombination: core.length >= 2 };
}
module.exports = { aromaticNames, composition };
