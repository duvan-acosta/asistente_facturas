const fs = require('fs');
const path = require('path');
const { ensureSyncConfig } = require('./inject-sync-config');

const root = path.join(__dirname, '..');

const pairs = [
  ['auth-config.example.js', 'auth-config.js'],
  ['.env.example', '.env'],
];

for (const [example, target] of pairs) {
  const examplePath = path.join(root, example);
  const targetPath = path.join(root, target);

  if (!fs.existsSync(targetPath) && fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, targetPath);
    console.log(`Created ${target} from ${example}`);
  }
}

ensureSyncConfig(root);

require('./seed-dev-data');
