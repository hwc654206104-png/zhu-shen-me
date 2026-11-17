// Administrative helper. Uses the official CLI's existing login, never reads credentials.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const ENV_ID = 'cloud1-d0g0ntbbyaddfb364';
const APP_ID = 'wx0cb3da57b3344189';
const allowedCollections = new Set(['recipe_versions', 'user_profiles', 'fridges', 'meals', 'shares', 'viewed_shares']);
const [action, collection] = process.argv.slice(2);
if (!allowedCollections.has(collection)) throw Error('Unknown collection');
if (!['DescribeDatabaseACL', 'DescribeSafeRule', 'ModifySafeRule'].includes(action)) throw Error('Unsupported action');
const body = { EnvId: ENV_ID, CollectionName: collection };
if (action === 'DescribeSafeRule') body.WxAppId = APP_ID;
if (action === 'ModifySafeRule') body.AclTag = collection === 'recipe_versions' ? 'ADMINWRITE' : 'ADMINONLY';
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const cli = fs.readdirSync(cache).map(dir => path.join(cache, dir, 'node_modules/@cloudbase/cli/bin/tcb')).find(file => {
  if (!fs.existsSync(file)) return false;
  const pkg = JSON.parse(fs.readFileSync(path.join(path.dirname(file), '../package.json'), 'utf8'));
  return pkg.version === '3.8.6';
});
if (!cli) throw Error('Official CLI 3.8.6 not found; install before continuing');
const result = spawnSync(process.execPath, [cli, 'api', 'tcb', action, '--api-version', '2018-06-08',
  '--body', JSON.stringify(body), '--env-id', ENV_ID, '--json'], { encoding: 'utf8', timeout: 60000 });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
