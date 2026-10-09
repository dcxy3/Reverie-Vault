// Isolated Electron harness: never read or write the user's real library.
const { app } = require("electron");
const path = require("node:path");
const os = require("node:os");
const directory = process.env.READER_TEST_DATA;
if (!directory || !path.resolve(directory).startsWith(path.join(os.tmpdir(), "reverie-reader-test-"))) throw new Error("Missing isolated test directory");
const setPath = app.setPath.bind(app);
app.setPath = (name, value) => setPath(name, name === "userData" ? directory : value);
app.on("browser-window-created", (_event, window) => {
  window.webContents.setBackgroundThrottling(false);
  // A hidden native window suppresses Chromium scroll events even without timer
  // throttling. Keep the test window rendered offscreen without taking focus.
  window.setPosition(-10000, -10000);
  window.showInactive();
});
require("../electron/main.cjs");
