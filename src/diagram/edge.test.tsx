import { afterEach, describe, it, expect, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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

// A media query list that keeps its listeners, so a test can change the preference.
function stubLiveMotionQuery(reduce: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: reduce,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn(() => list);
  vi.stubGlobal("matchMedia", matchMedia);
  return {
    matchMedia,
    listeners,
    change(next: boolean) {
      list.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

function specWithAnimatedEdges(count: number): DiagramSpec {
  const nodes = Array.from({ length: count + 1 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
  nodes[1].label = "Beta";
  const edges = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    source: `n${i}`,
    target: `n${i + 1}`,
    animated: true,
  }));
  return { version: 1, nodes, edges };
}

describe("reduced motion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes the dot when the user turns on reduced motion while the diagram shows", async () => {
    const motion = stubLiveMotionQuery(false);
    const container = await draw(specWith({ animated: true }));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(1);
    act(() => motion.change(true));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(0);
  });

  it("removes the media query listener when the diagram unmounts", async () => {
    const motion = stubLiveMotionQuery(false);
    render(
      <WorkflowDiagram
        spec={specWith({ animated: true })}
        selectedId={null}
        onSelect={() => {}}
        height={400}
        ariaLabel="Decision trace"
      />,
    );
    await screen.findByRole("button", { name: /Beta/ });
    expect(motion.listeners.size).toBeGreaterThan(0);
    cleanup();
    expect(motion.listeners.size).toBe(0);
  });

  it("makes one media query list for all the edges", async () => {
    const motion = stubLiveMotionQuery(false);
    const container = await draw(specWithAnimatedEdges(3));
    expect(container.querySelectorAll("animateMotion")).toHaveLength(3);
    expect(motion.matchMedia).toHaveBeenCalledTimes(1);
  });
});

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

describe("edge arrow and label", () => {
  it("ends with an arrowhead that takes its colour from the state of the edge", async () => {
    const container = await draw(specWith({ state: "failed" }));
    const markerEnd = container.querySelector(".archify-edge")?.getAttribute("marker-end");
    const id = markerEnd?.match(/^url\(#(.+)\)$/)?.[1];
    expect(id).toBeTruthy();
    const marker = container.querySelector(`marker[id="${id}"]`);
    expect(marker).toHaveClass("archify-arrow");
    expect(marker).toHaveAttribute("data-state", "failed");
  });

  it("draws the label last in the edge group, so the dot never covers it", async () => {
    const container = await draw(specWith({ label: "yes", animated: true }));
    const group = container.querySelector(".archify-edge-group");
    expect(group).not.toBeNull();
    const children = Array.from(group!.children);
    const dot = children.findIndex((child) => child.classList.contains("archify-edge-dot"));
    const path = children.findIndex((child) => child.classList.contains("archify-edge"));
    expect(path).toBeGreaterThanOrEqual(0);
    expect(dot).toBeGreaterThan(path);
    expect(children.at(-1)).toHaveClass("react-flow__edge-textwrapper");
    expect(group!.querySelectorAll("animateMotion")).toHaveLength(1);
  });

  it("puts the label in the middle of the edge, not at its end", async () => {
    const container = await draw(specWith({ label: "yes" }));
    const path = container.querySelector(".archify-edge")?.getAttribute("d") ?? "";
    const xs = [...path.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[1]));
    const label = container.querySelector(".react-flow__edge-text");
    const x = Number(
      label?.parentElement?.getAttribute("transform")?.match(/translate\((-?[\d.]+)/)?.[1],
    );
    expect(xs.length).toBeGreaterThanOrEqual(2);
    expect(x).toBeGreaterThan(Math.min(...xs));
    expect(x).toBeLessThan(Math.max(...xs));
  });
});
