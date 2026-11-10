import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WorkflowDiagram from "./WorkflowDiagram";
import type { DiagramEdge, DiagramSpec } from "./spec";

function specWith(edge: Partial<DiagramEdge>): DiagramSpec {
  return {
    version: 1,
    nodes: [
      { id: "alpha", label: "Alpha" },
      { id: "beta", label: "Beta" },
    ],
    edges: [{ id: "e1", source: "alpha", target: "beta", ...edge }],
  };
}

// The test draws the real registered edge, with the real layout.
async function draw(spec: DiagramSpec) {
  const view = render(
    <WorkflowDiagram
      spec={spec}
      selectedId={null}
      onSelect={() => {}}
      height={400}
      ariaLabel="Decision trace"
    />,
  );
  await screen.findByRole("button", { name: /Beta/ });
  return view.container;
}

function stubReducedMotion(reduce: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  return matchMedia;
}

describe("animated edge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("has exactly one animateMotion element when animated is true", async () => {
    const container = await draw(specWith({ animated: true }));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(1);
  });

  it("moves the dot along the path that the edge draws", async () => {
    const container = await draw(specWith({ animated: true }));
    const path = container.querySelector(".archify-edge")?.getAttribute("d");
    const motion = container.querySelector("animateMotion");
    expect(path).toBeTruthy();
    expect(motion?.getAttribute("path")).toBe(path);
    expect(motion?.parentElement?.tagName.toLowerCase()).toBe("circle");
    expect(motion?.parentElement).toHaveClass("archify-edge-dot");
  });

  it("has no animateMotion element when animated is not set", async () => {
    const container = await draw(specWith({}));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(0);
  });

  it("has no animateMotion element on a skipped edge, also when animated is true", async () => {
    const container = await draw(specWith({ state: "skipped", animated: true }));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(0);
  });

  it("has no animateMotion element on a failed edge, also when animated is true", async () => {
    const container = await draw(specWith({ state: "failed", animated: true }));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(0);
  });

  it("has no animateMotion element when the user prefers reduced motion", async () => {
    const matchMedia = stubReducedMotion(true);
    const container = await draw(specWith({ animated: true }));
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(container.querySelectorAll("animateMotion")).toHaveLength(0);
  });

  it("keeps the animateMotion element when the user does not prefer reduced motion", async () => {
    stubReducedMotion(false);
    const container = await draw(specWith({ animated: true }));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(1);
  });
});
