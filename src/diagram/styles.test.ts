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
// A rule is chosen by its selector, so a new rule in a file does not change the palettes.
const bodyOf = (list: ReturnType<typeof rules>, selector: string): Palette => {
  const rule = list.find((r) => r.selectors.includes(selector));
  expect(rule, `a rule for ${selector}`).toBeDefined();
  return rule!.body;
};
const host = { light: bodyOf(tokens, ":root"), dark: bodyOf(tokens, ".dark") };
const palettes: Record<string, Palette> = {
  "host, light": host.light,
  "host, dark": host.dark,
  "custom, light": bodyOf(custom, ".playground--custom .archify-diagram"),
  "custom, dark": bodyOf(custom, ".dark .playground--custom .archify-diagram"),
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

// A small cascade for the simple selectors of the node rules: classes, attributes and :hover.
// It tells which declaration wins for one element, so the test sees an order or a weight problem.
interface Subject {
  classes: string[];
  attrs: Record<string, string>;
  pseudos: string[];
}

function parseSimple(selector: string): Subject | null {
  const parts = [...selector.matchAll(/\.([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]|:([\w-]+)/g)];
  if (parts.map((part) => part[0]).join("") !== selector) return null;
  const subject: Subject = { classes: [], attrs: {}, pseudos: [] };
  for (const [, cls, attr, value, pseudo] of parts) {
    if (cls) subject.classes.push(cls);
    else if (attr) subject.attrs[attr] = value ?? "";
    else subject.pseudos.push(pseudo);
  }
  return subject;
}

function resolve(element: Subject): Palette {
  const winner: Record<string, { weight: number; order: number; value: string }> = {};
  rules(css).forEach((rule, order) => {
    for (const selector of rule.selectors) {
      const simple = parseSimple(selector);
      if (!simple) continue;
      const matches =
        simple.classes.every((c) => element.classes.includes(c)) &&
        Object.entries(simple.attrs).every(([name, value]) =>
          value === "" ? name in element.attrs : element.attrs[name] === value,
        ) &&
        simple.pseudos.every((p) => element.pseudos.includes(p));
      if (!matches) continue;
      const weight =
        simple.classes.length + Object.keys(simple.attrs).length + simple.pseudos.length;
      for (const [property, value] of Object.entries(rule.body)) {
        const now = winner[property];
        // A later rule wins a tie.
        if (!now || weight >= now.weight) winner[property] = { weight, order, value };
      }
    }
  });
  return Object.fromEntries(Object.entries(winner).map(([name, { value }]) => [name, value]));
}

const STATES = ["used", "skipped", "failed"] as const;
const node = (state: string, ...modes: Array<"selected" | "hover">): Subject => ({
  classes: ["archify-node", ...(modes.includes("selected") ? ["archify-node--selected"] : [])],
  attrs: { "data-state": state },
  pseudos: modes.includes("hover") ? ["hover"] : [],
});

describe("the contrast of the stylesheet", () => {
  for (const palette of Object.keys(palettes)) {
    it(`draws the border of a lane with at least 3 to 1 against its fill (${palette})`, () => {
      const border = declared(".archify-lane", "border");
      const fill = declared(".archify-lane", "background");
      expect(contrast(colour(palette, border), colour(palette, fill))).toBeGreaterThanOrEqual(3);
    });

    // The label sits above the lane box, on the canvas of the diagram, not on the fill of the lane.
    it(`reads the label of a lane at least 4.5 to 1 against the canvas (${palette})`, () => {
      const text = declared(".archify-lane__label", "color");
      const canvas = declared(".archify-diagram", "--xy-background-color");
      expect(contrast(colour(palette, text), colour(palette, canvas))).toBeGreaterThanOrEqual(4.5);
    });

    it(`keeps the contrast of a node under the pointer, with the fill of a plain node (${palette})`, () => {
      const hover = resolve(node("used", "hover"));
      const plain = resolve(node("used"));
      const fill = colour(palette, hover.background);
      expect(hover.background, "the pointer does not change the fill").toBe(plain.background);
      expect(contrast(colour(palette, hover.color), fill), "text").toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colour(palette, hover["border-color"]), fill),
        "border",
      ).toBeGreaterThanOrEqual(3);
      // The fill of a lane equals the muted fill, and a hover cue must also show there.
      const lane = colour(palette, declared(".archify-lane", "background"));
      expect(
        contrast(colour(palette, hover["border-color"]), lane),
        "border on a lane",
      ).toBeGreaterThanOrEqual(3);
    });

    it(`keeps the contrast of a selected node (${palette})`, () => {
      const selected = resolve(node("used", "selected"));
      const fill = colour(palette, selected.background);
      expect(contrast(colour(palette, selected.color), fill), "text").toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(colour(palette, selected["border-color"]), fill),
        "border",
      ).toBeGreaterThanOrEqual(3);
      const inner = [...selected["box-shadow"].matchAll(/var\((--archify-[\w-]+)\)/g)].at(-1)![1];
      expect(contrast(colour(palette, `var(${inner})`), fill), "inner line").toBeGreaterThanOrEqual(
        3,
      );
    });

    it(`gives a node under the pointer another fill than a selected node (${palette})`, () => {
      const hover = colour(palette, resolve(node("used", "hover")).background);
      const selected = colour(palette, resolve(node("used", "selected")).background);
      expect(hover.toLowerCase()).not.toBe(selected.toLowerCase());
    });
  }

  // The test reads the text of the CSS. The e2e tests check the effect in a browser (computed styles).
  for (const state of STATES) {
    it(`shows a node under the pointer and a selected node by more than the fill (${state})`, () => {
      const plain = resolve(node(state));
      const hover = resolve(node(state, "hover"));
      const selected = resolve(node(state, "selected"));
      expect(hover["box-shadow"], "hover adds an inner line").not.toBe(plain["box-shadow"]);
      expect(hover["box-shadow"], "hover differs from selected").not.toBe(selected["box-shadow"]);
      expect(selected["font-weight"], "selected is bold").toBe("700");
      expect(hover["font-weight"], "hover keeps the weight").toBe(plain["font-weight"]);
    });

    it(`lets a selected node keep its look under the pointer (${state})`, () => {
      const selected = resolve(node(state, "selected"));
      const hovered = resolve(node(state, "selected", "hover"));
      for (const property of ["background", "color", "border-color", "box-shadow", "font-weight"]) {
        expect(hovered[property], `${property} of a selected ${state} node under the pointer`).toBe(
          selected[property],
        );
      }
      expect(selected.background).toBe(declared(".archify-node--selected", "background"));
    });
  }

  it("has a rule for a selected node under the pointer", () => {
    const selectors = rules(css).flatMap((rule) => rule.selectors);
    expect(selectors).toContain(".archify-node--selected:hover");
    expect(selectors).toContain(".archify-node--selected[data-state]:hover");
    expect(selectors).toContain('.archify-node--selected[data-state="failed"]:hover');
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

  it("ends a lane label that is too long with an ellipsis, inside the lane", () => {
    const label = ".archify-lane__label";
    expect(declared(label, "overflow")).toBe("hidden");
    expect(declared(label, "text-overflow")).toBe("ellipsis");
    expect(declared(label, "white-space")).toBe("nowrap");
    expect(declared(label, "max-width")).toBe("100%");
  });

  it("lets the label of a lane receive the pointer, so that its title shows", () => {
    // React Flow gives a lane node pointer-events none, and a child inherits the value.
    expect(declared(".archify-lane__label", "pointer-events")).toBe("auto");
  });

  it("lets a vertical swipe on a touch device scroll the page", () => {
    // React Flow sets touch-action none on the pane, and a node under it gets the same effective value. This rule must win by its specificity.
    const media = css.match(
      /@media\s*\(\s*pointer\s*:\s*coarse\s*\)\s*\{\s*\.archify-diagram \.react-flow__pane\s*\{([^}]*)\}/,
    );
    expect(media, "a coarse pointer rule for the pane").not.toBeNull();
    expect(media![1]).toMatch(/touch-action\s*:\s*pan-y\s*;/);
  });
});
