const fs = require("node:fs");
const { Readable } = require("node:stream");

function pdfByteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(header || "").trim());
  if (!match) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

function createPdfResponse(filePath, request) {
  const size = fs.statSync(filePath).size;
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? pdfByteRange(rangeHeader, size) : null;
  if (rangeHeader && !range) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Length": String(Math.max(0, end - start + 1)),
    "Content-Type": "application/pdf"
  };
  if (range) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });
  const body = Readable.toWeb(fs.createReadStream(filePath, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}

function createFileResponse(filePath, mimeType, request) {
  const size = fs.statSync(filePath).size;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Length": String(size),
    "Content-Type": mimeType
  };
  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(Readable.toWeb(fs.createReadStream(filePath)), { headers });
}

module.exports = { createFileResponse, createPdfResponse, pdfByteRange };
