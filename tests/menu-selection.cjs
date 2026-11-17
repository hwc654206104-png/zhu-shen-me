const assert = require('node:assert/strict');
const store = require('../miniprogram/utils/store');

const foodId = name => {
  const food = store.data.foods.find(item => item.name === name);
  assert(food, `Missing food in catalog: ${name}`);
  return food.id;
};
const recipeFor = id => store.data.recipes.find(recipe => recipe.recipe_id === id);
const duck = foodId('鸭肉');
const duckRecipes = store.data.recipes.filter(recipe => recipe.ingredientIds.includes(duck));
assert(duckRecipes.length >= 16, 'Duck must retain its existing recipe coverage after expansion');

const duckPantry=[duck,...['小葱','大葱','姜','蒜','豆豉','陈皮','冰糖','小米椒','薄荷'].map(foodId)];
const duckMenu = store.select({}, 1, duckPantry, [], () => 0);
assert.equal(duckMenu.length, 1);
assert(recipeFor(duckMenu[0]).ingredientIds.includes(duck), 'A stocked duck should lead to a duck dish');

const pantry = ['西兰花', '牛肉', '生菜','蒜','姜','小葱'].map(foodId);
const twoDishMenu = store.select({}, 2, pantry, [], () => 0);
assert.equal(twoDishMenu.length, 2);
const chosen = twoDishMenu.map(recipeFor);
assert(chosen.some(recipe => recipe.ingredientIds.includes(foodId('西兰花'))));
assert(chosen.some(recipe => recipe.ingredientIds.includes(foodId('生菜'))));
assert(chosen.some(recipe => recipe.name === '西兰花炒牛肉'), 'The curated mainstream combination should now be available');

const recentKey = twoDishMenu.slice().sort().join('|');
const refreshed = store.select({}, 2, pantry, [recentKey], () => 0, twoDishMenu);
assert.equal(refreshed.length, 2);
assert.notEqual(refreshed.slice().sort().join('|'), recentKey, 'Prefer a different menu when a valid alternative exists');

const cuisineConstrained = store.select({ cuisine: '家常菜' }, 1, duckPantry, [], () => 0);
assert.equal(cuisineConstrained.length, 1);
assert.equal(recipeFor(cuisineConstrained[0]).cuisine, '家常菜', 'Explicit taste filters stay strict');
// Isolated fixtures demonstrate priorities without depending on the real recipe distribution.
const originalLength = store.data.recipes.length;
const fixture = (id, ingredientIds) => ({ recipe_id: id, cuisine: '__test', ingredientIds });
try {
  store.data.recipes.push(
    fixture('ready-a', ['main', 'veg']),
    fixture('ready-b', ['main', 'veg']),
    fixture('shopping-heavy', ['main', 'veg', 'other', 'missing']),
    fixture('absent-main', ['absent', 'main', 'veg', 'other'])
  );
  const stocked = store.select({ cuisine: '__test' }, 2, ['main', 'veg', 'other'], [], () => 0);
  assert.deepEqual(stocked.slice().sort(), ['ready-a', 'ready-b'], 'Ready dishes win even when shopping would cover more pantry items');
  assert.equal(new Set(stocked).size, 2, 'Same main ingredient is allowed; same recipe is not repeated');
  const refreshedReady = store.select({ cuisine: '__test' }, 2, ['main', 'veg', 'other'], ['ready-a|ready-b'], () => 0, ['ready-a','ready-b']);
  assert.deepEqual(refreshedReady, [], 'Exhausted strict options must stop instead of repeating history or forcing shopping');
  assert.deepEqual(store.select({ cuisine: '__test' }, 2, ['main', 'veg', 'other'], [], () => 0, ['ready-a', 'ready-b']), [], 'Refresh reports no alternative instead of silently repeating or requiring shopping');
  assert.deepEqual(store.select({ cuisine: '__test' }, 0, [], [], () => 0), []);
  assert.deepEqual(store.select({ cuisine: '__test' }, 5, [], [], () => 0), []);
  store.data.recipes.push(fixture('ready-c', ['main', 'veg']), fixture('ready-d', ['main', 'veg']));
  const explicitRefresh = store.select({ cuisine: '__test' }, 2, ['main', 'veg'], [], () => 0, ['ready-a', 'ready-b']);
  assert.equal(explicitRefresh.length, 2);
  assert.notEqual(explicitRefresh.slice().sort().join('|'), 'ready-a|ready-b', 'Refresh excludes the current combination even without recent history');
  const varied = store.select({ cuisine: '__test' }, 2, ['main', 'veg'], ['ready-a|ready-b'], () => 0, ['ready-a','ready-b']);
  assert.deepEqual(varied.slice().sort(), ['ready-c', 'ready-d'], 'Prefer entirely fresh dishes when equally ready');
  store.data.recipes.push({ ...fixture('shortlist-best', ['main', 'one-missing']), cuisine: '__shortlist' });
  for (let i = 0; i < 60; i++) store.data.recipes.push({
    ...fixture('garnish-' + i, ['absent-main', 'main', 'veg', 'other', 'extra-missing']), cuisine: '__shortlist'
  });
  assert.deepEqual(store.select({ cuisine: '__shortlist' }, 1, ['main', 'veg', 'other'], [], () => 0),
    [], 'Missing ingredients must exclude a dish even if its main is stocked');
  assert.doesNotThrow(() => store.select(null, 1, null, null, () => 0), 'Missing optional inputs should not crash');
  const beef = foodId('牛肉'), lettuce = foodId('生菜'), tomato = foodId('番茄'), egg = foodId('鸡蛋');
  const balancedFixture = (id, ids) => ({ ...fixture(id, ids), cuisine: '__balance' });
  store.data.recipes.push(balancedFixture('meat-one', [beef]), balancedFixture('meat-two', [beef]),
    balancedFixture('veg-one', [lettuce, tomato, egg]));
  const balancedFoods = [beef, lettuce, tomato, egg];
  assert.deepEqual(store.select({ cuisine: '__balance' }, 1, balancedFoods, [], () => 0), ['meat-one'],
    'One dish prefers meat despite a meat-free dish matching more ingredients');
  const pair = store.select({ cuisine: '__balance' }, 2, balancedFoods, [], () => 0);
  assert(pair.includes('veg-one') && pair.some(id => id.startsWith('meat-')), 'Two dishes should mix meat and meat-free dishes');
  const refreshedPair = store.select({ cuisine: '__balance' }, 2, balancedFoods, [pair.slice().sort().join('|')], () => 0, pair);
  assert(refreshedPair.includes('veg-one'), 'Refresh must preserve the mixed pairing');
  const meatOnlyPair = store.select({ cuisine: '__balance' }, 2, [beef], [], () => 0);
  assert.deepEqual(meatOnlyPair.slice().sort(),['meat-one','meat-two'],'Do not buy vegetables merely to force a mixed meal');
  const meatOnlyRefresh = store.select({ cuisine: '__balance' }, 2, [beef], [meatOnlyPair.slice().sort().join('|')], () => 0, meatOnlyPair);
  assert(!meatOnlyRefresh.includes('veg-one'), 'Refresh must not introduce absent vegetables');
  assert.deepEqual(store.select({ cuisine: '__balance' }, 1, [lettuce, tomato, egg], [], () => 0), ['veg-one'],
    'Do not require buying meat when a meat-free meal is fully stocked');
  const triple = store.select({ cuisine: '__balance' }, 3, balancedFoods, [], () => 0);
  assert.equal(triple.length, 3);
  assert(triple.includes('meat-one') && triple.includes('meat-two'), 'Reusing stocked meat across dishes remains allowed');
  const garlic = foodId('蒜'), ginger = foodId('姜');
  const combineFixture = (id, ids) => ({ ...fixture(id, ids), cuisine: '__combine' });
  store.data.recipes.push(combineFixture('combined', [beef, tomato, garlic]),
    combineFixture('single-meat', [beef, garlic, ginger]), combineFixture('single-veg', [lettuce, garlic]));
  const comboOwned = [beef, tomato, lettuce, garlic, ginger];
  assert.deepEqual(store.select({ cuisine: '__combine' }, 1, comboOwned, [], () => 0), ['combined'],
    'Beef plus tomato should beat a single beef dish with more aromatics');
  const comboPair = store.select({ cuisine: '__combine' }, 2, comboOwned, [], () => 0);
  assert.deepEqual(comboPair.slice().sort(), ['combined', 'single-veg'], 'Combine available mains and use single vegetables to complete the balanced menu');
  assert.deepEqual(store.select({ cuisine: '__combine' }, 1, [beef, tomato], [], () => 0), ['combined'],
    'Garlic is a household staple and need not be stocked');
  assert.deepEqual(store.select({ cuisine: '__combine' }, 1, [beef, garlic, ginger], [], () => 0), ['single-meat'],
    'Fall back to a single main dish when the second main is missing');
  assert.deepEqual(store.select({ cuisine: '__combine' }, 1, comboOwned, ['combined'], () => 0, ['combined']), ['single-meat'],
    'A previously shown combination must yield to a new fully stocked recipe');
  const grouped = (id, ids, group) => ({ ...fixture(id, ids), cuisine: '__groups', combinationKey: group });
  store.data.recipes.push(grouped('variant-a', [beef, tomato], 'beef-tomato-fry'),
    grouped('variant-b', [beef, tomato], 'beef-tomato-fry'),
    grouped('another-combo', [beef, lettuce], 'beef-lettuce-fry'));
  const distinctGroups = store.select({ cuisine: '__groups' }, 2, [beef, tomato, lettuce], [], () => 0);
  assert(distinctGroups.includes('another-combo'), 'Prefer distinct combinations to differently named variants of the same dish');
  const limitedGroups = store.select({ cuisine: '__groups' }, 3, [beef, tomato, lettuce], [], () => 0);
  assert.equal(limitedGroups.length, 3, 'Grouping must not prevent filling the requested number of dishes');
  for(let i=0;i<8;i++)store.data.recipes.push({
    ...fixture('rotate-'+i,[beef]),cuisine:'__rotate',meal_kind:'meat',familiar:i<2
  });
  let history=[],current=[];
  const rotation=[];
  for(let i=0;i<6;i++){
    const next=store.select({cuisine:'__rotate'},1,[beef],history,()=>0,current);
    assert.equal(next.length,1);
    rotation.push(next[0]);current=next;
    history=[next.join('|'),...history].slice(0,5);
  }
  assert.equal(new Set(rotation).size,6,'Refresh must leave the two familiar dishes when equally stocked alternatives exist');
  store.data.recipes.push(
    {...fixture('one-missing',[beef,lettuce]),cuisine:'__shopping',meal_kind:'meat',familiar:true},
    {...fixture('three-missing',[beef,lettuce,tomato,egg]),cuisine:'__shopping',meal_kind:'meat',familiar:false}
  );
  assert.deepEqual(store.select({cuisine:'__shopping'},1,[beef],['one-missing'],()=>0,['one-missing']),[],
    'Variety must not increase shopping compared with the current menu');
} finally { store.data.recipes.splice(originalLength); }
const tomatoBeef = store.data.recipes.find(recipe => recipe.name === '番茄炒牛肉');
assert(tomatoBeef && tomatoBeef.ingredientIds.includes(foodId('番茄')) && tomatoBeef.ingredientIds.includes(foodId('牛肉')));
const actualPair = store.select({}, 2, ['番茄','牛肉','生菜','蒜'].map(foodId), [], () => 0).map(recipeFor);
assert(actualPair.some(recipe => recipe.name === '番茄炒牛肉'));
assert(actualPair.some(recipe => recipe.ingredientIds.includes(foodId('生菜')) && !recipe.ingredientIds.includes(foodId('牛肉'))),
  'The remaining lettuce should complete the menu as a meat-free dish');
console.log('PASS: pantry coverage, ready meals first, shared main ingredients, safe refresh and strict filters');
// A meat-containing eggplant dish and another eggplant dish are technically mixed,
// but should not crowd out a separate pork dish when both pantry mains can be used.
const porkId=foodId('猪肉'),eggplantId=foodId('茄子');
const porkOwned=[porkId,eggplantId];
let eggplantCurrent=[],eggplantRecent=[];
for(let run=0;run<8;run++){
  const ids=store.select({},2,porkOwned,eggplantRecent,()=>run/10,eggplantCurrent);
  if(!ids.length){assert(run>0);break;}
  const rows=ids.map(recipeFor);
  assert(rows.some(recipe=>recipe.ingredientIds.some(id=>store.foodGroups.canonical(id)===porkId)));
  assert.equal(rows.filter(recipe=>recipe.ingredientIds.includes(eggplantId)).length,1,
    'Pork plus eggplant should not yield two eggplant dishes');
  eggplantCurrent=ids;eggplantRecent=[ids.slice().sort().join('|'),...eggplantRecent].slice(0,5);
}
// Strict stock rules override the old missing-vegetable fallback for a chicken-only pantry.
const chickenOnly=[foodId('鸡胸肉')];
const chickenMenu=store.select({},2,chickenOnly,[],()=>0);
for(const rid of chickenMenu)assert(store.requiredFoods(recipeFor(rid)).every(id=>store.availableFoods(chickenOnly).has(id)));
assert.deepEqual(store.select({},2,[],[],()=>0),[]);
console.log('PASS: strict pantry-only selection, with household scallion ginger garlic, with no forced missing vegetables');
