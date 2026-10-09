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
    const pushFrame = await page.locator("video").evaluate(el => ({ paused: el.paused, time: el.currentTime, rate: el.playbackRate }));
    console.log("推进帧", pushFrame);
    assert.equal(!pushFrame.paused && pushFrame.rate === 0.35 && pushFrame.time >= 3.9 && pushFrame.time < 4.7, true, "粉色弹框出现后慢放而非突然定格");
    assert.equal(await page.locator(".startup-film-art").evaluate(el => getComputedStyle(el).animationDuration), "2.5s", "推进使用慢速曲线");
    assert.equal(await page.locator(".startup-film-art").evaluate(el => el.getAnimations()[0].effect.getKeyframes().at(-1).transform), "scale(1.65)", "限制推进幅度，避免撞脸");
    await page.waitForTimeout(400);
    await page.screenshot({ path: "test-results/startup-push.png" });
    await page.locator(".startup-film.is-soft-exit").waitFor({ state: "attached" });
    assert.equal(await film.evaluate(el => getComputedStyle(el).transitionDuration), "2.2s", "自然结束使用柔和交叠淡出");
    await film.waitFor({ state: "detached" });
    assert.equal(await page.locator(".startup-app-content").evaluate(el => el.inert), false);
    await page.reload();
    await page.locator(".startup-app-content").waitFor();
    assert.equal(await film.count(), 0, "刷新不会重复播放");
    await replay();
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("button", { name: "跳过动画" }).evaluate(el => el === document.activeElement), true, "焦点不能穿透开屏");
    await page.locator(".startup-film.is-soft-exit").waitFor({ state: "attached" });
    await page.keyboard.press("Escape");
    await film.waitFor({ state: "detached", timeout: 1000 });
    // Interrupt an active intro with another replay; old timers must not close it.
    await replay();
    await page.waitForTimeout(500);
    await page.evaluate(() => window.dispatchEvent(new Event("reverie:replay-startup")));
    await page.waitForTimeout(900);
    assert.equal(await film.count(), 1, "连续重播不会被旧计时器关闭");
    await page.keyboard.press("Escape");
    await film.waitFor({ state: "detached" });
    await replay();
    await page.locator("video").evaluate(el => el.pause());
    await film.waitFor({ state: "detached", timeout: 9500 });
    assert.equal(await page.locator(".startup-app-content").evaluate(el => el.inert), false, "播放停滞时安全退出并释放主界面");
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
