// Pass JSON in-process to the official CLI to avoid Windows command-line limits.
// Does not read credentials. Only this recipe-version collection is allowed.
const fs=require('node:fs'),path=require('node:path');
const [action,file]=process.argv.slice(2),env='cloud1-d0g0ntbbyaddfb364',table='recipe_versions';
if(!['query','insert'].includes(action))throw Error('Unsupported operation');
const value=JSON.parse(fs.readFileSync(file,'utf8'));
if(action==='insert'&&(!value._id?.startsWith('r1-')||value.recipeVersion!==require('../miniprogram/data/recipe-index').metadata.recipeVersion))throw Error('Unexpected recipe version');
const command=action==='query'?{find:table,filter:value,limit:100}:{insert:table,documents:[value]};
const entries=[{TableName:table,CommandType:action==='query'?'QUERY':'INSERT',Command:JSON.stringify(command)}];
const cache=path.join(process.env.LOCALAPPDATA,'npm-cache/_npx');
const cli=fs.readdirSync(cache).map(d=>path.join(cache,d,'node_modules/@cloudbase/cli/bin/tcb')).find(f=>fs.existsSync(f)&&JSON.parse(fs.readFileSync(path.join(path.dirname(f),'../package.json'))).version==='3.8.6');
if(!cli)throw Error('Official CloudBase CLI unavailable');
process.argv=[process.execPath,cli,'db','nosql','execute','--command',JSON.stringify(entries),'-e',env,'--json'];
require(cli);
