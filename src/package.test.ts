import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The test builds and packs the real package. Only the packed files show what a consumer gets.
// The test owns dist/: it runs build:lib, which writes dist/ again.
const root = process.cwd();
let work = "";
let pkgDir = "";
let tarballEntries: string[] = [];
let manifest: Record<string, unknown> = {};
let indexJs = "";
let indexDts = "";

function readPacked(file: string): string {
  return readFileSync(join(pkgDir, file), "utf8");
}

beforeAll(() => {
  // The directory is outside the repository, so the test never leaves a file in the tree.
  work = mkdtempSync(join(tmpdir(), "archify-pack-"));
  execFileSync("pnpm", ["build:lib"], { cwd: root, stdio: "pipe" });
  execFileSync("pnpm", ["pack", "--pack-destination", work], { cwd: root, stdio: "pipe" });
  const tarball = readdirSync(work).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("pnpm pack made no tarball in " + work);
  const tarPath = join(work, tarball);
  tarballEntries = execFileSync("tar", ["-tzf", tarPath], { cwd: work, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  execFileSync("tar", ["-xzf", tarPath], { cwd: work });
  pkgDir = join(work, "package");
  manifest = JSON.parse(readPacked("package.json"));
  indexJs = readPacked("dist/index.js");
  indexDts = readPacked("dist/index.d.ts");
}, 600_000);

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

describe("packed package", () => {
  it("has the built files", () => {
    expect(tarballEntries).toContain("package/dist/index.js");
    expect(tarballEntries).toContain("package/dist/index.d.ts");
    expect(tarballEntries).toContain("package/dist/styles.css");
  });

  it("keeps React out of dist/index.js and keeps it as an external import", () => {
    // Static imports of React packages must be bare specifiers that the consumer resolves.
    const specifiers = [...indexJs.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    expect(specifiers).toContain("react");
    expect(specifiers).toContain("react/jsx-runtime");

    // Any import of a React package must be one of the bare external names.
    const reactImports = specifiers.filter((s) => /^react(-dom)?(\/|$)/.test(s));
    const allowed = ["react", "react/jsx-runtime", "react-dom", "react-dom/client"];
    expect(reactImports.every((s) => allowed.includes(s))).toBe(true);
    expect(indexJs).not.toMatch(/require\(\s*["']react/);

    // These strings exist only in the code of React itself.
    expect(indexJs).not.toContain("__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED");
    expect(indexJs).not.toContain("react.element");
    expect(indexJs).not.toContain("react.transitional.element");
  });

  it("leaves the dependencies and the demo out of dist/index.js", () => {
    expect(indexJs).toMatch(/from\s*["']@xyflow\/react["']/);
    expect(indexJs).toMatch(/import\(\s*["']elkjs\/lib\/elk\.bundled\.js["']\s*\)/);
    expect(indexJs).not.toContain("lucide");
    expect(indexJs).not.toContain("@radix-ui");
    expect(indexJs).not.toContain("src/demo");
  });

  it("lists React as a peer dependency and not as a dependency", () => {
    const peers = manifest.peerDependencies as Record<string, string>;
    const deps = (manifest.dependencies ?? {}) as Record<string, string>;
    expect(peers).toHaveProperty("react");
    expect(peers).toHaveProperty("react-dom");
    expect(deps).not.toHaveProperty("react");
    expect(deps).not.toHaveProperty("react-dom");
    expect(Object.keys(deps)).not.toContain("react");
    expect(Object.keys(deps)).not.toContain("react-dom");
    expect(Object.keys(deps)).toContain("@xyflow/react");
    expect(Object.keys(deps)).toContain("elkjs");
  });

  it("points exports and types at files inside the tarball", () => {
    const exportsField = manifest.exports as Record<string, unknown>;
    const dot = exportsField["."] as { types: string; import: string };
    const targets = [dot.types, dot.import, exportsField["./styles.css"], manifest.types];
    for (const target of targets) {
      expect(typeof target).toBe("string");
      expect(existsSync(join(pkgDir, target as string)), String(target)).toBe(true);
    }
    expect(dot.types).toBe("./dist/index.d.ts");
    expect(dot.import).toBe("./dist/index.js");
    expect(exportsField["./styles.css"]).toBe("./dist/styles.css");
  });

  it("imports no CSS file from the JavaScript or the declarations", () => {
    const files = tarballEntries
      .map((entry) => entry.replace(/^package\//, ""))
      .filter((file) => file === "dist/index.js" || file.endsWith(".d.ts"));
    expect(files.length).toBeGreaterThan(1);
    for (const file of files) {
      expect(readPacked(file), file).not.toMatch(/["'][^"']*\.css["']/);
    }
  });

  it("puts the diagram rules and the React Flow base rules in dist/styles.css", () => {
    const css = readPacked("dist/styles.css");
    expect(css).toContain(".archify-node");
    // The diagram styles never name this class, so it comes from the React Flow base rules.
    expect(css).toContain(".react-flow__container");
    expect(css).not.toMatch(/@import/);
  });

  it("declares the public names", () => {
    for (const name of [
      "WorkflowDiagram",
      "DiagramSpec",
      "layoutDiagram",
      "findOverlaps",
      "reach",
      "validateSpec",
      "DiagramLane",
      "LaneBox",
      "EdgeSection",
      "ProblemCode",
      "MAX_NODES",
      "MAX_EDGES",
      "MAX_LABEL_LENGTH",
    ]) {
      expect(indexDts, name).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });
});
