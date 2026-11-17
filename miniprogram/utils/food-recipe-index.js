const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g,'').trim();
function create(data, grouping) {
  const exactNames = new Map(), aliases = new Map(), byFood = new Map(), byRecipe = new Map();
  for (const food of data.foods) {
    exactNames.set(normalize(food.name),grouping.canonical(food.id));
    for (const name of [food.name,...(food.aliases||[])]) {
      const key=normalize(name);
      if (!key) continue;
      if (!aliases.has(key)) aliases.set(key,new Set());
      aliases.get(key).add(grouping.canonical(food.id));
    }
  }
  for (const food of grouping.catalog) {
    exactNames.set(normalize(food.name),food.id);
    byFood.set(food.id,new Set());
  }
  for (const recipe of data.recipes) {
    const ids=[...new Set(recipe.ingredientIds.map(grouping.canonical))];
    byRecipe.set(recipe.recipe_id,ids);
    for (const id of ids) if(byFood.has(id)) byFood.get(id).add(recipe.recipe_id);
  }
  const findFoods = query => {
    const key=normalize(query);
    if (!key) return grouping.catalog;
    const exact=exactNames.get(key);
    const ids=exact?new Set([exact]):aliases.get(key);
    return grouping.catalog.filter(food=>ids?ids.has(food.id):[food.name,...food.aliases].some(name=>normalize(name).includes(key)));
  };
  const recipesFor = query => {
    const id=grouping.canonical(query);
    const foods=byFood.has(id)?[{id}]:findFoods(query);
    return new Set(foods.flatMap(food=>Array.from(byFood.get(food.id)||[])));
  };
  const searchRecipes = query => {
    const tokens=String(query || '').trim().split(/[\s、，,＋+]+/).filter(Boolean);
    const term=tokens.length===1?tokens[0]:query;
    const key=normalize(term);
    if (!key) return new Set(data.recipes.map(recipe=>recipe.recipe_id));
    if (tokens.length>1) {
      const results=tokens.map(searchRecipes);
      return new Set([...results[0]].filter(id=>results.every(result=>result.has(id))));
    }
    const ids=recipesFor(term);
    for (const recipe of data.recipes) if(normalize(recipe.name).includes(key)) ids.add(recipe.recipe_id);
    return ids;
  };
  return {byFood,byRecipe,findFoods,recipesFor,searchRecipes,normalize};
}
module.exports={create,normalize};
