import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

describe("the stylesheet", () => {
  it("has no colour literal, so every colour comes from a variable or a system colour", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/i);
  });

  it("reads each host variable with a fallback", () => {
    const reads = [...css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)];
    expect(reads.length).toBeGreaterThan(0);
    for (const [read, name, next] of reads) {
      if (name.startsWith("--archify-") || name.startsWith("--xy-")) continue;
      expect(next, `${read} needs a fallback`).toBe(",");
    }
  });

  it("reads a host variable only in the block that defines the private variables", () => {
    const rules = css.split("}").filter((rule) => !/--archify-[\w-]+\s*:/.test(rule));
    for (const rule of rules) {
      const hostReads = [...rule.matchAll(/var\(\s*(--[\w-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !name.startsWith("--archify-") && !name.startsWith("--xy-"));
      expect(hostReads, rule.trim().split("{")[0]).toEqual([]);
    }
  });

  it("lets a vertical swipe on a touch device scroll the page", () => {
    // React Flow sets touch-action none on the pane, and a node inherits it. This rule must win by its specificity.
    const media = css.match(
      /@media\s*\(\s*pointer\s*:\s*coarse\s*\)\s*\{\s*\.archify-diagram \.react-flow__pane\s*\{([^}]*)\}/,
    );
    expect(media, "a coarse pointer rule for the pane").not.toBeNull();
    expect(media![1]).toMatch(/touch-action\s*:\s*pan-y\s*;/);
  });
});
