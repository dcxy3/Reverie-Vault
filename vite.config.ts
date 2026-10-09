import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [react({ exclude: [/node_modules/, /src[\\/]reader[\\/]/] }), {
    name: "separate-pdf-reader",
    enforce: "pre",
    resolveId(source, importer) {
      // PDF uses our PDF.js Viewer, not Foliate's experimental PDF adapter.
      if (source === "./pdf.js" && importer?.replace(/\\/g, "/").includes("/foliate-js/"))
        return fileURLToPath(new URL("./src/reader/unsupported-pdf.ts", import.meta.url));
    }
  }],
  server: {
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: "dist",
    rollupOptions: { input: { main: "index.html", reader: "reader.html" } }
  }
});
