const { unpack } = require('./codec');
const chunks = [require('./chunk-0'),require('./chunk-1'),require('./chunk-2'),require('./chunk-3'),require('./chunk-4'),require('./chunk-5'),require('./chunk-6'),require('./chunk-7'),require('./chunk-8'),require('./chunk-9'),require('./chunk-10'),require('./chunk-11'),require('./chunk-12'),require('./chunk-13')];
const tutorials = {};
chunks.forEach(chunk => unpack(chunk).forEach(recipe => { tutorials[recipe.recipe_id] = recipe; }));
module.exports = { tutorials };
