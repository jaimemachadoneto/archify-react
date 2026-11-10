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

  it("should return only the start node when there are no edges", () => {
    const spec = {
      ...baseSpec,
      edges: [],
    };
    const result = reach(spec, "a", "downstream");
    expect(result).toEqual(["a"]);
  });

  it("should traverse downstream correctly", () => {
    const spec = {
      ...baseSpec,
    };
    const result = reach(spec, "a", "downstream");
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("should traverse upstream correctly", () => {
    const spec = {
      ...baseSpec,
    };
    const result = reach(spec, "c", "upstream");
    expect(result).toEqual(["c", "b", "a"]);
  });

  it("should handle a node with no incoming or outgoing edges", () => {
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

  it("should handle a cycle correctly and not loop infinitely", () => {
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

  it("should throw error for invalid direction", () => {
    const spec = baseSpec;
    expect(() => reach(spec, "a", "invalid" as unknown as "upstream")).toThrow("Invalid direction");
  });

  it("should throw error for non-existent node id", () => {
    const spec = baseSpec;
    expect(() => reach(spec, "nonexistent", "downstream")).toThrow(
      'Node id "nonexistent" not found',
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
