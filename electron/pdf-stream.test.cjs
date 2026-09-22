const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createPdfResponse, pdfByteRange } = require("./pdf-stream.cjs");

test("解析 PDF 字节范围", () => {
  assert.deepEqual(pdfByteRange("bytes=10-19", 100), { start: 10, end: 19 });
  assert.deepEqual(pdfByteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(pdfByteRange("bytes=-8", 100), { start: 92, end: 99 });
  assert.equal(pdfByteRange("bytes=100-101", 100), null);
});

test("以分段响应流式读取 PDF", async (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reverie-pdf-test-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "sample.pdf");
  const content = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(4096, 7)]);
  fs.writeFileSync(filePath, content);

  const response = createPdfResponse(filePath, new Request("https://reader.test/sample", { headers: { Range: "bytes=0-1023" } }));
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-range"), `bytes 0-1023/${content.length}`);
  assert.equal(response.headers.get("content-length"), "1024");
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 8).toString(), "%PDF-1.7");
});
