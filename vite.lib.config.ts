import { defineConfig } from "vite";

// The consumer's bundler resolves every external package, including deep imports such as elkjs/lib.
const external = [/^react(\/|$)/, /^react-dom(\/|$)/, /^@xyflow\/react(\/|$)/, /^elkjs(\/|$)/];

export default defineConfig({
  // No React plugin, so the build keeps "react/jsx-runtime" also when NODE_ENV is "test".
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
