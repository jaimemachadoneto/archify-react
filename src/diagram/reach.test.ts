import { describe, it, expect } from "vitest";
import { reach } from "./reach";
import { DiagramSpec } from "./spec";

describe("reach function", () => {
  const baseSpec: DiagramSpec = {
    version: 1,
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

  it("returns only the start node when the spec has no edges", () => {
    const spec = {
      ...baseSpec,
      edges: [],
    };
    const result = reach(spec, "a", "downstream");
    expect(result).toEqual(["a"]);
  });

  it("returns the nodes downstream in order", () => {
    const spec = {
      ...baseSpec,
    };
    const result = reach(spec, "a", "downstream");
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("returns the nodes upstream in order", () => {
    const spec = {
      ...baseSpec,
    };
    const result = reach(spec, "c", "upstream");
    expect(result).toEqual(["c", "b", "a"]);
  });

  it("returns the node and its source for a node with no outgoing edges", () => {
    const spec = {
      ...baseSpec,
      nodes: [...baseSpec.nodes, { id: "d", label: "D" }],
      edges: [...baseSpec.edges, { id: "e3", source: "a", target: "d" }],
    };
    const result = reach(spec, "d", "downstream");
    expect(result).toEqual(["d"]);
    const result2 = reach(spec, "d", "upstream");
    expect(result2).toEqual(["d", "a"]);
  });

  it("returns each node once for a cycle", () => {
    const cycleSpec: DiagramSpec = {
      version: 1,
      nodes: [
        { id: "x", label: "X" },
        { id: "y", label: "Y" },
      ],
      edges: [
        { id: "e1", source: "x", target: "y" },
        { id: "e2", source: "y", target: "x" },
      ],
    };
    const result = reach(cycleSpec, "x", "downstream");
    expect(result).toEqual(["x", "y"]);
  });

  it("throws an error for an invalid direction", () => {
    const spec = baseSpec;
    expect(() => reach(spec, "a", "invalid" as unknown as "upstream")).toThrow(
      'The direction must be "upstream" or "downstream"',
    );
  });

  it("throws an error for a node ID that does not exist", () => {
    const spec = baseSpec;
    expect(() => reach(spec, "nonexistent", "downstream")).toThrow(
      'The node ID "nonexistent" does not exist',
    );
  });

  it("returns both branches downstream of a fork", () => {
    const fork: DiagramSpec = {
      version: 1,
      nodes: ["a", "b", "c", "d"].map((id) => ({ id, label: id.toUpperCase() })),
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "ac", source: "a", target: "c" },
        { id: "cd", source: "c", target: "d" },
      ],
    };
    expect(reach(fork, "a", "downstream")).toEqual(["a", "b", "c", "d"]);
  });

  it("returns both sources upstream of a join", () => {
    const join: DiagramSpec = {
      version: 1,
      nodes: ["a", "b", "c"].map((id) => ({ id, label: id.toUpperCase() })),
      edges: [
        { id: "ac", source: "a", target: "c" },
        { id: "bc", source: "b", target: "c" },
      ],
    };
    expect(reach(join, "c", "upstream")).toEqual(["c", "a", "b"]);
  });

  it("returns only the node for a self-loop", () => {
    const loop: DiagramSpec = {
      version: 1,
      nodes: [{ id: "a", label: "A" }],
      edges: [{ id: "aa", source: "a", target: "a" }],
    };
    expect(reach(loop, "a", "downstream")).toEqual(["a"]);
    expect(reach(loop, "a", "upstream")).toEqual(["a"]);
  });
});
