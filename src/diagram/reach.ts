import { DiagramSpec } from "./spec";

export function reach(
  spec: DiagramSpec,
  id: string,
  direction: "upstream" | "downstream",
): string[] {
  // Validate inputs
  if (!["upstream", "downstream"].includes(direction)) {
    throw new Error("Invalid direction");
  }

  // Validate node id exists
  const nodeIds = new Set(spec.nodes.map((n) => n.id));
  if (!nodeIds.has(id)) {
    throw new Error(`Node id "${id}" not found`);
  }

  // Build adjacency maps
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();

  for (const edge of spec.edges) {
    const { source, target } = edge;
    const downstreamTargets = downstream.get(source) ?? [];
    downstream.set(source, [...downstreamTargets, target]);

    const upstreamTargets = upstream.get(target) ?? [];
    upstream.set(target, [...upstreamTargets, source]);
  }

  // Traverse
  const visited = new Set<string>();
  const queue = [id];
  visited.add(id);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (direction === "downstream") {
      const targets = downstream.get(current) ?? [];
      for (const next of targets) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    } else {
      const sources = upstream.get(current) ?? [];
      for (const next of sources) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  return Array.from(visited);
}
