import { describe, it, expect } from "vitest";
import { layoutDiagram, findOverlaps, type LayoutResult } from "./layout";
import { DiagramSpec } from "./spec";

type PlacedNode = LayoutResult["nodes"][number];
type LaneBox = LayoutResult["lanes"][number];

function expectInside(node: PlacedNode, box: LaneBox): void {
  expect(node.x).toBeGreaterThanOrEqual(box.x);
  expect(node.x + node.width).toBeLessThanOrEqual(box.x + box.width);
  expect(node.y).toBeGreaterThanOrEqual(box.y);
  expect(node.y + node.height).toBeLessThanOrEqual(box.y + box.height);
}

describe("layoutDiagram", () => {
  it("returns one placed node per node and one edge per edge", async () => {
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

  it("places two nodes with one source on the same layer", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "alpha", label: "Alpha" },
        { id: "beta", label: "Beta" },
        { id: "gamma", label: "Gamma" },
      ],
      edges: [
        { id: "e1", source: "gamma", target: "alpha" },
        { id: "e2", source: "gamma", target: "beta" },
      ],
    };
    const result = await layoutDiagram(spec);
    const alpha = result.nodes.find((n) => n.id === "alpha")!;
    const beta = result.nodes.find((n) => n.id === "beta")!;
    const gamma = result.nodes.find((n) => n.id === "gamma")!;
    expect(gamma.x).toBeLessThan(alpha.x);
    expect(alpha.x).toBe(beta.x);
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

  it("places each node inside the box of its lane", async () => {
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
      expectInside(node, box);
    }
  });

  it("gives absolute edge coordinates for an edge in a lane and an edge that crosses lanes", async () => {
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
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "b", target: "c" },
      ],
    };
    const result = await layoutDiagram(spec);
    const margin = 5;
    for (const edge of result.edges) {
      const source = result.nodes.find((n) => n.id === edge.source)!;
      const target = result.nodes.find((n) => n.id === edge.target)!;
      const first = edge.sections[0].startPoint;
      const last = edge.sections[edge.sections.length - 1].endPoint;
      // A relative coordinate would be far from the box of the node.
      expect(first.x).toBeGreaterThanOrEqual(source.x - margin);
      expect(first.x).toBeLessThanOrEqual(source.x + source.width + margin);
      expect(first.y).toBeGreaterThanOrEqual(source.y - margin);
      expect(first.y).toBeLessThanOrEqual(source.y + source.height + margin);
      expect(last.x).toBeGreaterThanOrEqual(target.x - margin);
      expect(last.x).toBeLessThanOrEqual(target.x + target.width + margin);
      expect(last.y).toBeGreaterThanOrEqual(target.y - margin);
      expect(last.y).toBeLessThanOrEqual(target.y + target.height + margin);
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
    const a = result.nodes.find((n) => n.id === "a")!;
    const b = result.nodes.find((n) => n.id === "b")!;
    expect(b.x).toBe(300);
    expect(b.y).toBe(120);
    // The lane box grows to hold the fixed node and still holds the other node.
    const box = result.lanes.find((l) => l.id === "lane1")!;
    expectInside(a, box);
    expectInside(b, box);
  });

  it("returns no sections for an edge to or from a node with a fixed position", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "RIGHT",
      nodes: [
        { id: "a", label: "A" },
        { id: "b", label: "B", position: { x: 500, y: 300 } },
        { id: "c", label: "C" },
        { id: "d", label: "D" },
      ],
      edges: [
        { id: "to-fixed", source: "a", target: "b" },
        { id: "from-fixed", source: "b", target: "c" },
        { id: "free", source: "c", target: "d" },
      ],
    };
    const result = await layoutDiagram(spec);
    const sections = (id: string) => result.edges.find((e) => e.id === id)!.sections;
    // The route of ELK ends at the free place of the node, so the view draws between the handles.
    expect(sections("to-fixed")).toEqual([]);
    expect(sections("from-fixed")).toEqual([]);
    expect(sections("free").length).toBeGreaterThan(0);
  });

  it("gives the same result for the same spec (deterministic)", async () => {
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
        { id: "d", label: "D" },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e2", source: "a", target: "c" },
        { id: "e3", source: "c", target: "d", label: "next" },
      ],
    };
    const result1 = await layoutDiagram(spec);
    const result2 = await layoutDiagram(spec);
    expect(result1.edges.every((e) => e.sections.length > 0)).toBe(true);
    expect(result1.lanes).toHaveLength(2);
    expect(result2).toEqual(result1);
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

  it("keeps a node ID with the internal lane prefix apart from the lane", async () => {
    const spec: DiagramSpec = {
      version: 1,
      lanes: [{ id: "x", label: "X" }],
      nodes: [
        { id: "lane:x", label: "Lane-like ID" },
        { id: "a", label: "A", lane: "x" },
      ],
      edges: [{ id: "e1", source: "lane:x", target: "a" }],
    };
    const result = await layoutDiagram(spec);
    expect(result.lanes.map((l) => l.id)).toEqual(["x"]);
    const laneLike = result.nodes.find((n) => n.id === "lane:x")!;
    expect(Number.isFinite(laneLike.x)).toBe(true);
    expect(Number.isFinite(laneLike.y)).toBe(true);
    expectInside(
      result.nodes.find((n) => n.id === "a")!,
      result.lanes[0],
    );
    expect(result.edges[0].sections.length).toBeGreaterThan(0);
  });

  it("keeps a node ID equal to an edge ID or to the root ID apart", async () => {
    const spec: DiagramSpec = {
      version: 1,
      nodes: [
        { id: "root", label: "Root" },
        { id: "e1", label: "E1" },
      ],
      edges: [{ id: "e1", source: "root", target: "e1" }],
    };
    const result = await layoutDiagram(spec);
    expect(result.nodes.map((n) => n.id)).toEqual(["root", "e1"]);
    expect(result.edges[0].sections.length).toBeGreaterThan(0);
  });

  it("rejects a spec with an unknown edge target and names the problem", async () => {
    const spec: DiagramSpec = {
      version: 1,
      nodes: [{ id: "a", label: "A" }],
      edges: [{ id: "e1", source: "a", target: "missing" }],
    };
    await expect(layoutDiagram(spec)).rejects.toThrow(/"missing"/);
  });

  it("rejects a spec with a duplicate node ID and names each problem", async () => {
    const spec: DiagramSpec = {
      version: 1,
      nodes: [
        { id: "a", label: "A" },
        { id: "a", label: "A again" },
      ],
      edges: [{ id: "e1", source: "a", target: "ghost" }],
    };
    const error = await layoutDiagram(spec).then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/Node ID "a" occurs more than once/);
    expect((error as Error).message).toMatch(/"ghost"/);
  });

  it("places the layers on y for the direction DOWN", async () => {
    const spec: DiagramSpec = {
      version: 1,
      direction: "DOWN",
      nodes: [
        { id: "alpha", label: "Alpha" },
        { id: "beta", label: "Beta" },
        { id: "source", label: "Source" },
      ],
      edges: [
        { id: "e1", source: "source", target: "alpha" },
        { id: "e2", source: "source", target: "beta" },
      ],
    };
    const result = await layoutDiagram(spec);
    const alpha = result.nodes.find((n) => n.id === "alpha")!;
    const beta = result.nodes.find((n) => n.id === "beta")!;
    const source = result.nodes.find((n) => n.id === "source")!;
    expect(source.y).toBeLessThan(alpha.y);
    expect(alpha.y).toBe(beta.y);
    expect(alpha.x).not.toBe(beta.x);
  });

  it("moves the bend points of an edge in a lane by the origin of the lane", async () => {
    const spec: DiagramSpec = {
      version: 1,
      lanes: [
        { id: "top", label: "Top" },
        { id: "bottom", label: "Bottom" },
      ],
      nodes: [
        { id: "b", label: "B", lane: "top" },
        { id: "c", label: "C", lane: "top" },
        { id: "a", label: "A", lane: "bottom" },
      ],
      edges: [
        { id: "bc", source: "b", target: "c" },
        { id: "loop", source: "a", target: "a" },
      ],
    };
    const result = await layoutDiagram(spec);
    const a = result.nodes.find((n) => n.id === "a")!;
    const bottom = result.lanes.find((l) => l.id === "bottom")!;
    // A bend point that is not moved is near the corner of the lane, not near the node.
    expect(bottom.x).toBeGreaterThan(30);
    expect(bottom.y).toBeGreaterThan(30);
    const bends = result.edges
      .find((e) => e.id === "loop")!
      .sections.flatMap((s) => s.bendPoints ?? []);
    expect(bends.length).toBeGreaterThan(0);
    for (const point of bends) {
      expect(point.x).toBeGreaterThanOrEqual(a.x - 15);
      expect(point.x).toBeLessThanOrEqual(a.x + a.width + 15);
      expect(point.y).toBeGreaterThanOrEqual(a.y - 15);
      expect(point.y).toBeLessThanOrEqual(a.y + a.height + 15);
    }
  });

  it("grows a lane to the left and up for a fixed node with a negative position", async () => {
    const spec: DiagramSpec = {
      version: 1,
      lanes: [{ id: "x", label: "X" }],
      nodes: [
        { id: "a", label: "A", lane: "x" },
        { id: "b", label: "B", lane: "x", position: { x: -200, y: -150 } },
      ],
      edges: [],
    };
    const result = await layoutDiagram(spec);
    const box = result.lanes[0];
    expectInside(
      result.nodes.find((n) => n.id === "a")!,
      box,
    );
    expectInside(
      result.nodes.find((n) => n.id === "b")!,
      box,
    );
  });

  it("returns empty lists for an empty spec", async () => {
    const result = await layoutDiagram({ version: 1, nodes: [], edges: [] });
    expect(result).toEqual({ nodes: [], edges: [], lanes: [] });
  });

  it("places one node with no edges", async () => {
    const result = await layoutDiagram({ version: 1, nodes: [{ id: "a", label: "A" }], edges: [] });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({ id: "a", width: 100, height: 50 });
    expect(Number.isFinite(result.nodes[0].x)).toBe(true);
    expect(result.edges).toEqual([]);
  });

  it("gives bend points to a self-loop edge", async () => {
    const result = await layoutDiagram({
      version: 1,
      nodes: [{ id: "a", label: "A" }],
      edges: [{ id: "loop", source: "a", target: "a" }],
    });
    const bends = result.edges[0].sections.flatMap((s) => s.bendPoints ?? []);
    expect(bends.length).toBeGreaterThan(0);
  });

  it("lays out 60 nodes within 2000 ms", async () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
    const edges = nodes.slice(1).map((node, i) => ({
      id: `e${i}`,
      source: `n${Math.floor(i / 2)}`,
      target: node.id,
    }));
    const start = performance.now();
    const result = await layoutDiagram({ version: 1, nodes, edges });
    expect(performance.now() - start).toBeLessThan(2000);
    expect(result.nodes).toHaveLength(60);
    expect(findOverlaps(result)).toEqual([]);
  });
});

describe("findOverlaps", () => {
  const box = (id: string, x: number, y: number) => ({
    id,
    label: id,
    x,
    y,
    width: 100,
    height: 50,
  });

  it("reports two nodes whose boxes cross, and not two that only touch", () => {
    const result: LayoutResult = {
      nodes: [box("n1", 0, 0), box("n2", 50, 25), box("n3", 100, 0)],
      edges: [],
      lanes: [],
    };
    expect(findOverlaps(result)).toEqual([
      { nodeA: "n1", nodeB: "n2" },
      { nodeA: "n2", nodeB: "n3" },
    ]);
  });
});
