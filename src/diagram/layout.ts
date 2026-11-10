import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api";
import type { DiagramSpec, DiagramNode, DiagramEdge } from "./spec";

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
  // Absolute coordinates. The sections of an edge to a node with a fixed
  // position are not recalculated: they keep the route that ELK found for the free node.
  edges: Array<DiagramEdge & { sections: EdgeSection[] }>;
  lanes: LaneBox[];
}

const NODE_WIDTH = 100;
const NODE_HEIGHT = 50;
const LANE_PREFIX = "lane:";

export async function layoutDiagram(spec: DiagramSpec): Promise<LayoutResult> {
  // Dynamic import keeps ELK out of the main bundle.
  const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
  const elk = new ELK();

  const laneIds = new Set(spec.lanes?.map((lane) => lane.id));
  const elkNodes = new Map<string, ElkNode>();
  for (const node of spec.nodes) {
    elkNodes.set(node.id, {
      id: node.id,
      labels: [{ text: node.label }],
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // A lane is an ELK parent node. A node with an unknown lane stays at the root.
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
    const laneNode = node.lane && laneIds.has(node.lane) ? laneNodes.get(node.lane) : undefined;
    (laneNode?.children ?? rootChildren).push(elkNode);
  }
  for (const laneNode of laneNodes.values()) {
    if (laneNode.children?.length) rootChildren.push(laneNode);
  }

  const edges: ElkExtendedEdge[] = spec.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
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
      if (child.id.startsWith(LANE_PREFIX) && laneNodes.has(child.id.slice(LANE_PREFIX.length))) {
        const laneId = child.id.slice(LANE_PREFIX.length);
        lanes.push({ ...box, id: laneId });
        laneOrigins.set(laneId, { x: box.x, y: box.y });
        walk(child.children ?? [], { x: box.x, y: box.y });
      } else {
        positions.set(child.id, box);
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
  const laidOutEdges = spec.edges.map((edge) => {
    const elkEdge = result.edges?.find((e) => e.id === edge.id);
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
