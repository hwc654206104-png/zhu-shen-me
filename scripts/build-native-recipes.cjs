// Build only from the approved source. No network or database writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { composition } = require('../miniprogram/utils/recipe-composition');
const { unpack } = require('../miniprogram/recipe-book/data/codec');
const root = path.resolve(__dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const write = (file, value, module = false) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, (module ? 'module.exports=' : '') + JSON.stringify(value) + (module ? ';\n' : '\n'));
  return fs.statSync(target).size;
};
function pack(recipes) {
  const dictionary = [], positions = new Map();
  function encode(value) {
    if (typeof value === 'string') {
      if (!positions.has(value)) { positions.set(value, dictionary.length); dictionary.push(value); }
      return ['$s', positions.get(value)];
    }
    if (Array.isArray(value)) return value.map(encode);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
    return value;
  }
  const records = recipes.map(recipe => {
    const stored = { ...recipe };
    if (JSON.stringify(recipe.steps) === JSON.stringify(recipe.step_details.map(step => step.instruction))) stored.steps = null;
    if (JSON.stringify(recipe.ingredients) === JSON.stringify(recipe.ingredient_items.map(item => item.name + item.quantity + item.unit))) stored.ingredients = null;
    return encode(stored);
  });
  const payload = { format: 1, dictionary, records };
  require('node:assert/strict').deepEqual(unpack(payload), recipes);
  // Standard DEFLATE, decoded offline by vendored MIT pako (no native APIs).
  const compressed={format:3,text:require('node:zlib').deflateSync(Buffer.from(JSON.stringify(payload)),{level:9}).toString('base64')};
  require('node:assert/strict').deepEqual(unpack(compressed),recipes);
  return compressed;
}
function build() {
  const recipes = read('docs/miniapp/recipes/recipes.json');
  const catalog = read('docs/miniapp/recipes/ingredient-catalog.json');
  const policy = read('docs/miniapp/recipes/catalog-policy.json');
  if (recipes.length !== policy.total || recipes.filter(r => r.cuisine === '粤菜').length !== policy.cantonese) throw Error('Invalid recipe quota');
  if (new Set(recipes.map(r => r.recipe_id)).size !== recipes.length || new Set(recipes.map(r => r.name)).size !== recipes.length) throw Error('Duplicate recipe');
  if (new Set(catalog.map(i => i.id)).size !== catalog.length || new Set(catalog.map(i => i.name)).size !== catalog.length) throw Error('Duplicate ingredient');
  const foodByName = new Map(catalog.map(i => [i.name, i.id]));
  const usedFoods = new Set();
  for (const recipe of recipes) {
    if (!Number.isInteger(recipe.servings) || recipe.servings < 1 || !recipe.step_details?.length || recipe.step_details.length !== recipe.steps.length) throw Error('Invalid tutorial: ' + recipe.recipe_id);
    for (const item of recipe.ingredient_items) {
      const original = (recipe.source_type === 'howtocook_original' || recipe.original_amounts === true) && item.quantity === null && typeof item.source_amount === 'string';
      if (!foodByName.has(item.name) || (!original && (!Number.isFinite(item.quantity) || item.quantity <= 0 || !item.unit))) throw Error('Invalid ingredient: ' + recipe.recipe_id);
      usedFoods.add(foodByName.get(item.name));
    }
  }
  const unusedFoods = catalog.filter(i => !usedFoods.has(i.id));
  if (unusedFoods.length) throw Error('Ingredients without recipes: ' + unusedFoods.map(i => i.name).join(', '));
  const foods = catalog.filter(i => usedFoods.has(i.id));
  const sourceSha256 = digest({ recipes, catalog: foods });
  const recipeVersion = 'r1-' + sourceSha256.slice(0, 16);
  const chunkSize = 120;
  const chunks = [];
  const importDocuments = [];
  const index = recipes.map((r, position) => ({
    recipe_id: r.recipe_id, name: r.name, cuisine: r.cuisine,
    spicy_level: r.spicy_level, salt_level: r.salt_level, flavor_tags:r.flavor_tags, dish_category:r.dish_category, cooking_method:r.cooking_method,
    servings: r.servings, prep_minutes: r.prep_minutes, cook_minutes: r.cook_minutes,
    menu_eligible: r.menu_eligible !== false, familiar:r.familiar===true, meal_kind:r.meal_kind, source_category:r.source_category || '菜肴', source_type:r.source_type,
    ingredientIds: r.ingredient_items.map(i => foodByName.get(i.name)),
    ...(r.ingredient_items.some(i=>i.optional===true)?{optionalIngredientIds:r.ingredient_items.filter(i=>i.optional===true).map(i=>foodByName.get(i.name))}:{}),
    coreIngredientIds: composition(r).core.map(name => foodByName.get(name)),
    combinationKey: composition(r).combinationKey,
    chunk: Math.floor(position / chunkSize)
  }));
  for (let offset = 0; offset < recipes.length; offset += chunkSize) {
    const number = offset / chunkSize;
    const items = recipes.slice(offset, offset + chunkSize);
    const file = `miniprogram/recipe-book/data/chunk-${number}.js`;
    const bytes = write(file, pack(items), true);
    chunks.push({ number, file, count: items.length, sha256: digest(items), bytes });
    // Bounded documents (<1 MB) for a later explicitly verified admin import.
    const document = {
      _id: `${recipeVersion}-${number}`, recipeVersion, chunk: number,
      sha256: digest(items), recipes: items
    };
    write(`build/recipe-import/${recipeVersion}-${number}.json`, document);
    importDocuments.push(document);
  }
  for(const file of fs.readdirSync(path.join(root,'miniprogram/recipe-book/data'))){
    const match=file.match(/^chunk-(\d+)\.js$/);
    if(match && Number(match[1])>=chunks.length)fs.unlinkSync(path.join(root,'miniprogram/recipe-book/data',file));
  }
  const counts = field => recipes.reduce((out, r) => { out[r[field]] = (out[r[field]] || 0) + 1; return out; }, {});
  fs.writeFileSync(path.join(root, 'miniprogram/recipe-book/data/tutorials.js'),
    "const { unpack } = require('./codec');\nconst chunks = [" + chunks.map(chunk => `require('./chunk-${chunk.number}')`).join(',') +
    "];\nconst tutorials = {};\nchunks.forEach(chunk => unpack(chunk).forEach(recipe => { tutorials[recipe.recipe_id] = recipe; }));\nmodule.exports = { tutorials };\n");
  const metadata = { recipeVersion, sourceSha256, total: recipes.length,
    byCuisine: counts('cuisine'), bySpicyLevel: counts('spicy_level'), bySaltLevel: counts('salt_level'),
    tutorialRoot: 'recipe-book', chunks };
  const groups = new Map();
  for (const recipe of recipes) {
    const key = composition(recipe).combinationKey;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: recipe.recipe_id, name: recipe.name });
  }
  const combinedCount = recipes.filter(recipe => composition(recipe).isCombination).length;
  // Full upstream includes single ingredients, drinks and staple recipes too.
  if (!recipes.some(r=>r.source_type==='howtocook_original') && combinedCount / recipes.length < 0.8) throw Error('At least 80% of recipes must combine substantive ingredients');
  write('docs/miniapp/recipes/combination-audit.json', {
    total: recipes.length, combinedCount, ratio: combinedCount / recipes.length,
    definition: 'At least two distinct non-aromatic ingredients; not a cooking verification',
    uniqueGroups: groups.size,
    groups: Array.from(groups, ([key, recipes]) => ({ key, recipes }))
  });
  const mainDataBytes = write('miniprogram/data/recipe-index.js', { metadata, recipes: index, foods }, true);
  const ingredientIndex = require('../miniprogram/data/ingredient-index.js');
  const seasoningIndex = require('../miniprogram/data/seasoning-index.js');
  for (const recipe of recipes) {
    ingredientIndex[recipe.recipe_id] = recipe.ingredient_items.map(item => item.name);
    seasoningIndex[recipe.recipe_id] = [...new Set(recipe.seasonings.map(item => item.replace(/\d+(?:\.\d+)?(?:\s*[-~至]\s*\d+(?:\.\d+)?)?\s*(?:毫升|克|个|ml|g|ML|G|小勺|大勺|茶匙|汤匙|勺)/g, '').replace(/适量|少许/g, '').replace(/^[-•*]\s*/, '').trim()).filter(Boolean))];
  }
  write('miniprogram/data/ingredient-index.js', ingredientIndex, true);
  write('miniprogram/data/seasoning-index.js', seasoningIndex, true);
  write('cloudfunctions/pigApi/catalog.json', { recipeVersion, foodIds: foods.map(food => food.id) });
  // Friend sharing validates IDs too; keep its allowlist in step with the local catalog.
  write('cloudfunctions/pigFriends/recipe-ids.json', recipes.map(recipe => recipe.recipe_id));
  const tutorialBytes = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
  if (tutorialBytes > 1900 * 1024) throw Error('Tutorial data exceeds reserved subpackage budget');
  const manifest = {
    _id: recipeVersion, ...metadata, foods, index,
    status: 'prepared', // Not activated until remote hashes and permissions are verified.
    evidence: 'draft_structured; not cooking-tested'
  };
  write(`build/recipe-import/${recipeVersion}-manifest.json`, manifest);
  // Single insert confirmation; deterministic IDs prevent accidental duplicates.
  write(`build/recipe-import/${recipeVersion}-documents.json`, [...importDocuments, manifest]);
  // Console JSON import uses one document per line, not a JSON array.
  fs.writeFileSync(path.join(root, `build/recipe-import/${recipeVersion}-console.json`),
    [...importDocuments, manifest].map(document => JSON.stringify(document)).join('\n') + '\n');
  write('docs/miniapp/native-recipe-build.json', { ...metadata, mainDataBytes, tutorialDataBytes: tutorialBytes,
    cloudVerification: recipes.some(r=>r.source_type==='howtocook_original') ? 'howtocook-cloud-verification.json' : 'cloud-recipe-verification.json', actualPackageSize: 'not_verified',
    note: 'Data only. Register recipe-book as a subpackage with its tutorial page before shipping.' });
  return { recipeVersion, total: recipes.length, cantonese: metadata.byCuisine['粤菜'], foods: foods.length, mainDataBytes, tutorialBytes };
}
if (require.main === module) console.log(JSON.stringify(build()));
module.exports = { build };
