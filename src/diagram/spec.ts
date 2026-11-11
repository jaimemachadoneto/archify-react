export interface DiagramSpec {
  version: 1;
  direction?: "RIGHT" | "DOWN";
  lanes?: DiagramLane[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

export interface DiagramLane {
  id: string;
  label: string;
}

export interface DiagramNode {
  id: string;
  label: string;
  summary?: string;
  kind?: "step" | "decision" | "start" | "end";
  state?: "used" | "skipped" | "failed";
  lane?: string;
  position?: { x: number; y: number };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  state?: "used" | "skipped" | "failed";
  animated?: boolean;
}

// The type comes from this list, so a host and the reference page read the same codes.
export const PROBLEM_CODES = [
  "INVALID_SHAPE",
  "INVALID_VERSION",
  "TOO_MANY_NODES",
  "TOO_MANY_EDGES",
  "LABEL_TOO_LONG",
  "DUPLICATE_LANE_ID",
  "DUPLICATE_NODE_ID",
  "DUPLICATE_EDGE_ID",
  "EDGE_SOURCE_NOT_FOUND",
  "EDGE_TARGET_NOT_FOUND",
  "NODE_LANE_NOT_FOUND",
] as const;

export type ProblemCode = (typeof PROBLEM_CODES)[number];

export interface Problem {
  code: ProblemCode;
  message: string;
  path?: string;
}
