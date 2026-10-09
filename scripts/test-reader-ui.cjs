const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { _electron } = require(process.env.PLAYWRIGHT_PACKAGE || "playwright");
const { createFixtures, zip } = require("./reader-fixtures.cjs");

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reverie-reader-test-"));
  const fixtures = createFixtures(directory);
  const app = await _electron.launch({ executablePath: path.resolve("node_modules/electron/dist/electron.exe"),
    args: [path.resolve("scripts/reader-smoke-main.cjs")],
    env: { ...process.env, READER_TEST_DATA: directory, VITE_DEV_SERVER_URL: "http://127.0.0.1:5173" } });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", error => { errors.push(error.message); console.error("RENDERER:", error.message); });
    page.on("console", message => { if (message.type() === "error") console.error("CONSOLE:", message.text()); });
    await page.waitForSelector("#root > *");
    await page.evaluate(async () => {
      const React = await import("/node_modules/.vite/deps/react.js");
      const DOM = await import("/node_modules/.vite/deps/react-dom_client.js");
      window.testReact = React.default || React;
      const host = document.createElement("div");
      host.style.cssText = "position:fixed;inset:0;z-index:1000;background:#14202c";
      document.body.append(host);
      window.testRoot = (DOM.default || DOM).createRoot(host);
      window.testProgress = [];
    });
    const renderNovel = async location => page.evaluate(async saved => {
      const { NovelReader } = await import("/src/components/NovelReader.tsx");
      window.testRoot.render(window.testReact.createElement(NovelReader, {
        key: Math.random(), item: { id: "test", title: "阅读器测试", lastReadLocation: saved },
        document: { title: "阅读器测试", content: "第一章 开始\n" + Array.from({ length: 100 }, (_, i) => `第 ${i} 段：这是用于自检的中文小说正文，验证窗口排版、编码和阅读位置。`.repeat(5)).join("\n") + "\n第二章 后续\n这里是后续章节的正文。" },
        onProgress: (location, chapter) => window.testProgress.push({ location, chapter }),
        onClose: () => { window.testClosed = true; }
      }));
    }, location);
    await renderNovel();
    console.log("已挂载小说测试页面");
    const reader = page.frameLocator('iframe[title="阅读器测试 阅读器"]');
    await reader.getByRole("button", { name: "下一页", exact: true }).waitFor();
    await reader.locator(".reader-status").waitFor({ state: "hidden", timeout: 30000 });
    await reader.getByRole("button", { name: "下一页", exact: true }).click();
    await page.waitForTimeout(700);
    const saved = await page.evaluate(() => window.testProgress.at(-1)?.location);
    assert.match(saved, /^epubcfi\(/);
    await renderNovel(saved);
    await reader.locator(".reader-status").waitFor({ state: "hidden" });
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.testProgress.at(-1)?.location), saved, "小说重新打开应恢复同一文本位置");
    await reader.getByLabel("字号", { exact: true }).selectOption("28");
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1040, 680));
    await page.waitForTimeout(500);
    const readerFrame = page.frames().find(frame => frame.url().includes("reader.html"));
    assert.equal(await readerFrame.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "小窗口不能出现横向溢出");
    fs.mkdirSync("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/novel-reader.png" });
    await reader.getByLabel("阅读方式", { exact: true }).selectOption("scrolled");
    await reader.getByRole("button", { name: "章节目录", exact: true }).click();
    console.log("目录:", await reader.locator("aside").textContent());
    await reader.getByRole("button", { name: "第二章 后续", exact: true }).click();
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.testProgress.at(-1)?.chapter), "第二章 后续");
    await reader.getByRole("button", { name: "退出阅读", exact: true }).click();
    await page.waitForFunction(() => window.testClosed === true);
    assert.equal(await page.evaluate(() => window.testClosed), true);
    console.log("通过：TXT 排版、翻页、位置恢复、字号、滚动模式、目录、退出");

    for (const [format, filePath] of Object.entries(fixtures)) {
      await page.evaluate(async ({ filePath, format }) => {
        const { NovelReader } = await import("/src/components/NovelReader.tsx");
        const item = { id: format, title: "电子书测试", kind: "novel", filePath };
        const document = await window.galLauncher.readNovel(item);
        window.testRoot.render(window.testReact.createElement(NovelReader, { key: format, item, document,
          onProgress: (location, chapter) => window.testProgress.push({ location, chapter }), onClose() {} }));
      }, { filePath, format });
      const ebook = page.frameLocator('iframe[title="电子书测试 阅读器"]');
      await ebook.getByRole("button", { name: "章节目录", exact: true }).waitFor();
      await ebook.locator(".reader-status").waitFor({ state: "hidden", timeout: 20000 });
      await page.waitForTimeout(400);
      const frames = page.frames();
      const texts = await Promise.all(frames.filter(frame => frame.url().startsWith("blob:")).map(frame => frame.locator("body").textContent()));
      assert.ok(texts.some(text => text.includes(format.toUpperCase() + " 中文正文")), `${format} 正文应显示`);
      assert.equal(await page.frames().find(frame => frame.url().includes("reader.html")).evaluate(() => Boolean(window.bookScriptExecuted)), false, "书中脚本不得执行");
      console.log(`通过：${format.toUpperCase()} 本地导入、解压、正文显示与脚本隔离`);
    }

    const pdfPath = process.env.READER_TEST_PDF;
    if (pdfPath && fs.existsSync(pdfPath)) {
      await page.evaluate(async filePath => {
        const { MangaViewer } = await import("/src/components/MangaViewer.tsx");
        const document = await window.galLauncher.readManga({ kind: "manga", filePath, title: "PDF 测试" });
        window.testChapter = document.chapters[0];
        window.renderPdf = (initialPage, initialOffset) => window.testRoot.render(window.testReact.createElement(MangaViewer, {
          key: Math.random(), chapter: window.testChapter, pageIndex: initialPage, initialOffset,
          onPageChange: (page, offset) => window.testProgress.push({ page, offset }), onPreviousChapter() {}, onNextChapter() {}
        }));
        window.renderPdf(29, .35);
      }, pdfPath);
      await page.locator(".pdf-reader-container canvas").first().waitFor({ timeout: 30000 });
      await page.locator(".manga-page-status").waitFor({ state: "hidden" });
      await page.waitForTimeout(1500);
      const getPosition = () => page.evaluate(() => {
        const stage = document.querySelector(".pdf-reader-container");
        const pages = Array.from(stage.querySelectorAll(".page"));
        const element = pages.find(p => p.offsetTop + p.clientHeight > stage.scrollTop + 1);
        return { page: Number(element.dataset.pageNumber) - 1, offset: (stage.scrollTop - element.offsetTop) / element.clientHeight, canvases: stage.querySelectorAll("canvas").length };
      });
      let position = await getPosition();
      assert.equal(position.page, 29);
      assert.ok(Math.abs(position.offset - .35) < .03, JSON.stringify(position));
      assert.ok(position.canvases < 15, "PDF 不应渲染整本漫画");
      await page.evaluate(() => document.querySelector(".pdf-reader-container").scrollBy(0, 350));
      await page.waitForTimeout(600);
      const moved = await getPosition();
      assert.ok(moved.page !== position.page || Math.abs(moved.offset - position.offset) > .05, "滚动应改变阅读位置");
      const pdfSaved = await page.evaluate(() => window.testProgress.at(-1));
      console.log("PDF 滚动后:", moved, "保存:", pdfSaved);
      assert.equal(pdfSaved.page, moved.page);
      assert.ok(Math.abs(pdfSaved.offset - moved.offset) < .03, "实际滚动位置必须被保存");
      await page.evaluate(saved => window.renderPdf(saved.page, saved.offset), pdfSaved);
      await page.locator(".manga-page-status").waitFor({ state: "hidden" });
      await page.waitForTimeout(1000);
      position = await getPosition();
      assert.equal(position.page, pdfSaved.page);
      assert.ok(Math.abs(position.offset - pdfSaved.offset) < .03);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1320, 860));
      await page.waitForTimeout(700);
      const resized = await getPosition();
      console.log("PDF 尺寸:", await page.evaluate(() => {
        const container = document.querySelector('.pdf-reader-container'), p = container.querySelector('.page[data-page-number="30"]'), canvas = p.querySelector('canvas');
        return { client: container.clientWidth, scroll: container.scrollWidth, page: p.clientWidth, pageStyle: p.getAttribute('style'), viewerStyle: p.parentElement.getAttribute('style'), canvas: canvas?.getBoundingClientRect().width };
      }));
      assert.equal(resized.page, pdfSaved.page, "窗口变化应留在同一页");
      assert.ok(await page.evaluate(() => { const c = document.querySelector('.pdf-reader-container'); return c.scrollWidth <= c.clientWidth + 2; }), "适宽模式不能因横向跨页产生横向溢出");
      assert.ok(Math.abs(resized.offset - pdfSaved.offset) < .05, "窗口变化应保留页内位置");
      await page.screenshot({ path: "test-results/pdf-reader.png" });
      console.log("通过：大 PDF 按需渲染、第 30 页及页内位置恢复", position);
    }

    const imageData = await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 600; canvas.height = 3000;
      const context = canvas.getContext("2d"); context.fillStyle = "#e5d5b5"; context.fillRect(0,0,600,3000);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    const archive = path.join(directory, "长图测试.cbz");
    fs.writeFileSync(archive, zip({ "01.png": Buffer.from(imageData, "base64"), "02.png": Buffer.from(imageData, "base64"), "03.png": Buffer.from(imageData, "base64") }));
    await page.evaluate(async filePath => {
      const { MangaViewer } = await import("/src/components/MangaViewer.tsx");
      const document = await window.galLauncher.readManga({ title: "CBZ", kind: "manga", filePath });
      window.testRoot.render(window.testReact.createElement(MangaViewer, { key: "images", chapter: document.chapters[0], pageIndex: 1, initialOffset: .4,
        onPageChange: (page, offset) => window.testProgress.push({ page, offset }), onPreviousChapter() {}, onNextChapter() {} }));
    }, archive);
    await page.locator('.manga-continuous-page[data-manga-page="1"] img').waitFor();
    await page.waitForTimeout(1000);
    const imagePosition = await page.evaluate(() => {
      const stage = document.querySelector(".manga-page-stage"), page = stage.querySelector('[data-manga-page="1"]');
      return { ratio: page.clientHeight / page.clientWidth, offset: (stage.scrollTop - page.offsetTop) / page.clientHeight };
    });
    assert.ok(Math.abs(imagePosition.ratio - 5) < .01, "长图不可拉伸或裁切");
    assert.ok(Math.abs(imagePosition.offset - .4) < .03, JSON.stringify(imagePosition));
    console.log("通过：CBZ 解压、长图比例、图片页内位置恢复", imagePosition);
    await page.screenshot({ path: "test-results/image-reader.png" });
    assert.deepEqual(errors, [], "阅读器不得出现未处理异常");
  } catch (error) { console.error(error); throw error; }
  finally { const timer = setTimeout(() => app.process().kill(), 3000); await app.close().catch(() => {}); clearTimeout(timer); }
})().catch(error => { console.error(error); process.exitCode = 1; });
