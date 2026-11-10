import { describe, it, expect } from "vitest";
import { validateSpec, MAX_EDGES, MAX_LABEL_LENGTH, MAX_NODES, MAX_POSITION } from "./validate";
import type { DiagramSpec, Problem } from "./spec";

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
  it("returns an empty list for a correct spec", () => {
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

  it("detects an edge with an unknown source", () => {
    const spec = baseSpec();
    spec.edges[0].source = "unknown";
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("EDGE_SOURCE_NOT_FOUND");
    expect(problems[0].message).toContain("unknown");
  });

  it("detects an edge with an unknown target", () => {
    const spec = baseSpec();
    spec.edges[0].target = "unknown";
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("EDGE_TARGET_NOT_FOUND");
    expect(problems[0].message).toContain("unknown");
  });

  it("detects a node with a lane that the spec does not define", () => {
    const spec = baseSpec();
    spec.lanes = [{ id: "lane1", label: "Lane 1" }];
    spec.nodes[0].lane = "unknown-lane";
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("NODE_LANE_NOT_FOUND");
    expect(problems[0].message).toContain("unknown-lane");
  });

  it("detects an invalid version", () => {
    const spec = baseSpec();
    spec.version = 2 as any;
    const problems = validateSpec(spec);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("INVALID_VERSION");
    expect(problems[0].message).toContain("2");
  });

  it("allows a cycle", () => {
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
    expect(problems.map((p) => p.code)).toEqual([
      "DUPLICATE_NODE_ID",
      "EDGE_TARGET_NOT_FOUND",
      "DUPLICATE_EDGE_ID",
      "EDGE_TARGET_NOT_FOUND",
    ]);
  });

  it("returns an empty list for an empty graph", () => {
    expect(validateSpec({ version: 1, nodes: [], edges: [] })).toEqual([]);
  });

  it("returns an empty list for a self-loop", () => {
    const spec: DiagramSpec = {
      version: 1,
      nodes: [{ id: "a", label: "A" }],
      edges: [{ id: "aa", source: "a", target: "a" }],
    };
    expect(validateSpec(spec)).toEqual([]);
  });
});

describe("validateSpec with a spec of the wrong shape", () => {
  const codes = (spec: unknown) => validateSpec(spec).map((p) => p.code);
  const paths = (spec: unknown) => validateSpec(spec).map((p) => p.path);

  it("reports a spec that is not an object", () => {
    for (const spec of [null, undefined, 3, "spec", []]) {
      expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    }
  });

  it("reports a missing edges array and does not throw", () => {
    const spec = { version: 1, nodes: [{ id: "a", label: "A" }] };
    expect(() => validateSpec(spec)).not.toThrow();
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["edges"]);
  });

  it("reports a missing nodes array and does not throw", () => {
    const spec = { version: 1, edges: [] };
    expect(() => validateSpec(spec)).not.toThrow();
    expect(paths(spec)).toEqual(["nodes"]);
  });

  it("reports a lanes value that is not an array", () => {
    const spec = { version: 1, lanes: "ops", nodes: [], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["lanes"]);
  });

  it("reports a node that is not an object", () => {
    const spec = { version: 1, nodes: [null, { id: "a", label: "A" }], edges: [] };
    expect(() => validateSpec(spec)).not.toThrow();
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["nodes[0]"]);
  });

  it("reports an edge that is not an object", () => {
    const spec = { version: 1, nodes: [{ id: "a", label: "A" }], edges: ["a->a"] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["edges[0]"]);
  });

  it("reports a lane that is not an object", () => {
    const spec = { version: 1, lanes: [7], nodes: [], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["lanes[0]"]);
  });

  it("reports a node ID that is a number", () => {
    const spec = { version: 1, nodes: [{ id: 1, label: "A" }], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["nodes[0].id"]);
  });

  it("reports a node ID that is an empty string", () => {
    const spec = { version: 1, nodes: [{ id: "", label: "A" }], edges: [] };
    expect(paths(spec)).toEqual(["nodes[0].id"]);
  });

  it("reports a node with no label", () => {
    const spec = { version: 1, nodes: [{ id: "a" }], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["nodes[0].label"]);
    expect(validateSpec(spec)[0].message).toContain("nodes[0].label");
  });

  it("reports an edge source, target and ID that are not strings", () => {
    const spec = {
      version: 1,
      nodes: [{ id: "a", label: "A" }],
      edges: [{ id: 5, source: null, target: 2 }],
    };
    expect(codes(spec)).toEqual(["INVALID_SHAPE", "INVALID_SHAPE", "INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["edges[0].id", "edges[0].source", "edges[0].target"]);
  });

  it("reports a lane with no ID and a lane with no label", () => {
    const spec = { version: 1, lanes: [{ label: "Ops" }, { id: "x" }], nodes: [], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE", "INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["lanes[0].id", "lanes[1].label"]);
  });

  it("reports a direction that is not RIGHT or DOWN", () => {
    const spec = { version: 1, direction: "LEFT", nodes: [], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["direction"]);
  });

  it("reports a node state and an edge state that the spec does not define", () => {
    const spec = {
      version: 1,
      nodes: [{ id: "a", label: "A", state: "done" }],
      edges: [{ id: "e1", source: "a", target: "a", state: "ok" }],
    };
    expect(paths(spec)).toEqual(["nodes[0].state", "edges[0].state"]);
  });

  it("reports a node kind that the spec does not define", () => {
    const spec = { version: 1, nodes: [{ id: "a", label: "A", kind: "loop" }], edges: [] };
    expect(codes(spec)).toEqual(["INVALID_SHAPE"]);
    expect(paths(spec)).toEqual(["nodes[0].kind"]);
  });

  it("reports a position beyond the limit, so the layout never gets an infinite size", () => {
    const problems = validateSpec({
      version: 1,
      nodes: [
        { id: "a", label: "A", position: { x: 1.7e308, y: 0 } },
        { id: "b", label: "B", position: { x: 0, y: -(MAX_POSITION + 1) } },
        { id: "c", label: "C", position: { x: MAX_POSITION, y: -MAX_POSITION } },
      ],
      edges: [],
    });
    expect(problems.map((p) => p.path)).toEqual(["nodes[0].position.x", "nodes[1].position.y"]);
    expect(problems.every((p) => p.code === "INVALID_SHAPE")).toBe(true);
  });

  it("reports a position with a coordinate that is not a finite number", () => {
    const spec = {
      version: 1,
      nodes: [
        { id: "a", label: "A", position: { x: "10", y: 0 } },
        { id: "b", label: "B", position: { x: 0, y: Infinity } },
        { id: "c", label: "C", position: 4 },
      ],
      edges: [],
    };
    expect(codes(spec)).toEqual(["INVALID_SHAPE", "INVALID_SHAPE", "INVALID_SHAPE"]);
    expect(paths(spec)).toEqual([
      "nodes[0].position.x",
      "nodes[1].position.y",
      "nodes[2].position",
    ]);
  });

  it("accepts each valid direction, state and kind", () => {
    const spec = {
      version: 1,
      direction: "DOWN",
      nodes: [
        { id: "a", label: "A", kind: "start", state: "used", position: { x: -5, y: 0.5 } },
        { id: "b", label: "B", kind: "decision", state: "skipped" },
        { id: "c", label: "C", kind: "step", state: "failed" },
        { id: "d", label: "D", kind: "end" },
      ],
      edges: [{ id: "e1", source: "a", target: "b", state: "failed" }],
    };
    expect(validateSpec(spec)).toEqual([]);
  });
});

describe("validateSpec limits", () => {
  const nodes = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ id: `n${i}`, label: `N${i}` }));

  it("accepts the maximum number of nodes", () => {
    expect(validateSpec({ version: 1, nodes: nodes(MAX_NODES), edges: [] })).toEqual([]);
  });

  it("reports more than the maximum number of nodes", () => {
    const problems = validateSpec({ version: 1, nodes: nodes(MAX_NODES + 1), edges: [] });
    expect(problems.map((p) => p.code)).toEqual(["TOO_MANY_NODES"]);
    expect(problems[0].message).toContain(String(MAX_NODES));
  });

  it("reports more than the maximum number of edges", () => {
    const edges = Array.from({ length: MAX_EDGES + 1 }, (_, i) => ({
      id: `e${i}`,
      source: "n0",
      target: "n1",
    }));
    const problems = validateSpec({ version: 1, nodes: nodes(2), edges });
    expect(problems.map((p) => p.code)).toEqual(["TOO_MANY_EDGES"]);
  });

  it("accepts a label with the maximum length", () => {
    const label = "x".repeat(MAX_LABEL_LENGTH);
    expect(validateSpec({ version: 1, nodes: [{ id: "a", label }], edges: [] })).toEqual([]);
  });

  it("reports a node, an edge and a lane label that are too long", () => {
    const label = "x".repeat(MAX_LABEL_LENGTH + 1);
    const problems = validateSpec({
      version: 1,
      lanes: [{ id: "l", label }],
      nodes: [{ id: "a", label, lane: "l" }],
      edges: [{ id: "e1", source: "a", target: "a", label }],
    });
    expect(problems.map((p) => p.code)).toEqual([
      "LABEL_TOO_LONG",
      "LABEL_TOO_LONG",
      "LABEL_TOO_LONG",
    ]);
    expect(problems.map((p) => p.path)).toEqual([
      "lanes[0].label",
      "nodes[0].label",
      "edges[0].label",
    ]);
  });
});

describe("validateSpec lanes", () => {
  it("reports a node lane when the spec has no lanes array", () => {
    const spec = { version: 1, nodes: [{ id: "a", label: "A", lane: "ghost" }], edges: [] };
    expect(validateSpec(spec).map((p) => p.code)).toEqual(["NODE_LANE_NOT_FOUND"]);
  });

  it("reports a node lane when the lanes array is empty", () => {
    const spec = {
      version: 1,
      lanes: [],
      nodes: [{ id: "a", label: "A", lane: "ghost" }],
      edges: [],
    };
    expect(validateSpec(spec).map((p) => p.code)).toEqual(["NODE_LANE_NOT_FOUND"]);
  });

  it("reports a lane ID that occurs more than once", () => {
    const spec = {
      version: 1,
      lanes: [
        { id: "x", label: "X" },
        { id: "x", label: "X again" },
      ],
      nodes: [],
      edges: [],
    };
    const problems = validateSpec(spec);
    expect(problems.map((p) => p.code)).toEqual(["DUPLICATE_LANE_ID"]);
    expect(problems[0].message).toContain('"x"');
  });
});

describe("Problem", () => {
  it("accepts only a known problem code", () => {
    const known: Problem = { code: "INVALID_SHAPE", message: "" };
    // @ts-expect-error: the code is a union of the known codes, not any string.
    const unknown: Problem = { code: "NOT_A_CODE", message: "" };
    expect([known.code, unknown.code]).toEqual(["INVALID_SHAPE", "NOT_A_CODE"]);
  });
});
