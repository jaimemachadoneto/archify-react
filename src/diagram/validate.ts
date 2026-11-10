import type { Problem, ProblemCode } from "./spec";

// ELK runs on the main thread, so a larger spec can freeze the page.
export const MAX_NODES = 500;
export const MAX_EDGES = 2000;
export const MAX_LABEL_LENGTH = 200;
// A fixed position beyond this size gives the layout an infinite or a meaningless box.
export const MAX_POSITION = 1_000_000;

const DIRECTIONS = ["RIGHT", "DOWN"];
const STATES = ["used", "skipped", "failed"];
const KINDS = ["step", "decision", "start", "end"];

type Item = Record<string, unknown>;

function isItem(value: unknown): value is Item {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function validateSpec(spec: unknown): Problem[] {
  const problems: Problem[] = [];
  const report = (code: ProblemCode, path: string, message: string) =>
    problems.push({ code, message, path });
  const shape = (path: string, message: string) =>
    report("INVALID_SHAPE", path, `${path}: ${message}`);

  if (!isItem(spec)) {
    problems.push({ code: "INVALID_SHAPE", message: "The spec must be an object." });
    return problems;
  }

  if (spec.version !== 1) {
    report(
      "INVALID_VERSION",
      "version",
      `The version must be 1. The version in the spec is ${String(spec.version)}.`,
    );
  }
  if (spec.direction !== undefined && !DIRECTIONS.includes(spec.direction as string)) {
    shape("direction", 'the direction must be "RIGHT" or "DOWN".');
  }
  const { nodes, edges, lanes = [] } = spec;
  if (!Array.isArray(nodes)) shape("nodes", "the nodes must be an array.");
  if (!Array.isArray(edges)) shape("edges", "the edges must be an array.");
  if (!Array.isArray(lanes)) shape("lanes", "the lanes must be an array.");
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(lanes)) return problems;

  // Stop early when there is already a problem, so the list of problems stays short.
  if (nodes.length > MAX_NODES) {
    report(
      "TOO_MANY_NODES",
      "nodes",
      `The spec has ${nodes.length} nodes. The maximum is ${MAX_NODES}.`,
    );
  }
  if (edges.length > MAX_EDGES) {
    report(
      "TOO_MANY_EDGES",
      "edges",
      `The spec has ${edges.length} edges. The maximum is ${MAX_EDGES}.`,
    );
  }
  if (problems.length > 0) return problems;

  const checkLabel = (item: Item, path: string, required: boolean) => {
    const label = item.label;
    if (label === undefined && !required) return;
    if (typeof label !== "string" || (required && label.length === 0)) {
      shape(`${path}.label`, "the label must be a non-empty string.");
    } else if (label.length > MAX_LABEL_LENGTH) {
      report(
        "LABEL_TOO_LONG",
        `${path}.label`,
        `${path}.label: the label has ${label.length} characters. The maximum is ${MAX_LABEL_LENGTH}.`,
      );
    }
  };
  const checkEnum = (item: Item, key: string, path: string, allowed: string[]) => {
    if (item[key] !== undefined && !allowed.includes(item[key] as string)) {
      shape(`${path}.${key}`, `the ${key} must be one of ${allowed.join(", ")}.`);
    }
  };

  const laneIds = new Set<string>();
  lanes.forEach((lane: unknown, index) => {
    const path = `lanes[${index}]`;
    if (!isItem(lane)) return shape(path, "a lane must be an object.");
    if (!isId(lane.id)) {
      shape(`${path}.id`, "the lane ID must be a non-empty string.");
    } else if (laneIds.has(lane.id)) {
      report("DUPLICATE_LANE_ID", `${path}.id`, `Lane ID "${lane.id}" occurs more than once`);
    } else {
      laneIds.add(lane.id);
    }
    checkLabel(lane, path, true);
  });

  const nodeIds = new Set<string>();
  nodes.forEach((node: unknown, index) => {
    const path = `nodes[${index}]`;
    if (!isItem(node)) return shape(path, "a node must be an object.");
    if (!isId(node.id)) {
      shape(`${path}.id`, "the node ID must be a non-empty string.");
    } else if (nodeIds.has(node.id)) {
      report("DUPLICATE_NODE_ID", `${path}.id`, `Node ID "${node.id}" occurs more than once`);
    } else {
      nodeIds.add(node.id);
    }
    checkLabel(node, path, true);
    checkEnum(node, "kind", path, KINDS);
    checkEnum(node, "state", path, STATES);
    if (node.lane !== undefined) {
      if (!isId(node.lane)) {
        shape(`${path}.lane`, "the lane must be a non-empty string.");
      } else if (!laneIds.has(node.lane)) {
        report(
          "NODE_LANE_NOT_FOUND",
          `${path}.lane`,
          `Node "${String(node.id)}" references unknown lane "${node.lane}"`,
        );
      }
    }
    if (node.position !== undefined) {
      const position = node.position;
      if (!isItem(position)) {
        shape(`${path}.position`, "the position must be an object with x and y.");
      } else {
        for (const axis of ["x", "y"]) {
          const value = position[axis];
          if (typeof value !== "number" || !Number.isFinite(value)) {
            shape(`${path}.position.${axis}`, `${axis} must be a finite number.`);
          } else if (Math.abs(value) > MAX_POSITION) {
            shape(
              `${path}.position.${axis}`,
              `${axis} must be between -${MAX_POSITION} and ${MAX_POSITION}.`,
            );
          }
        }
      }
    }
  });

  const edgeIds = new Set<string>();
  edges.forEach((edge: unknown, index) => {
    const path = `edges[${index}]`;
    if (!isItem(edge)) return shape(path, "an edge must be an object.");
    if (!isId(edge.id)) {
      shape(`${path}.id`, "the edge ID must be a non-empty string.");
    } else if (edgeIds.has(edge.id)) {
      report("DUPLICATE_EDGE_ID", `${path}.id`, `Edge ID "${edge.id}" occurs more than once`);
    } else {
      edgeIds.add(edge.id);
    }
    for (const end of ["source", "target"] as const) {
      const id = edge[end];
      if (!isId(id)) {
        shape(`${path}.${end}`, `the ${end} must be a non-empty string.`);
      } else if (!nodeIds.has(id)) {
        report(
          end === "source" ? "EDGE_SOURCE_NOT_FOUND" : "EDGE_TARGET_NOT_FOUND",
          `${path}.${end}`,
          `Edge "${String(edge.id)}" references unknown ${end} node "${id}"`,
        );
      }
    }
    checkLabel(edge, path, false);
    checkEnum(edge, "state", path, STATES);
  });

  return problems;
}
