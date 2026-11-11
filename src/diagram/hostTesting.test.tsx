import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transformWithOxc } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowDiagram from "./WorkflowDiagram";
import type { DiagramSpec } from "./spec";

// This file proves the section "Test a host" of README.md. A host that does not load the
// setup file of this repository gets only what jsdom has. The test removes the stubs of the
// setup file, and then it runs the code block of the README, so the README cannot drift.

const readme = readFileSync(join(import.meta.dirname, "../../README.md"), "utf8");
const block = /```ts host-stubs\n([\s\S]*?)\n```/.exec(readme)?.[1];

async function installReadmeStubs(): Promise<void> {
  if (block === undefined) throw new Error("README.md has no code block tagged `ts host-stubs`.");
  const { code } = await transformWithOxc(block, "host-stubs.ts");
  new Function(code)();
}

const g = globalThis as { ResizeObserver?: unknown; DOMMatrixReadOnly?: unknown };
const saved = {
  ResizeObserver: g.ResizeObserver,
  DOMMatrixReadOnly: g.DOMMatrixReadOnly,
  getBBox: Object.getOwnPropertyDescriptor(SVGElement.prototype, "getBBox"),
};

function removeAllStubs(): void {
  delete g.ResizeObserver;
  delete g.DOMMatrixReadOnly;
  delete (SVGElement.prototype as { getBBox?: unknown }).getBBox;
}

beforeEach(() => {
  removeAllStubs();
  // React reports an error in an effect to the window. Keep the output of the test clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  removeAllStubs();
  g.ResizeObserver = saved.ResizeObserver;
  g.DOMMatrixReadOnly = saved.DOMMatrixReadOnly;
  if (saved.getBBox) Object.defineProperty(SVGElement.prototype, "getBBox", saved.getBBox);
  vi.restoreAllMocks();
});

const spec: DiagramSpec = {
  version: 1,
  nodes: [
    { id: "a", label: "Receive request" },
    { id: "b", label: "Send answer" },
  ],
  edges: [{ id: "e1", source: "a", target: "b", label: "yes" }],
};

// Draws the diagram, waits for the layout, and then changes the direction. The change
// moves the handles of the nodes, and React Flow reads the zoom when that happens.
// Returns the errors that jsdom or React reported on the way.
async function drawAndTurn(onSelect: (id: string | null) => void = () => {}): Promise<unknown[]> {
  const errors: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    errors.push(event.error);
  };
  window.addEventListener("error", onError);
  const element = (value: DiagramSpec) => (
    <WorkflowDiagram
      spec={value}
      selectedId={null}
      onSelect={onSelect}
      height={300}
      ariaLabel="Trace"
    />
  );
  try {
    const { rerender } = render(element(spec));
    await waitFor(() => {
      if (errors.length === 0) {
        expect(screen.getByRole("button", { name: /Send answer/ })).toBeInTheDocument();
      }
    });
    if (errors.length === 0) {
      rerender(element({ ...spec, direction: "DOWN" }));
      await waitFor(() => {
        expect(screen.getByRole("group", { name: "Trace" })).not.toHaveAttribute("aria-busy");
      });
      // The handles move in the next render after the new layout.
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    errors.push(error);
  } finally {
    window.removeEventListener("error", onError);
  }
  return errors;
}

describe("a host that tests WorkflowDiagram under jsdom", () => {
  it("has the stub block in the README", () => {
    expect(block).toBeDefined();
  });

  it("draws the diagram with the stubs of the README", async () => {
    await installReadmeStubs();
    const onSelect = vi.fn();
    expect(await drawAndTurn(onSelect)).toEqual([]);
    expect(screen.getByRole("button", { name: /Receive request/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Send answer/ }));
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it.each([
    ["ResizeObserver", () => delete g.ResizeObserver, /ResizeObserver/],
    ["DOMMatrixReadOnly", () => delete g.DOMMatrixReadOnly, /DOMMatrixReadOnly/],
    ["getBBox", () => delete (SVGElement.prototype as { getBBox?: unknown }).getBBox, /getBBox/],
  ])("fails when the stub for %s is missing", async (_name, remove, message) => {
    await installReadmeStubs();
    remove();
    const errors = await drawAndTurn();
    expect(errors.length).toBeGreaterThan(0);
    expect(String(errors[0])).toMatch(message);
  });

  it("shows the wait signals of the README", async () => {
    await installReadmeStubs();
    const element = (value: DiagramSpec) => (
      <WorkflowDiagram
        spec={value}
        selectedId={null}
        onSelect={() => {}}
        height={300}
        ariaLabel="Trace"
      />
    );
    const { rerender } = render(element(spec));
    const group = screen.getByRole("group", { name: "Trace" });
    // Before the layout, the group is busy and has no node.
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: /Receive request/ })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: /Receive request/ }, { timeout: 5000 });
    expect(group).not.toHaveAttribute("aria-busy");

    // After a change of the layout, the old layout stays while the next layout runs.
    const next: DiagramSpec = {
      ...spec,
      nodes: [...spec.nodes, { id: "c", label: "Log result" }],
    };
    rerender(element(next));
    expect(group).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: /Send answer/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Log result/ })).not.toBeInTheDocument();
    await waitFor(() => expect(group).not.toHaveAttribute("aria-busy"), { timeout: 5000 });
    expect(screen.getByRole("button", { name: /Log result/ })).toBeInTheDocument();
  });
});
