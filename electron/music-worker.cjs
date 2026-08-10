let api;

function getApi() {
  if (!api) api = require("@neteasecloudmusicapienhanced/api");
  return api;
}

function serializeError(error) {
  if (error instanceof Error) return error.message || error.name;
  if (error && typeof error === "object") {
    try { return JSON.stringify(error); } catch {}
  }
  return String(error || "网易云音乐服务发生未知错误");
}

let requestQueue = Promise.resolve();

async function handleRequest(message) {
  const id = message?.id;
  if (!id || typeof message?.method !== "string") return;
  try {
    const handler = getApi()[message.method];
    if (typeof handler !== "function") throw new Error(`不支持的网易云接口：${message.method}`);
    const result = await handler(message.args || {});
    if (process.connected) process.send({ id, ok: true, result });
  } catch (error) {
    if (process.connected) process.send({ id, ok: false, error: serializeError(error) });
  }
}

process.on("message", (message) => {
  requestQueue = requestQueue.then(() => handleRequest(message), () => handleRequest(message));
});

process.on("uncaughtException", (error) => {
  if (process.connected) process.send({ type: "worker-error", error: serializeError(error) });
  setImmediate(() => process.exit(1));
});

process.on("unhandledRejection", (error) => {
  if (process.connected) process.send({ type: "worker-error", error: serializeError(error) });
  setImmediate(() => process.exit(1));
});
