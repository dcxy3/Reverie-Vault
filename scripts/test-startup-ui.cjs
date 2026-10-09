const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reverie-reader-test-"));
  const app = await _electron.launch({
    executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: [path.resolve("scripts/reader-smoke-main.cjs")],
    env: { ...process.env, READER_TEST_DATA: directory,
      VITE_DEV_SERVER_URL: process.env.STARTUP_TEST_PRODUCTION ? "" : "http://127.0.0.1:5173" }
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const film = page.locator(".startup-film");
    const replay = async () => {
      await page.getByRole("button", { name: "重播开屏动画" }).focus();
      await page.keyboard.press("Enter");
      await film.waitFor();
    };
    await film.waitFor();
    await page.waitForFunction(() => {
      const video = document.querySelector(".startup-film-video");
      return video && video.currentTime > 1.5;
    });
    assert.equal(await page.locator(".startup-app-content").evaluate(el => el.inert), true);
    assert.deepEqual(await page.locator("video").evaluate(el => [el.videoWidth, el.videoHeight, el.muted]), [1920, 1080, true]);
    fs.mkdirSync("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/startup-animation.png" });
    await page.locator(".startup-film.is-pushing").waitFor();
    const pushFrame = await page.locator("video").evaluate(el => ({ paused: el.paused, time: el.currentTime }));
    console.log("推进帧", pushFrame);
    assert.equal(pushFrame.paused && pushFrame.time >= 3.9 && pushFrame.time < 4.7, true, "粉色弹框出现后才开始推进");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/startup-push.png" });
    await film.waitFor({ state: "detached" });
    assert.equal(await page.locator(".startup-app-content").evaluate(el => el.inert), false);
    await page.reload();
    await page.locator(".startup-app-content").waitFor();
    assert.equal(await film.count(), 0, "刷新不会重复播放");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1040, 680));
    for (const key of ["Escape", "Space"]) {
      await replay();
      await page.keyboard.press(key);
      await film.waitFor({ state: "detached" });
    }
    await replay();
    await page.waitForTimeout(1800);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: "test-results/startup-small-window.png" });
    await page.getByRole("button", { name: "跳过动画" }).click();
    await film.waitFor({ state: "detached" });
    await replay();
    await page.locator("video").evaluate(el => el.dispatchEvent(new Event("error")));
    await page.locator(".startup-film.is-still").waitFor();
    await film.waitFor({ state: "detached", timeout: 4000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await page.locator(".startup-app-content").waitFor();
    assert.equal(await film.count(), 0, "减少动态效果时不自动播放");
    await replay();
    assert.equal(await film.locator("video").count(), 0);
    await film.waitFor({ state: "detached", timeout: 4000 });
    assert.deepEqual(errors, []);
    console.log("开屏自检通过：实际解码、自动结束、刷新去重、按钮重播、键盘/按钮跳过、小窗口、故障回退、减少动态效果。");
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
