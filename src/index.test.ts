import { existsSync, readdirSync, readFileSync } from "fs";
import { describe, it, expect } from "vitest";
import { join } from "path";

// The test reads the output of `vite build`. Without that output there is nothing to examine.
const assetsPath = join(process.cwd(), "dist", "assets");

describe.skipIf(!existsSync(assetsPath))("index export", () => {
  it("should export index.js and styles.css", () => {
    const files = readdirSync(assetsPath);
    const indexJs = files.find((f) => /^index-.*\.js$/.test(f));
    const styles = files.find((f) => /^index-.*\.css$/.test(f));

    expect(indexJs).toBeDefined();
    expect(styles).toBeDefined();
    expect(readFileSync(join(assetsPath, indexJs!), "utf8").length).toBeGreaterThan(0);
  });
});
