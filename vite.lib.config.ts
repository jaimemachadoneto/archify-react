import { defineConfig } from "vite";

// The consumer's bundler resolves every package below, so the output holds only the code of the library.
// The regular expressions also match deep imports, such as "elkjs/lib/elk.bundled.js".
const external = [/^react(\/|$)/, /^react-dom(\/|$)/, /^@xyflow\/react(\/|$)/, /^elkjs(\/|$)/];

export default defineConfig({
  // No React plugin: it picks the development JSX runtime when NODE_ENV is "test", as in vitest.
  // The library must always import "react/jsx-runtime".
  oxc: { jsx: { runtime: "automatic", development: false } },
  build: {
    lib: {
      entry: "src/diagram/entry.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "styles",
    },
    rollupOptions: { external },
  },
});
