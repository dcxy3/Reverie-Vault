const test = require("node:test");
const assert = require("node:assert/strict");
const { decodeTextBuffer } = require("./text-decoder.cjs");

function fromHex(value) {
  return Buffer.from(value.split(/\s+/).map((item) => Number.parseInt(item, 16)));
}

test("识别 Unicode 文本编码", () => {
  const text = "第一章 中文阅读测试";
  const utf16le = Buffer.from(text, "utf16le");
  const utf16be = Buffer.from(utf16le).swap16();
  const utf32le = Buffer.concat([
    Buffer.from([0xff, 0xfe, 0x00, 0x00]),
    ...Array.from(text).map((character) => {
      const bytes = Buffer.alloc(4);
      bytes.writeUInt32LE(character.codePointAt(0));
      return bytes;
    })
  ]);

  assert.deepEqual(decodeTextBuffer(Buffer.from(text)), { text, encoding: "utf-8" });
  assert.deepEqual(decodeTextBuffer(Buffer.concat([Buffer.from([0xff, 0xfe]), utf16le])), { text, encoding: "utf-16le" });
  assert.deepEqual(decodeTextBuffer(Buffer.concat([Buffer.from([0xfe, 0xff]), utf16be])), { text, encoding: "utf-16be" });
  assert.deepEqual(decodeTextBuffer(utf16le), { text, encoding: "utf-16le" });
  assert.deepEqual(decodeTextBuffer(utf16be), { text, encoding: "utf-16be" });
  assert.deepEqual(decodeTextBuffer(utf32le), { text, encoding: "utf-32le" });
});

test("识别中日韩常见本地编码", () => {
  const cases = [
    ["gb18030", "第一章 中文测试", "B5 DA D2 BB D5 C2 20 D6 D0 CE C4 B2 E2 CA D4"],
    ["big5", "第一章 繁體中文測試", "B2 C4 A4 40 B3 B9 20 C1 63 C5 E9 A4 A4 A4 E5 B4 FA B8 D5"],
    ["shift_jis", "日本語テスト", "93 FA 96 7B 8C EA 83 65 83 58 83 67"],
    ["euc-jp", "日本語テスト", "C6 FC CB DC B8 EC A5 C6 A5 B9 A5 C8"],
    ["iso-2022-jp", "日本語テスト", "1B 24 42 46 7C 4B 5C 38 6C 25 46 25 39 25 48 1B 28 42"],
    ["euc-kr", "한국어 소설 테스트", "C7 D1 B1 B9 BE EE 20 BC D2 BC B3 20 C5 D7 BD BA C6 AE"],
    ["windows-1252", "Café résumé", "43 61 66 E9 20 72 E9 73 75 6D E9"]
  ];

  for (const [encoding, text, hex] of cases) {
    assert.deepEqual(decodeTextBuffer(fromHex(hex)), { text, encoding });
  }
});
