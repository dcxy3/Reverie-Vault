const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const executablePath = path.join(projectDir, "release", "win-unpacked", "Reverie Vault.exe");
const iconPath = path.join(projectDir, "build", "icon.ico");
const rceditPath = path.join(projectDir, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
const version = String(packageJson.version || "0.0.0");

for (const requiredPath of [executablePath, iconPath, rceditPath]) {
  if (!fs.existsSync(requiredPath)) throw new Error(`Required release resource was not found: ${requiredPath}`);
}

execFileSync(rceditPath, [
  executablePath,
  "--set-icon", iconPath,
  "--set-file-version", version,
  "--set-product-version", version,
  "--set-version-string", "FileDescription", "Reverie Vault",
  "--set-version-string", "ProductName", "Reverie Vault",
  "--set-version-string", "InternalName", "Reverie Vault",
  "--set-version-string", "OriginalFilename", "Reverie Vault.exe",
  "--set-version-string", "CompanyName", "Reverie Vault",
  "--set-version-string", "LegalCopyright", `Copyright © ${new Date().getFullYear()} Reverie Vault`,
  "--set-version-string", "LegalTrademarks", "Reverie Vault"
], { stdio: "inherit", windowsHide: true });

console.log(`Branded Windows executable: ${executablePath}`);
