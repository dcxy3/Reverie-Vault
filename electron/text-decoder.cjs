const COMMON_CJK = new Set([
  ..."的一是不了人在有我他这中大来上国个到说们为子和你地出道也时年得就那要下以生会自着去之过家学对可里后小么心多天而能好都然没日于起还发成事只作当想看文无开手十用主行方又如前所本见经头面公同三已老从动两长知民样现分将外但身些与高意进把法此实回二理美点月明其种声全工己话儿者向情部正名定女问力机给等几很业最间新什打便位因重被走电四第门相次东政海口使教西再平真听世气信北少关并内加化由却代军产入先山五太水万市眼体别处总才场师书比住员九笑性通目华报立马命张活难神数件安表原车白应路期叫死常提感金何更反合放做系计或司利受光王果亲界及今京务强像完革制解各任物台象记边共风战干接它许八特觉望直服毛林题建南度统色字请交爱让认算论百吃义科怎元社术结六功指思非流每青管夫连坐资队形节类单越办式识保片始周精府传查著清集品且設愛時個來為會說發後裡過還對樣於學與進無開經長現將實見這國們臺灣體書讀小說輕漫畫章節繁簡轉碼",
  ..."日本語小説漫画章節本文読書物語私彼彼女君今日世界時間学校先生主人公気持第話巻夢恋愛少女少年人々一緒本当大丈夫思言見来行何心中"
]);

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "").replace(/\u0000+$/g, "");
}

function decodeWith(label, buffer, fatal = true) {
  try {
    return stripBom(new TextDecoder(label, { fatal }).decode(buffer));
  } catch {
    return "";
  }
}

function decodeUtf32(buffer, littleEndian) {
  let output = "";
  for (let offset = 4; offset + 3 < buffer.length; offset += 4) {
    const codePoint = littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
    if (codePoint === 0) continue;
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "";
    output += String.fromCodePoint(codePoint);
  }
  return output;
}

function textQuality(text, encoding) {
  if (!text) return Number.NEGATIVE_INFINITY;
  const sample = text.slice(0, 120000);
  let printable = 0;
  let controls = 0;
  let replacements = 0;
  let cjk = 0;
  let commonCjk = 0;
  let kana = 0;
  let halfwidthKana = 0;
  let hangul = 0;
  let latin = 0;

  for (const character of sample) {
    const codePoint = character.codePointAt(0);
    if (character === "�") replacements += 1;
    if ((codePoint < 32 && !"\n\r\t\f".includes(character)) || (codePoint >= 0x7f && codePoint <= 0x9f)) controls += 1;
    else printable += 1;
    if (/\p{Script=Han}/u.test(character)) {
      cjk += 1;
      if (COMMON_CJK.has(character)) commonCjk += 1;
    } else if (codePoint >= 0xff61 && codePoint <= 0xff9f) halfwidthKana += 1;
    else if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(character)) kana += 1;
    else if (/\p{Script=Hangul}/u.test(character)) hangul += 1;
    else if (/\p{Script=Latin}/u.test(character)) latin += 1;
  }

  let score = printable - controls * 140 - replacements * 500;
  score += commonCjk * 5 + cjk * 0.35;
  score -= (sample.match(/[锟斤拷鈥銆縺繧譁螟髫]/g) || []).length * 18;

  if (["shift_jis", "euc-jp", "iso-2022-jp"].includes(encoding)) score += kana * 7 - halfwidthKana * 1.5;
  else if (encoding === "euc-kr") score += hangul * 7;
  else if (encoding === "windows-1252") score += latin * 0.7 - (cjk + kana + hangul) * 2;
  else if (["gb18030", "big5"].includes(encoding)) score += cjk * 1.2 - halfwidthKana * 5;
  return score;
}

function looksLikeUtf16(buffer) {
  const sampled = Math.min(buffer.length, 4096);
  const sampleLength = sampled - (sampled % 2);
  if (sampleLength < 4) return "";
  let evenZeros = 0;
  let oddZeros = 0;
  for (let index = 0; index < sampleLength; index += 2) {
    if (buffer[index] === 0) evenZeros += 1;
    if (buffer[index + 1] === 0) oddZeros += 1;
  }
  const pairs = sampleLength / 2;
  if (oddZeros / pairs > 0.28 && evenZeros / pairs < 0.08) return "utf-16le";
  if (evenZeros / pairs > 0.28 && oddZeros / pairs < 0.08) return "utf-16be";
  return "";
}

function decodeTextBuffer(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || []);
  if (!buffer.length) return { text: "", encoding: "utf-8" };

  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0xff, 0xfe, 0x00, 0x00]))) {
    return { text: decodeUtf32(buffer, true), encoding: "utf-32le" };
  }
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0xfe, 0xff]))) {
    return { text: decodeUtf32(buffer, false), encoding: "utf-32be" };
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
    return { text: decodeWith("utf-8", buffer.subarray(3), false), encoding: "utf-8" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: decodeWith("utf-16le", buffer.subarray(2), false), encoding: "utf-16le" };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { text: decodeWith("utf-16be", buffer.subarray(2), false), encoding: "utf-16be" };
  }

  const utf16 = looksLikeUtf16(buffer);
  if (utf16) return { text: decodeWith(utf16, buffer, false), encoding: utf16 };

  // ISO-2022-JP is seven-bit data and would otherwise look like valid UTF-8.
  if (buffer.includes(Buffer.from([0x1b, 0x24])) || buffer.includes(Buffer.from([0x1b, 0x28]))) {
    const iso2022 = decodeWith("iso-2022-jp", buffer, true);
    if (iso2022) return { text: iso2022, encoding: "iso-2022-jp" };
  }

  const utf8 = decodeWith("utf-8", buffer, true);
  if (utf8) return { text: utf8, encoding: "utf-8" };

  const candidateEncodings = ["gb18030", "big5", "shift_jis", "euc-jp", "iso-2022-jp", "euc-kr", "windows-1252"];
  if (buffer.length % 2 === 0) candidateEncodings.push("utf-16le", "utf-16be");
  const candidates = candidateEncodings
    .map((encoding) => ({ encoding, text: decodeWith(encoding, buffer, true) }))
    .filter((candidate) => candidate.text)
    .map((candidate) => ({ ...candidate, score: textQuality(candidate.text, candidate.encoding) }))
    .sort((left, right) => right.score - left.score);

  if (candidates.length) return { text: candidates[0].text, encoding: candidates[0].encoding };
  return { text: decodeWith("utf-8", buffer, false), encoding: "utf-8" };
}

module.exports = { decodeTextBuffer };
