// Run after building the directory, NSIS and portable targets.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { path7za } = require('7zip-bin');
const root = path.resolve(__dirname, '..');
const { version } = require('../package.json');
const release = path.join(root, 'release');
const names = [`Reverie Vault Setup ${version}.exe`, `Reverie Vault Portable ${version}.exe`, `Reverie Vault Green ${version} x64.zip`];
for (const name of names.slice(0, 2)) if (!fs.existsSync(path.join(release, name))) throw new Error(`Missing: ${name}`);
// Refuse to update an existing archive: that could retain obsolete entries.
if (!process.argv.includes('--checksums-only')) {
  if (fs.existsSync(path.join(release, names[2]))) throw new Error(`Archive already exists: ${names[2]}`);
  execFileSync(path7za, ['a', '-tzip', '-mx=5', names[2], 'win-unpacked'], { cwd: release, stdio: 'inherit', windowsHide: true });
}
execFileSync(path7za, ['t', names[2]], { cwd: release, stdio: 'inherit', windowsHide: true });
// GitHub normalizes spaces to dots in uploaded asset names.
const sums = names.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(release, name))).digest('hex')}  ${name.replaceAll(' ', '.')}`);
fs.writeFileSync(path.join(release, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log(sums.join('\n'));
