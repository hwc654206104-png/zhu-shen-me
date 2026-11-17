const data = require('../data/recipe-index');
const byId = new Map(data.recipes.map(r => [r.recipe_id, r]));
const foodGroups = require('./food-groups').create(data.foods);
const foodIndex = require('./food-recipe-index').create(data,foodGroups);
// Only everyday scallion, ginger and garlic are assumed stocked; not all aromatics.
const stapleNames = new Set(['小葱','大葱','姜','蒜']);
const stapleIds = data.foods.filter(food=>stapleNames.has(food.name)).map(food=>food.id);
function availableFoods(foods) { return foodGroups.expand([...(Array.isArray(foods)?foods:[]),...stapleIds]); }
function requiredFoods(recipe) {
  const optional=new Set(recipe.optionalIngredientIds||[]);
  return recipe.ingredientIds.filter(id=>!optional.has(id));
}
// Eggs and tofu count as meat-free dishes; desserts and plain starches are neutral.
const meatNames = new Set(['猪肉','鲈鱼','排骨','虾仁','牛肉','咸鱼','鸡腿肉','牛腩','猪里脊','鸭肉','鸡胸肉','鲈鱼片','带鱼','鱿鱼','猪梅肉','虾米','鸡翅','腊肠','青蟹','鳝丝','小龙虾','黑鳕鱼','巴沙鱼','草鱼','生蚝','鲤鱼','五花肉','罗氏虾','桂鱼','海参','蛏子','螃蟹','鳊鱼','火腿','培根','鸡肉','兔肉','牛腱子','鸡爪','羊腩','猪皮','牛排','猪蹄','肥牛','鸭血','鲮鱼','白鱔','乳鸽','血肠','午餐肉','火腿肠','鱼头','鲜鱼','羊排','牛蛙','猪肝','虾滑馅','鱼肉馅','鸡肝','猪肘','羊肉','虾','三文鱼','虾皮','梭子蟹','大闸蟹','田螺','鱼丸']);
const vegNames = new Set(['鸡蛋','皮蛋','豆腐','番茄','青椒','土豆','西兰花','紫菜','菜心','冬瓜','豆芽','韭黄','生菜','茄子','玉米','娃娃菜','芥兰','莲藕','南瓜','竹笋','鲜香菇','黄瓜','木耳','胡萝卜','洋葱','芹菜','香干','杏鲍菇','金针菇','白菜','菠菜','山药','白萝卜','丝瓜','海带','西葫芦','蘑菇','豌豆','油豆腐','韭菜','荷兰豆','花菜','腐竹','芋头','莴笋','菠萝','包菜','四季豆','红薯','茭白','叶菜','空心菜','白玉菇','蟹味菇','苦瓜','毛豆','油麦菜','豇豆','日本豆腐','茶树菇','甜椒','尖椒','线椒','螺丝椒','美人椒','红椒','酸笋','马蹄','南瓜花','瓠瓜']);
const meatIds = new Set(data.foods.filter(f => meatNames.has(f.name)).map(f => f.id));
const vegIds = new Set(data.foods.filter(f => vegNames.has(f.name)).map(f => f.id));
const aromaticNames = new Set(require('./recipe-composition').aromaticNames);
const aromaticIds = new Set(data.foods.filter(f => aromaticNames.has(f.name)).map(f => f.id));
function dishKind(recipe) {
  if(['meat','veg','neutral'].includes(recipe.meal_kind))return recipe.meal_kind;
  if (recipe.ingredientIds.some(id => meatIds.has(id))) return 'meat';
  if (!/糖水|豆沙|甜品/.test(recipe.name || '') && recipe.ingredientIds.some(id => vegIds.has(id))) return 'veg';
  return 'neutral';
}
const key = 'pig_native_v2';
const menuKey = ids => [...new Set(ids)].sort().join('|');
const recentKeys = value => Array.isArray(value) ? [...new Set(value.filter(item=>typeof item==='string'&&item).map(item=>menuKey(item.split('|'))))] : [];
function load() {
  const raw = wx.getStorageSync(key);
  if (raw && raw.schema === 2 && Array.isArray(raw.meals)) {
    const strings=value=>Array.isArray(value)?[...new Set(value.filter(x=>typeof x==='string'&&x))]:[];
    const history=recentKeys([...(Array.isArray(raw.recent)?raw.recent:[]),
      ...raw.meals.filter(m=>m&&Array.isArray(m.ids)).map(m=>menuKey(strings(m.ids).filter(id=>byId.has(id))))]);
    return {...raw,foods:strings(raw.foods),recent:history,
      profile:{...(raw.profile&&typeof raw.profile==='object'&&!Array.isArray(raw.profile)?raw.profile:{}),name:typeof raw.profile?.name==='string'&&raw.profile.name.trim()?raw.profile.name:'今天也好好吃饭',avatar:typeof raw.profile?.avatar==='string'&&raw.profile.avatar?raw.profile.avatar:'/assets/pig-chef-avatar.png'},
      meals:raw.meals.filter(m=>m&&typeof m==='object'&&typeof m.id==='string').map(m=>{
        const ids=strings(m.ids);
        return {...m,ids,done:strings(m.done).filter(id=>ids.includes(id)),people:Number.isInteger(m.people)&&m.people>=1&&m.people<=10?m.people:2};
      })};
  }
  const old = wx.getStorageSync('pig_foods');
  return { schema: 2, foods: Array.isArray(old) ? data.foods.filter(f => old.includes(f.name) || old.includes(f.id)).map(f => f.id) : [], meals: [], recent: [], profile: {name:'今天也好好吃饭',avatar:'/assets/pig-chef-avatar.png'} };
}
function save(state) { wx.setStorageSync(key, state); require('./favorites-sync').schedule(state); return state; }
function change(fn) { const state = load(); fn(state); return save(state); }
function meal(id) {
  const m=load().meals.find(m=>m.id===id);if(!m)return;
  const ids=m.ids.filter(id=>byId.has(id));
  return {...m,ids,done:(m.done||[]).filter(id=>ids.includes(id)),viewId:ids.includes(m.viewId)?m.viewId:ids[0]};
}
function create(ids, people, preferences = {}) {
  if (!Number.isInteger(people) || people < 1 || people > 10 || !ids.length || ids.length > 10 || ids.some(id => !byId.has(id)) || new Set(ids).size !== ids.length) throw Error('INVALID_MENU');
  const item = {id:'meal_'+Date.now()+'_'+Math.random().toString(36).slice(2,10),ids,people,preferences,done:[],favorite:false,started:false,viewId:ids[0],title:'今日菜单',note:'',createdAt:Date.now()};
  change(s => {s.meals.unshift(item);s.recent = [...new Set([menuKey(ids),...recentKeys(s.recent)])];}); return item;
}
function update(id, fn) { return change(s => {const m=s.meals.find(x=>x.id===id);if(!m)throw Error('MENU_NOT_FOUND');fn(m);}); }
function select(preferences, count, foods, recent, random = Math.random, excludeMenu = [], lockedIds = []) {
  preferences = preferences || {};
  foods = Array.isArray(foods) ? foods : [];
  recent = recentKeys(recent);
  const recentlyUsed = new Set(recent.flatMap(item => item.split('|')));
  const refreshing = excludeMenu.length > 0;
  if (refreshing) excludeMenu.forEach(id => recentlyUsed.add(id));
  // Historical menus are a preference for a new request, never a lifetime exclusion.
  // Only an explicit refresh must introduce an unseen recipe within its request chain.
  const seekFresh = refreshing && recentlyUsed.size > 0;
  const excludedKey = menuKey(excludeMenu);
  const menuHistory = new Set(refreshing ? recent : []);
  if(excludedKey)menuHistory.add(excludedKey);
  const owned = availableFoods(foods);
  const stocked = foodGroups.expand(foods);
  const strictPantry = preferences.strictPantry !== false;
  const explore = seekFresh && !strictPantry;
  lockedIds = Array.isArray(lockedIds) ? [...new Set(lockedIds.filter(id=>excludeMenu.includes(id) && byId.has(id)))] : [];
  const pool = data.recipes.filter(r => lockedIds.includes(r.recipe_id) || (r.menu_eligible !== false &&
    (strictPantry ? requiredFoods(r).every(id=>owned.has(id)) :
      requiredFoods(r).some(id=>stocked.has(id)&&!aromaticIds.has(id))) &&
    (!preferences.cuisine || r.cuisine === preferences.cuisine) && (!preferences.spicy || r.spicy_level === preferences.spicy) && (!preferences.salt || r.salt_level === preferences.salt)));
  if (!Number.isInteger(count) || count<1 || count>10 || pool.length<count) return [];
  if(seekFresh && !pool.some(recipe=>!recentlyUsed.has(recipe.recipe_id)))return [];
  const candidates = pool.map(recipe => {
    const ingredients=requiredFoods(recipe);
    const matched = [...new Set(ingredients.filter(id => owned.has(id)).map(foodGroups.canonical))];
    const missingIds = [...new Set(ingredients.filter(id => !owned.has(id)).map(foodGroups.canonical))];
    const core = ingredients.filter(id => !aromaticIds.has(id));
    const coreMissing = new Set(core.filter(id => !owned.has(id)).map(foodGroups.canonical)).size;
    // A combination requires all substantive ingredients in stock; garlic is not a second main.
    const combination = new Set(core.map(foodGroups.canonical)).size >= 2 && coreMissing === 0;
    const coreIds=[...new Set(core.map(foodGroups.canonical))];
    return { recipe, matched, missingIds, coreIds, coreMissingIds:core.filter(id=>!owned.has(id)).map(foodGroups.canonical), missing: missingIds.length,
      coreMissing, combination, group: recipe.combinationKey || recipe.recipe_id,
      main: ingredients[0], kind: dishKind(recipe), noise: random() * 0.01 };
  });
  // In loose mode, sometimes explore a dish needing one extra food while keeping a stocked main.
  const preferOneExtra = !strictPantry && random() < 0.5 && candidates.some(c => c.missing === 1 && owned.has(c.main));
  // Strict refresh keeps its readiness bounds; loose refresh explores new recipes.
  const previous = excludeMenu.map(id=>candidates.find(candidate=>candidate.recipe.recipe_id===id));
  const shoppingLimit = refreshing && !explore && previous.every(Boolean) ? new Set(previous.flatMap(candidate=>candidate.missingIds)).size : Infinity;
  const coreLimit = refreshing && !explore && previous.every(Boolean) ? new Set(previous.flatMap(candidate=>candidate.coreMissingIds)).size : Infinity;
  const ranked = candidates.slice().sort((a, b) =>
    (seekFresh ? Number(recentlyUsed.has(a.recipe.recipe_id))-Number(recentlyUsed.has(b.recipe.recipe_id)) : 0) ||
    (preferOneExtra ? Number(!(a.missing === 1 && owned.has(a.main))) - Number(!(b.missing === 1 && owned.has(b.main))) : 0) ||
    (!strictPantry ? Number(a.missing>0)-Number(b.missing>0) || a.missing-b.missing : 0) ||
    Number(a.coreMissing > 0) - Number(b.coreMissing > 0) ||
    Number(!owned.has(a.main)) - Number(!owned.has(b.main)) ||
    (refreshing ? Number(recentlyUsed.has(a.recipe.recipe_id)) - Number(recentlyUsed.has(b.recipe.recipe_id)) : 0) ||
    Number(b.recipe.familiar===true) - Number(a.recipe.familiar===true) ||
    Number(b.combination) - Number(a.combination) ||
    b.matched.length - a.matched.length || a.missing - b.missing ||
    Number(recentlyUsed.has(a.recipe.recipe_id)) - Number(recentlyUsed.has(b.recipe.recipe_id)) ||
    b.noise - a.noise);
  const shortlist = new Map(ranked.slice(0, Math.max(48, count * 8)).map(candidate => [candidate.recipe.recipe_id, candidate]));
  // Keep a representative for every stocked ingredient, including rare foods.
  for (const id of owned) {
    const candidate = ranked.find(item => item.matched.includes(foodGroups.canonical(id)));
    if (candidate) shortlist.set(candidate.recipe.recipe_id, candidate);
  }
  // Keep enough fully stocked options even when garnish-heavy recipes score higher.
  ranked.filter(item => !item.missing).slice(0, Math.max(48, count * 8))
    .forEach(item => shortlist.set(item.recipe.recipe_id, item));
  // Do not let a large set of one category crowd the complementary category out.
  for (const kind of ['meat', 'veg']) ranked.filter(item => item.kind === kind).slice(0, Math.max(16, count * 2))
    .forEach(item => shortlist.set(item.recipe.recipe_id, item));
  candidates.filter(candidate=>lockedIds.includes(candidate.recipe.recipe_id))
    .forEach(candidate=>shortlist.set(candidate.recipe.recipe_id,candidate));
  const menuCandidates = Array.from(shortlist.values());
  const balancePenalty = state => count === 1 ? Number(!state.meat) :
    Number(!state.meat) + Number(!state.veg);
  const compare = (a, b) => {
    // Loose mode alternates between ready meals and dishes needing one extra food.
    // Explicit refresh still favors new recipes; strict mode never requires shopping.
    const criteria = state => [...(seekFresh ? [Number(state.repeats===state.chosen.length)] : []),
      ...(preferOneExtra ? [Number(state.shopping.size !== 1 || state.missingMains > 0), Math.abs(state.shopping.size - 1)] : []),
      ...(!strictPantry ? [Number(state.missing>0),state.shopping.size,state.missing] : []),
      ...(count > 1 ? [balancePenalty(state)] : []),
      state.incomplete, state.missingMains, ...(count === 1 ? [balancePenalty(state)] : []),
      ...(explore ? [state.repeats] : []),
      state.coreRepeats,
      ...(refreshing ? [state.repeats, -state.noise, -state.combinations] : []), -state.familiar, -state.combinations,
      state.chosen.length - state.groups.size, -state.covered.size,
      state.shopping.size, state.missing, state.repeats, -state.noise];
    const left = criteria(a), right = criteria(b);
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] - right[i];
    return 0;
  };
  let beam = [{ chosen: [], covered: new Set(), shopping: new Set(), groups: new Set(),
    coreShopping:new Set(),usedCore:new Set(),coreRepeats:0,incomplete: 0, missingMains: 0, missing: 0, repeats: 0, meat: 0, veg: 0, combinations: 0, familiar:0, noise: 0 }];
  const beamWidth = 32;
  for (let depth = 0; depth < count; depth++) {
    const next = [];
    for (const state of beam) {
      for (const candidate of menuCandidates) {
        if (state.chosen.includes(candidate.recipe.recipe_id)) continue;
        if (depth < lockedIds.length && candidate.recipe.recipe_id !== lockedIds[depth]) continue;
        if (depth >= lockedIds.length && lockedIds.includes(candidate.recipe.recipe_id)) continue;
        const covered = new Set(state.covered);
        candidate.matched.forEach(id => covered.add(id));
        const shopping = new Set(state.shopping);
        const groups = new Set(state.groups);
        groups.add(candidate.group);
        candidate.missingIds.forEach(id => shopping.add(id));
        const coreShopping=new Set(state.coreShopping);
        candidate.coreMissingIds.forEach(id=>coreShopping.add(id));
        if(shopping.size>shoppingLimit || coreShopping.size>coreLimit)continue;
        const usedCore=new Set(state.usedCore);
        let coreRepeats=state.coreRepeats;
        for(const id of candidate.coreIds){if(usedCore.has(id))coreRepeats++;usedCore.add(id);}
        const chosen=state.chosen.concat(candidate.recipe.recipe_id);
        const repeats=state.repeats+Number(recentlyUsed.has(candidate.recipe.recipe_id));
        // Reject history and old-only recombinations before final beam pruning.
        if(depth===count-1&&(menuHistory.has(menuKey(chosen))||(seekFresh&&repeats===count)))continue;
        next.push({
          chosen,
          covered,
          shopping, groups,coreShopping,usedCore,coreRepeats,
          meat: state.meat + Number(candidate.kind === 'meat'),
          veg: state.veg + Number(candidate.kind === 'veg'),
          combinations: state.combinations + Number(candidate.combination),
          familiar:state.familiar+Number(candidate.recipe.familiar===true),
          incomplete: state.incomplete + Number(candidate.coreMissing > 0),
          missingMains: state.missingMains + Number(!owned.has(candidate.main)),
          missing: state.missing + candidate.missing,
          repeats,
          noise: state.noise + candidate.noise
        });
      }
    }
    const unique = new Map();
    for (const state of next) {
      const key = menuKey(state.chosen);
      const previous = unique.get(key);
      if (!previous || compare(state, previous) < 0) unique.set(key, state);
    }
    beam = Array.from(unique.values()).sort(compare).slice(0, beamWidth);
    if(!beam.length)return [];
  }
  return beam[0] ? beam[0].chosen : [];
}
module.exports={data,byId,foodGroups,foodIndex,availableFoods,requiredFoods,load,save,change,meal,create,update,select};
