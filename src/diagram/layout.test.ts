import { describe, it, expect } from "vitest";
import { layoutDiagram, findOverlaps } from "./layout";
import { DiagramSpec } from "./spec";

describe("layoutDiagram", () => {
  it("should work", async () => {
    const spec: DiagramSpec = {
      version: 1,
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };
    const result = await layoutDiagram(spec);
    expect(result).toBeDefined();
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it("places two nodes with one source on the same layer (Jev and Kev case)", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "jev", label: "Jev" },
        { id: "kev", label: "Kev" },
        { id: "source", label: "Source" },
      ],
      edges: [
        { id: "e1", source: "source", target: "jev" },
        { id: "e2", source: "source", target: "kev" },
      ],
    };
    const result = await layoutDiagram(spec);
    const jev = result.nodes.find((n) => n.id === "jev")!;
    const kev = result.nodes.find((n) => n.id === "kev")!;
    // With direction RIGHT a layer is a column, so the same layer means the same x.
    expect(jev.x).toBe(kev.x);
  });

  it("returns empty overlaps for a simple line", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };
    const result = await layoutDiagram(spec);
    const overlaps = findOverlaps(result);
    expect(overlaps).toHaveLength(0);
  });

  it("returns empty overlaps for a fork", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "source", label: "Source" },
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
      edges: [
        { id: "e1", source: "source", target: "a" },
        { id: "e2", source: "source", target: "b" },
      ],
    };
    const result = await layoutDiagram(spec);
    const overlaps = findOverlaps(result);
    expect(overlaps).toHaveLength(0);
  });

  it("returns empty overlaps for a join", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "target", label: "Target" },
      ],
      edges: [
        { id: "e1", source: "a", target: "target" },
        { id: "e2", source: "b", target: "target" },
      ],
    };
    const result = await layoutDiagram(spec);
    const overlaps = findOverlaps(result);
    expect(overlaps).toHaveLength(0);
  });

  it("returns empty overlaps for a cycle", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "DOWN",
      nodes: [
        { id: "start", label: "Start" },
        { id: "step1", label: "Step 1" },
        { id: "decision", label: "Decision" },
        { id: "retry", label: "Retry" },
      ],
      edges: [
        { id: "e1", source: "start", target: "step1" },
        { id: "e2", source: "step1", target: "decision" },
        { id: "e3", source: "decision", target: "retry" },
        { id: "e4", source: "retry", target: "decision" },
      ],
    };
    const result = await layoutDiagram(spec);
    const overlaps = findOverlaps(result);
    expect(overlaps).toHaveLength(0);
  });

  it("places lane nodes inside their lane box", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      lanes: [
        { id: "lane1", label: "Lane 1" },
        { id: "lane2", label: "Lane 2" },
      ],
      nodes: [
        { id: "a", label: "A", lane: "lane1" },
        { id: "b", label: "B", lane: "lane1" },
        { id: "c", label: "C", lane: "lane2" },
        { id: "d", label: "D", lane: "lane2" },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
        { id: "e3", source: "c", target: "d" },
      ],
    };
    const result = await layoutDiagram(spec);
    expect(result.lanes.map((l) => l.id).sort()).toEqual(["lane1", "lane2"]);
    for (const node of result.nodes) {
      const box = result.lanes.find((l) => l.id === node.lane)!;
      expect(box).toBeDefined();
      expect(node.x).toBeGreaterThanOrEqual(box.x);
      expect(node.x + node.width).toBeLessThanOrEqual(box.x + box.width);
      expect(node.y).toBeGreaterThanOrEqual(box.y);
      expect(node.y + node.height).toBeLessThanOrEqual(box.y + box.height);
    }
  });

  it("keeps a node with fixed position at that position", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "fixed", label: "Fixed", position: { x: 100, y: 200 } },
        { id: "other", label: "Other" },
      ],
      edges: [{ id: "e1", source: "fixed", target: "other" }],
    };
    const result = await layoutDiagram(spec);
    const fixed = result.nodes.find((n) => n.id === "fixed")!;
    expect(fixed.x).toBe(100);
    expect(fixed.y).toBe(200);
  });

  it("keeps an absolute fixed position for a node inside a lane", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      lanes: [{ id: "lane1", label: "Lane 1" }],
      nodes: [
        { id: "a", label: "A", lane: "lane1" },
        { id: "b", label: "B", lane: "lane1", position: { x: 300, y: 120 } },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };
    const result = await layoutDiagram(spec);
    const b = result.nodes.find((n) => n.id === "b")!;
    expect(b.x).toBe(300);
    expect(b.y).toBe(120);
  });

  it("gives the same result for the same spec (deterministic)", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
        { id: "c", label: "C" },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
      ],
    };
    const result1 = await layoutDiagram(spec);
    const result2 = await layoutDiagram(spec);
    expect(result1.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))).toEqual(
      result2.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })),
    );
  });

  it("returns empty overlaps for a spec with lanes and a fixed position", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      lanes: [
        { id: "lane1", label: "Lane 1" },
        { id: "lane2", label: "Lane 2" },
      ],
      nodes: [
        { id: "a", label: "A", lane: "lane1" },
        { id: "b", label: "B", lane: "lane1" },
        { id: "c", label: "C", lane: "lane2" },
        { id: "d", label: "D", position: { x: 600, y: 400 } },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
        { id: "e3", source: "c", target: "d" },
      ],
    };
    const result = await layoutDiagram(spec);
    expect(findOverlaps(result)).toHaveLength(0);
  });
});
