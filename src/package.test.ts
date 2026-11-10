import { existsSync, readdirSync, readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import { join } from "path";

// The test reads the output of `vite build`. Without that output there is nothing to examine.
const assetsPath = join(process.cwd(), "dist", "assets");

describe.skipIf(!existsSync(assetsPath))("package test", () => {
  it("should have the index file with no React imports", () => {
    const indexFile = readdirSync(assetsPath).find((f) => /^index-.*\.js$/.test(f));
    expect(indexFile).toBeDefined();

    const content = readFileSync(join(assetsPath, indexFile!), "utf8");
    const lines = content.split("\n");

    // Check each line for import statements that involve React
    const hasReactImport = lines.some((line) => {
      // Check if the line contains 'import' (case-insensitive)
      if (line.trim().toLowerCase().startsWith("import")) {
        // Check if it imports 'react' or 'react-dom' (case-insensitive)
        const lowerLine = line.toLowerCase();
        return (
          lowerLine.includes("import") &&
          (lowerLine.includes("react") || lowerLine.includes("react-dom"))
        );
      }
      return false;
    });

    expect(hasReactImport).toBe(false);
  });
});
