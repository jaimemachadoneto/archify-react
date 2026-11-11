import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "styles.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

const read = (name: string, dir = import.meta.dirname) =>
  readFileSync(join(dir, name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Palette = Record<string, string>;

// The declarations of every top-level rule, as name and value, in the order of the file.
function rules(source: string): Array<{ selectors: string[]; body: Palette }> {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selectors: selector
      .replace(/^[\s\S]*;/, "")
      .split(",")
      .map((s) => s.trim()),
    body: Object.fromEntries(
      [...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
    ),
  }));
}

function declared(selector: string, property: string): string {
  const values = rules(css)
    .filter((rule) => rule.selectors.includes(selector) && property in rule.body)
    .map((rule) => rule.body[property]);
  expect(values.length, `${selector} sets ${property}`).toBeGreaterThan(0);
  return values.at(-1)!;
}

// The host variables of the demo in both themes, and the Custom palette of the playground.
const tokens = rules(read("tokens.css", join(import.meta.dirname, "..", "styles")));
const custom = rules(read("playground.css", join(import.meta.dirname, "..", "demo")));
const host = { light: tokens[0].body, dark: tokens[1].body };
const palettes: Record<string, Palette> = {
  "host, light": host.light,
  "host, dark": host.dark,
  "custom, light": { ...custom[0].body },
  "custom, dark": { ...custom[1].body },
};

// The private variables take a host variable. A Custom palette sets some of them again.
const privateDefinitions = Object.fromEntries(
  rules(css)
    .filter((rule) => rule.selectors.includes(".archify-diagram"))
    .flatMap((rule) => Object.entries(rule.body))
    .filter(([name]) => name.startsWith("--archify-"))
    .map(([name, value]) => [name, value.match(/var\(\s*(--[\w-]+)/)?.[1] ?? value]),
);

function colour(palette: string, expression: string): string {
  const name = expression.match(/var\(\s*(--archify-[\w-]+)/)?.[1];
  expect(name, `${expression} reads a private variable`).toBeDefined();
  const base = palette.endsWith("light") ? host.light : host.dark;
  const own = palettes[palette][name!] ?? base[privateDefinitions[name!]];
  expect(own, `${name} has a value in ${palette}`).toMatch(/^#[0-9a-f]{6}$/i);
  return own;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe("the contrast of the stylesheet", () => {
  for (const palette of Object.keys(palettes)) {
    it(`draws the border of a lane with at least 3 to 1 against its fill (${palette})`, () => {
      const border = declared(".archify-lane", "border");
      const fill = declared(".archify-lane", "background");
      expect(contrast(colour(palette, border), colour(palette, fill))).toBeGreaterThanOrEqual(3);
    });

    it(`reads the label of a lane at least 4.5 to 1 against its fill (${palette})`, () => {
      const text = declared(".archify-lane__label", "color");
      const fill = declared(".archify-lane", "background");
      expect(contrast(colour(palette, text), colour(palette, fill))).toBeGreaterThanOrEqual(4.5);
    });

    for (const [name, selector] of [
      ["a node under the pointer", ".archify-node:hover"],
      ["a selected node", ".archify-node--selected"],
    ]) {
      it(`keeps the contrast of ${name} (${palette})`, () => {
        const fill = colour(palette, declared(selector, "background"));
        const text = colour(palette, declared(selector, "color"));
        const border = colour(palette, declared(selector, "border-color"));
        expect(contrast(text, fill), "text").toBeGreaterThanOrEqual(4.5);
        expect(contrast(border, fill), "border").toBeGreaterThanOrEqual(3);
      });
    }

    it(`gives a node under the pointer another fill than a selected node (${palette})`, () => {
      const hover = colour(palette, declared(".archify-node:hover", "background"));
      const selected = colour(palette, declared(".archify-node--selected", "background"));
      expect(hover.toLowerCase()).not.toBe(selected.toLowerCase());
    });
  }

  it("marks a selected node with more than a colour, and a node under the pointer with less", () => {
    const selected = rules(css).filter((rule) =>
      rule.selectors.includes(".archify-node--selected"),
    );
    const hover = rules(css).filter((rule) => rule.selectors.includes(".archify-node:hover"));
    expect(selected.some((rule) => rule.body["font-weight"] === "700")).toBe(true);
    expect(selected.some((rule) => /inset/.test(rule.body["box-shadow"] ?? ""))).toBe(true);
    expect(hover.some((rule) => "font-weight" in rule.body || "box-shadow" in rule.body)).toBe(
      false,
    );
  });
});

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
