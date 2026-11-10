import { DiagramSpec, Problem } from "./spec";

export function validateSpec(spec: DiagramSpec): Problem[] {
  const problems: Problem[] = [];

  // Check version
  if (spec.version !== 1) {
    problems.push({
      code: "INVALID_VERSION",
      message: `Version must be 1, got ${spec.version}`,
      path: "version",
    });
  }

  // Check duplicate node IDs
  const nodeIds = new Set<string>();
  for (const node of spec.nodes) {
    if (nodeIds.has(node.id)) {
      problems.push({
        code: "DUPLICATE_NODE_ID",
        message: `Node ID "${node.id}" occurs more than once`,
        path: `nodes[id="${node.id}"]`,
      });
    } else {
      nodeIds.add(node.id);
    }
  }

  // Check duplicate edge IDs
  const edgeIds = new Set<string>();
  for (const edge of spec.edges) {
    if (edgeIds.has(edge.id)) {
      problems.push({
        code: "DUPLICATE_EDGE_ID",
        message: `Edge ID "${edge.id}" occurs more than once`,
        path: `edges[id="${edge.id}"]`,
      });
    } else {
      edgeIds.add(edge.id);
    }
  }

  // Check edges reference existing nodes
  for (const edge of spec.edges) {
    if (!nodeIds.has(edge.source)) {
      problems.push({
        code: "EDGE_SOURCE_NOT_FOUND",
        message: `Edge "${edge.id}" references unknown source node "${edge.source}"`,
        path: `edges[id="${edge.id}"].source`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      problems.push({
        code: "EDGE_TARGET_NOT_FOUND",
        message: `Edge "${edge.id}" references unknown target node "${edge.target}"`,
        path: `edges[id="${edge.id}"].target`,
      });
    }
  }

  // Check lanes
  if (spec.lanes) {
    const laneIds = new Set(spec.lanes.map((l) => l.id));
    for (const node of spec.nodes) {
      if (node.lane && !laneIds.has(node.lane)) {
        problems.push({
          code: "NODE_LANE_NOT_FOUND",
          message: `Node "${node.id}" references unknown lane "${node.lane}"`,
          path: `nodes[id="${node.id}"].lane`,
        });
      }
    }
  }

  return problems;
}
