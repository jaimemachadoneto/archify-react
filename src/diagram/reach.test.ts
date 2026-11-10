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
});
