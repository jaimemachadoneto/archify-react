export interface DiagramSpec {
  version: 1;
  direction?: "RIGHT" | "DOWN";
  lanes?: Array<{ id: string; label: string }>;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
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

export interface Problem {
  code: string;
  message: string;
  path?: string;
}

export const spec: DiagramSpec = {
  version: 1,
  nodes: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  edges: [{ id: "e1", source: "a", target: "b" }],
};
