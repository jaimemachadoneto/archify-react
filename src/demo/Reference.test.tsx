import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_EDGES, MAX_LABEL_LENGTH, MAX_NODES, MAX_POSITION, PROBLEM_CODES } from "@/diagram";
import Reference from "./Reference";

// The ?raw import of a CSS file gives an empty string under Vitest, so the test reads the files.
const read = (path: string) => readFileSync(join(import.meta.dirname, path), "utf8");
const readme = read("../../README.md");
const styles = read("../diagram/styles.css");

// The cells of the first table that follows a line of the README, without the header.
// A cell loses its backticks and its escaped bars, like the text that the page shows.
function readmeTable(marker: string): string[][] {
  const lines = readme.split("\n");
  const at = lines.findIndex((line) => line.startsWith(marker));
  expect(at, `README.md has the line "${marker}"`).toBeGreaterThanOrEqual(0);
  const rows: string[][] = [];
  for (const line of lines.slice(at)) {
    if (line.startsWith("|")) {
      rows.push(
        line
          .slice(1, -1)
          .split(/(?<!\\)\|/)
          .map((cell) => cell.trim().replace(/\\\|/g, "|").replace(/`/g, "")),
      );
    } else if (rows.length > 0) {
      break;
    }
  }
  return rows.slice(2);
}

// The cells of the body rows of one table on the page.
function pageTable(name: string): string[][] {
  const table = screen.getByRole("table", { name });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent ?? ""));
}

// The host variables that the stylesheet reads, with the fallback of each one.
function stylesheetVariables(): Array<{ name: string; fallback: string }> {
  const source = styles.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = /\.archify-diagram,\s*\.archify-alert\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
  return [...block.matchAll(/--archify-[\w-]+:\s*var\((--[\w-]+),\s*([^;]+)\);/g)].map(
    ([, name, fallback]) => ({ name, fallback: fallback.trim() }),
  );
}

beforeEach(() => {
  render(<Reference />);
});

describe("Reference", () => {
  it("has a heading for the page and one for each part", () => {
    expect(screen.getByRole("heading", { level: 2, name: "Reference" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Props", "Functions", "Problem codes", "Limits", "Host variables"]);
  });

  it("links to each part, and each link goes to a section with that ID", () => {
    const contents = screen.getByRole("navigation", { name: "Contents" });
    const links = within(contents).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Props",
      "Functions",
      "Problem codes",
      "Limits",
      "Host variables",
    ]);
    for (const link of links) {
      // A hash that starts with "reference" keeps the page open, so the link never leaves it.
      const id = link.getAttribute("href")!.slice(1);
      expect(id).toMatch(/^reference-/);
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it("shows the props like the README does", () => {
    const rows = pageTable("Props of WorkflowDiagram");
    expect(rows.length).toBe(6);
    expect(rows).toEqual(readmeTable("The root element of the component"));
  });

  it("shows the four functions with a signature and the job from the README", () => {
    const rows = pageTable("Functions");
    expect(rows.map(([signature]) => signature.split("(")[0])).toEqual([
      "validateSpec",
      "layoutDiagram",
      "findOverlaps",
      "reach",
    ]);
    const jobs = new Map(
      readmeTable("The library exports four functions").map((row) => [
        row[0].split("(")[0],
        row[2],
      ]),
    );
    for (const [signature, job] of rows) {
      expect(job).toBe(jobs.get(signature.split("(")[0]));
    }
    expect(rows[0][0]).toBe("validateSpec(spec: unknown): Problem[]");
    expect(rows[1][0]).toBe("layoutDiagram(spec: DiagramSpec): Promise<LayoutResult>");
    expect(rows[2][0]).toBe(
      "findOverlaps(result: LayoutResult): Array<{ nodeA: string; nodeB: string }>",
    );
    expect(rows[3][0]).toBe(
      'reach(spec: DiagramSpec, id: string, direction: "upstream" | "downstream"): string[]',
    );
  });

  it("lists each problem code of the library with the meaning from the README", () => {
    const rows = pageTable("Problem codes");
    expect(rows.map(([code]) => code)).toEqual([...PROBLEM_CODES]);
    expect(rows).toEqual(readmeTable("| Code "));
  });

  it("shows the limits that the library exports", () => {
    expect(pageTable("Limits").map(([name, value]) => [name, value])).toEqual([
      ["MAX_NODES", String(MAX_NODES)],
      ["MAX_EDGES", String(MAX_EDGES)],
      ["MAX_LABEL_LENGTH", String(MAX_LABEL_LENGTH)],
      ["MAX_POSITION", String(MAX_POSITION)],
    ]);
  });

  it("lists the host variables that the stylesheet reads, with the same fallback", () => {
    const rows = pageTable("Host variables");
    const variables = stylesheetVariables();
    expect(variables).toHaveLength(14);
    expect(rows.map(([name, fallback]) => ({ name, fallback }))).toEqual(variables);
    expect(rows).toEqual(readmeTable("| Host variable"));
  });

  it("puts each table in a region that a keyboard user can scroll", () => {
    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(5);
    for (const region of regions) {
      expect(region).toHaveAttribute("tabindex", "0");
      expect(within(region).getAllByRole("table")).toHaveLength(1);
    }
  });
});
