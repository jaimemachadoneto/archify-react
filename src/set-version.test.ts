import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = join(import.meta.dirname, "..", "scripts", "set-version.sh");

let dir: string;

beforeEach(() => {
  // The script writes package.json in the current directory, so each test uses its own directory.
  dir = mkdtempSync(join(tmpdir(), "archify-set-version-"));
  copyFileSync(script, join(dir, "set-version.sh"));
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "demo", version: "0.1.0", scripts: { test: "x" } }, null, 2) + "\n",
  );
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const run = (...args: string[]) =>
  execFileSync("bash", [join(dir, "set-version.sh"), ...args], { cwd: dir, encoding: "utf8" });

const pkg = () => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));

describe("scripts/set-version.sh", () => {
  it("writes the version into package.json", () => {
    run("0.2.0");
    expect(pkg().version).toBe("0.2.0");
  });

  it("keeps every other field and the final newline", () => {
    run("1.0.0");
    expect(pkg()).toEqual({ name: "demo", version: "1.0.0", scripts: { test: "x" } });
    expect(readFileSync(join(dir, "package.json"), "utf8").endsWith("}\n")).toBe(true);
  });

  it("fails without a version, and leaves the file as it was", () => {
    expect(() => run()).toThrow();
    expect(pkg().version).toBe("0.1.0");
  });
});
