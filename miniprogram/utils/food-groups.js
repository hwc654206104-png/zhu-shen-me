const groups = {
  "鸡肉":["鸡胸肉","鸡腿肉","鸡骨头","手枪鸡腿"],
  "鸡翅":["鸡翅根","鸡翅尖"],
  "猪肉":["猪里脊","猪梅肉","梅花肉","猪前腿肉","猪后腿肉","猪腿肉","五花肉"],
  "猪杂":["猪肚","猪腰","猪肝","猪大肠"],
  "鸡杂":["鸡肝","鸡肫"],
  "羊杂":["羊肚","羊腰","羊肺","羊肠"],
  "排骨":["猪大排"],
  "肥肉":["猪肥膘"],
  "猪骨":["猪脊骨","猪大骨"],
  "牛肉":["牛腱子","肥牛","牛腩","牛排","西冷牛排"],
  "羊肉":["羊腿肉","羊肉片","羊腿","羊腩"],
  "鸭肉":["麻鸭","鸭架"],
  "大鹅":["白鹅"],
  "鸡爪":["去骨鸡爪"],
  "鱿鱼":["鱿鱼须"],
  "鱼头":["胖头鱼鱼头"],
  "虾":["虾仁","罗氏虾","基围虾","河虾"],
  "螃蟹":["青蟹","梭子蟹","大闸蟹"],
  "花蛤":["蛤蜊","花甲肉"],
  "扇贝":["扇贝肉"],
  "生蚝":["海蛎"],
  "菜心":["菜苔","红菜苔"],
  "苋菜":["米苋"],
  "花菜":["菜花"],
  "生菜":["混合生菜"],
  "南瓜":["贝贝南瓜","南瓜泥"],
  "红薯":["蜜薯","紫薯"],
  "竹笋":["冬笋","春笋","清水笋","清水笋丝","罗汉笋"],
  "甜椒":["彩椒","黄椒"],
  "辣椒":["青椒","红椒","尖椒","线椒","青线椒","螺丝椒","美人椒","皱皮椒"],
  "蒜苔":["蒜薹"],
  "大葱":["京葱丁"],
  "木耳":["泡发玉耳"],
  "毛豆":["毛豆荚","水煮毛豆仁"],
  "海带":["海带丝"],
  "豆腐":["八公山豆腐","豆花","冻豆腐"],
  "面筋":["水面筋"],
  "梅菜":["梅干菜"],
  "酸菜":["客家酸菜","酸腌菜"],
  "腊肉":["安化腊肉"],
  "咸肉":["徽州咸肉"],
  "火腿":["宣威火腿"],
  "红肠":["哈尔滨红肠"],
  "腊肠":["广式香肠"],
  "香肠":["猪肉烤肠"],
  "午餐肉":["午餐肉丁"],
  "皮冻":["猪皮冻","鸡皮冻"],
  "面条":["宽面","宽面条","细面条","粗面条","手工挂面","生面","面片","烩面片","拉面","拉条子面","冷面","冷面片","碱水面","荞麦面","面线","福州线面"],
  "意大利面":["意面","通心粉","全麦意面"],
  "米线":["湿米线","细米线"],
  "米饭":["熟米饭","糙米饭","杂粮饭"],
  "面粉":["小麦面粉","白面"],
  "米粉":["干米粉","兴化米粉","常德米粉","粉干"],
  "馄饨皮":["扁食皮","扁肉皮"],
  "燕麦":["燕麦片","即食燕麦片"],
  "小元宵":["糯米小圆子"],
  "醪糟":["酒酿"],
  "奇异果":["猕猴桃"],
  "桂圆":["桂圆肉"],
  "杏仁":["杏仁片"],
  "藜麦":["三色藜麦"],
  "黄豆粉":["黄豆面"],
  "面包":["吐司","全麦面包","全麦吐司"],
  "酸奶":["无糖酸奶","希腊酸奶"],
  "坚果":["混合坚果","腰果","核桃","核桃仁","松子","松子仁","巴旦木","南瓜籽"],
  "河粉":["干河粉"],
  "芝士":["奶酪","芝士片","芝士碎"],
  "椰蓉":["椰丝"],
  "番茄":["小番茄"],
  "芋头":["槟榔芋"],
  "包菜":["紫甘蓝"],
  "胡萝卜":["黄萝卜"],
  "芹菜":["水芹"],
  "青菜":["叶菜","上海青","小白菜"],
  "魔芋":["魔芋丝","魔芋结","魔芋面"],
  "白菜":["娃娃菜"],
  "四季豆":["芸豆"],
  "绿豆":["去皮绿豆"],
  "芝麻":["白芝麻"],
  "大米":["香米","糙米","黑米","紫米"],
  "粘米粉":["粳米粉","籼米粉"],
  "红芸豆":["红腰豆"],
  "茶叶":["红茶","龙井茶"],
  "荷叶":["干荷叶"],
  "鱼":["鱼肉","鱼肉馅","鲜鱼","鲈鱼","鲈鱼片","带鱼","黑鳕鱼","巴沙鱼","巴沙鱼柳","巴沙鱼片","草鱼","草鱼肉","鲤鱼","桂鱼","鳊鱼","武昌鱼","鲢鱼","鲫鱼","银鱼","巢湖银鱼","鲳鱼","鲅鱼","马鲛鱼肉","三文鱼","三文鱼柳","三文鱼排","三文鱼碎","龙利鱼柳","鳕鱼","鳕鱼块","真鳕鱼块","石斑鱼","鲭鱼段","小黄鱼","黄鱼","多宝鱼","黑鱼","罗非鱼","黄鳝","鳝丝","白鱔","海鳗","泥鳅"],
  "鲜菌菇":["蘑菇","口蘑","鲜香菇","杏鲍菇","金针菇","蟹味菇","白玉菇","平菇"],
  "血旺":["猪血","鸡血","鸭血","羊血"],
  "巧克力":["黑巧克力","黑巧克力豆"],
  "豆皮":["千张","豆腐皮","千张结","油豆皮"],
  "糯米":["紫糯米"],
  "馍":["白吉馍","饦饦馍"],
  "梨":["雪梨","花盖梨"],
  "柚子":["红柚果肉"]
};
// 大类没有原始记录时复用固定旧 ID，仅改变冰箱显示名，兼容云端白名单与旧库存。
const representatives = {"猪杂":"猪肚","鱼":"鱼肉","鲜菌菇":"蘑菇","血旺":"猪血","豆皮":"千张","馍":"白吉馍","梨":"雪梨"};
function create(foods) {
  const byName = new Map(foods.map(food => [food.name, food]));
  const byId = new Map(foods.map(food => [food.id, food]));
  const parent = new Map(), displayNames = new Map();
  for (const [name, members] of Object.entries(groups)) {
    const target = byName.get(name) || byName.get(representatives[name]);
    if (target) displayNames.set(target.id,name);
    if (target) for (const member of members) if (byName.has(member)) parent.set(byName.get(member).id, target.id);
  }
  const canonical = id => parent.get(id) || id;
  const members = new Map();
  for (const food of foods) {
    const id = canonical(food.id);
    if (!members.has(id)) members.set(id, []);
    members.get(id).push(food);
  }
  const catalog = Array.from(members, ([id, entries]) => ({...byId.get(id),name:displayNames.get(id)||byId.get(id).name,
    aliases:[...new Set(entries.flatMap(food => [food.name,...(food.aliases||[])]))].filter(name => name !== (displayNames.get(id)||byId.get(id).name))}));
  // 库存只表达大类；组内全部细分原料均按已具备匹配。
  const matches = (ownedId, requiredId) => canonical(ownedId) === canonical(requiredId);
  const expand = ids => new Set([...ids,...foods.filter(food => ids.some(id => matches(id,food.id))).map(food => food.id)]);
  const rows = ids => catalog.filter(food => ids.some(id => canonical(id) === food.id));
  const names = values => [...new Set(values.map(name => byName.has(name)?(displayNames.get(canonical(byName.get(name).id))||byId.get(canonical(byName.get(name).id)).name):name))];
  const remove = (ids, removed) => ids.filter(id => !removed.includes(canonical(id)));
  const cleanupRows = (used, owned) => catalog.filter(food => used.some(id => canonical(id) === food.id)).map(food =>
    ({...food,owned:used.some(required => canonical(required) === food.id && owned.some(id => matches(id,required)))}));
  return {canonical,catalog,matches,expand,rows,names,remove,cleanupRows};
}
module.exports = {create,groups,representatives};
