const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");

(async () => {
  const app = await _electron.launch({ executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: [path.resolve("scripts/reader-smoke-main.cjs")],
    env: { ...process.env, READER_TEST_DATA: fs.mkdtempSync(path.join(os.tmpdir(), "reverie-reader-test-")), VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" } });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", error => { errors.push(error.message); console.error(error.message); });
    await page.waitForSelector("#root > *");
    await page.locator(".startup-intro").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "重播开场", exact: true }).click();
    await page.locator(".startup-intro").waitFor();
    assert.equal(await page.locator(".startup-app-content").evaluate(node => node.inert), true);
    await page.waitForTimeout(1700);
    fs.mkdirSync("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/startup-intro.png" });
    assert.ok(await page.locator(".startup-emblem img").evaluate(img => img.complete && img.naturalWidth > 0));
    await page.locator(".startup-intro").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".startup-app-content").evaluate(node => node.inert), false);
    await page.getByRole("button", { name: "重播开场", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.locator(".startup-intro").waitFor({ state: "hidden" });
    await page.waitForTimeout(3300);
    assert.equal(await page.locator(".startup-intro").count(), 0, "跳过后旧计时器不能重新显示动画");
    await page.getByRole("button", { name: "重播开场", exact: true }).click();
    await page.getByRole("button", { name: "跳过 Esc", exact: true }).click();
    await page.locator(".startup-intro").waitFor({ state: "hidden" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "重播开场", exact: true }).click();
    await page.locator(".startup-intro").waitFor({ state: "hidden", timeout: 1500 });
    assert.deepEqual(errors, []);
    console.log("通过：自动结束、标识加载、后台隔离、Esc/按钮跳过、连续重播、减少动态效果");
  } finally {
    const timer = setTimeout(() => app.process().kill(), 3000);
    await app.close().catch(() => {}); clearTimeout(timer);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
