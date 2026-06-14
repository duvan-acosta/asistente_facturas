const { spawnSync } = require('child_process');
const path = require('path');
const { ensureSyncConfig, resolveSyncApiUrl, writeSyncConfig } = require('./inject-sync-config');

const root = path.join(__dirname, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: true,
    cwd: root,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('=== Vencely — build APK móvil ===\n');

ensureSyncConfig(root);
const apiUrl = resolveSyncApiUrl(root);
console.log(`\nAPI cloud: ${apiUrl}`);
console.log('(Define CLOUD_API_URL o SYNC_API_URL en .env para cambiar)\n');

run('node', ['scripts/copy-web.js']);

writeSyncConfig(path.join(root, 'www', 'sync-config.js'), apiUrl, 'build-mobile.js');

run('npx', ['cap', 'sync']);

const isWin = process.platform === 'win32';
const gradle = isWin ? 'gradlew.bat' : './gradlew';
run(gradle, ['assembleDebug'], { cwd: path.join(root, 'android') });

console.log('\n✓ APK generado: android/app/build/outputs/apk/debug/app-debug.apk');
console.log(`  API configurada: ${apiUrl}`);
