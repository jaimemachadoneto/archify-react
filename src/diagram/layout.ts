import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api";
import type { DiagramSpec, DiagramNode, DiagramEdge } from "./spec";
import { validateSpec } from "./validate";

interface Point {
  x: number;
  y: number;
}

export interface LaneBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeSection {
  startPoint: Point;
  endPoint: Point;
  bendPoints?: Point[];
}

export interface LayoutResult {
  nodes: Array<DiagramNode & { x: number; y: number; width: number; height: number }>;
  // Absolute coordinates. An edge to or from a node with a fixed position has no sections.
  edges: Array<DiagramEdge & { sections: EdgeSection[] }>;
  lanes: LaneBox[];
}

const NODE_WIDTH = 100;
const NODE_HEIGHT = 50;
// Separate prefixes keep a node ID, a lane ID and an edge ID from a collision in ELK.
const NODE_PREFIX = "n:";
const LANE_PREFIX = "l:";
const EDGE_PREFIX = "e:";

export async function layoutDiagram(spec: DiagramSpec): Promise<LayoutResult> {
  const problems = validateSpec(spec);
  if (problems.length > 0) {
    throw new Error(
      `The diagram spec is not valid: ${problems.map((problem) => problem.message).join("; ")}`,
    );
  }

  // Dynamic import keeps ELK out of the main bundle.
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();

  const elkNodes = new Map<string, ElkNode>();
  for (const node of spec.nodes) {
    elkNodes.set(node.id, {
      id: NODE_PREFIX + node.id,
      labels: [{ text: node.label }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // A lane is an ELK parent node.
  const rootChildren: ElkNode[] = [];
  const laneNodes = new Map<string, ElkNode>();
  for (const lane of spec.lanes ?? []) {
    laneNodes.set(lane.id, {
      id: LANE_PREFIX + lane.id,
      labels: [{ text: lane.label }],
      children: [],
    });
  }
  for (const node of spec.nodes) {
    const elkNode = elkNodes.get(node.id)!;
    const laneNode = node.lane ? laneNodes.get(node.lane) : undefined;
    (laneNode?.children ?? rootChildren).push(elkNode);
  }
  for (const laneNode of laneNodes.values()) {
    if (laneNode.children?.length) rootChildren.push(laneNode);
  }

  const edges: ElkExtendedEdge[] = spec.edges.map((edge) => ({
    id: EDGE_PREFIX + edge.id,
    sources: [NODE_PREFIX + edge.source],
    targets: [NODE_PREFIX + edge.target],
    labels: edge.label ? [{ text: edge.label }] : [],
  }));

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": spec.direction ?? "RIGHT",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      // Space between nodes in one layer, and between layers, so that edge labels fit.
      "elk.spacing.nodeNode": "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": "50",
    },
    children: rootChildren,
    edges,
  };

  const result = await elk.layout(graph);

  // ELK gives the coordinates of a child relative to its parent.
  // Add the offset of each parent so that every x and y is absolute.
  const positions = new Map<string, LaneBox>();
  const laneOrigins = new Map<string, Point>();
  const lanes: LaneBox[] = [];
  const walk = (children: ElkNode[], offset: Point): void => {
    for (const child of children) {
      const box = {
        id: child.id,
        x: offset.x + (child.x ?? 0),
        y: offset.y + (child.y ?? 0),
        width: child.width ?? NODE_WIDTH,
        height: child.height ?? NODE_HEIGHT,
      };
      if (child.id.startsWith(LANE_PREFIX)) {
        const laneId = child.id.slice(LANE_PREFIX.length);
        lanes.push({ ...box, id: laneId });
        laneOrigins.set(laneId, { x: box.x, y: box.y });
        walk(child.children ?? [], { x: box.x, y: box.y });
      } else {
        positions.set(child.id.slice(NODE_PREFIX.length), box);
      }
    }
  };
  walk(result.children ?? [], { x: 0, y: 0 });

  const nodes = spec.nodes.map((node) => {
    const box = positions.get(node.id)!;
    // ELK ignores "elk.fixedPosition" in the layered algorithm, so the
    // position of the spec is applied here, after the layout.
    return {
      ...node,
      x: node.position?.x ?? box.x,
      y: node.position?.y ?? box.y,
      width: box.width,
      height: box.height,
    };
  });

  // A fixed node can leave the box that ELK calculated, so the box grows to hold it.
  for (const lane of lanes) {
    for (const node of nodes) {
      if (node.lane !== lane.id) continue;
      const right = Math.max(lane.x + lane.width, node.x + node.width);
      const bottom = Math.max(lane.y + lane.height, node.y + node.height);
      lane.x = Math.min(lane.x, node.x);
      lane.y = Math.min(lane.y, node.y);
      lane.width = right - lane.x;
      lane.height = bottom - lane.y;
    }
  }

  // ELK gives the points of an edge relative to the lowest common parent of its
  // two nodes. An edge inside one lane is relative to that lane, any other edge to the root.
  const laneOf = new Map(spec.nodes.map((node) => [node.id, node.lane]));
  const fixed = new Set(spec.nodes.filter((node) => node.position).map((node) => node.id));
  const laidOutEdges = spec.edges.map((edge) => {
    // The route of ELK ends at the place that ELK chose, not at the fixed position.
    if (fixed.has(edge.source) || fixed.has(edge.target)) return { ...edge, sections: [] };
    const elkEdge = result.edges?.find((e) => e.id === EDGE_PREFIX + edge.id);
    const sourceLane = laneOf.get(edge.source);
    const sameLane = sourceLane !== undefined && sourceLane === laneOf.get(edge.target);
    const origin = (sameLane && laneOrigins.get(sourceLane)) || { x: 0, y: 0 };
    const move = (p: Point): Point => ({ x: p.x + origin.x, y: p.y + origin.y });
    const sections = (elkEdge?.sections ?? []).map((section) => ({
      startPoint: move(section.startPoint),
      endPoint: move(section.endPoint),
      ...(section.bendPoints && { bendPoints: section.bendPoints.map(move) }),
    }));
    return { ...edge, sections };
  });

  return { nodes, edges: laidOutEdges, lanes };
}

export function findOverlaps(result: LayoutResult): Array<{ nodeA: string; nodeB: string }> {
  const overlaps: Array<{ nodeA: string; nodeB: string }> = [];
  const nodes = result.nodes;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      ) {
        overlaps.push({ nodeA: a.id, nodeB: b.id });
      }
    }
  }
  return overlaps;
}
