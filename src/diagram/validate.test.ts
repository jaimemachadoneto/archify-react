import { describe, it, expect } from "vitest";
import { validateSpec } from "./validate";
import { DiagramSpec } from "./spec";

function baseSpec(): DiagramSpec {
  return {
    version: 1,
    nodes: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
    edges: [{ id: "e1", source: "a", target: "b" }],
  };
}

describe("validateSpec", () => {
  it("returns empty list for a correct spec", () => {
    const spec = baseSpec();
    const problems = validateSpec(spec);
    expect(problems).toEqual([]);
  });

  it("detects duplicate node IDs", () => {
    const spec = baseSpec();
    spec.nodes.push({ id: "a", label: "A duplicate" });
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("DUPLICATE_NODE_ID");
    expect(problems[0].message).toContain("a");
  });

  it("detects duplicate edge IDs", () => {
    const spec = baseSpec();
    spec.edges.push({ id: "e1", source: "a", target: "b" });
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("DUPLICATE_EDGE_ID");
    expect(problems[0].message).toContain("e1");
  });

  it("detects edge with unknown source", () => {
    const spec = baseSpec();
    spec.edges[0].source = "unknown";
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("EDGE_SOURCE_NOT_FOUND");
    expect(problems[0].message).toContain("unknown");
  });

  it("detects edge with unknown target", () => {
    const spec = baseSpec();
    spec.edges[0].target = "unknown";
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("EDGE_TARGET_NOT_FOUND");
    expect(problems[0].message).toContain("unknown");
  });

  it("detects node with lane not in lanes", () => {
    const spec = baseSpec();
    spec.lanes = [{ id: "lane1", label: "Lane 1" }];
    spec.nodes[0].lane = "unknown-lane";
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("NODE_LANE_NOT_FOUND");
    expect(problems[0].message).toContain("unknown-lane");
  });

  it("detects invalid version", () => {
    const spec = baseSpec();
    spec.version = 2 as any;
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("INVALID_VERSION");
    expect(problems[0].message).toContain("2");
  });

  it("allows cycles", () => {
    const spec = baseSpec();
    spec.edges.push({ id: "e2", source: "b", target: "a" });
    const problems = validateSpec(spec);
    expect(problems).toEqual([]);
  });

  it("reports multiple problems", () => {
    const spec: DiagramSpec = {
      version: 1,
      nodes: [
        { id: "a", label: "A" },
        { id: "a", label: "A duplicate" },
      ],
      edges: [
        { id: "e1", source: "a", target: "b" },
        { id: "e1", source: "a", target: "b" },
      ],
    };
    const problems = validateSpec(spec);
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });
});
