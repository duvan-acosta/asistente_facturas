const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dest = path.join(root, 'www');

const files = [
  'index.html',
  'styles.css',
  'app.js',
  'auth.js',
  'sync.js',
  'manifest.json',
  'sw.js',
  'auth-config.example.js',
  'sync-config.example.js',
];

const dirs = ['icons'];

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      copyFile(srcPath, dstPath);
    }
  }
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

for (const file of files) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    copyFile(src, path.join(dest, file));
  }
}

const authConfig = path.join(root, 'auth-config.js');
if (fs.existsSync(authConfig)) {
  copyFile(authConfig, path.join(dest, 'auth-config.js'));
}

const syncConfig = path.join(root, 'sync-config.js');
if (fs.existsSync(syncConfig)) {
  copyFile(syncConfig, path.join(dest, 'sync-config.js'));
}

for (const dir of dirs) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) {
    copyDir(src, path.join(dest, dir));
  }
}

console.log('Web assets copied to www/');
