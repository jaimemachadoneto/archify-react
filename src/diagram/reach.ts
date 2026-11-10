import { DiagramSpec } from "./spec";

export function reach(
  spec: DiagramSpec,
  id: string,
  direction: "upstream" | "downstream",
): string[] {
  if (!["upstream", "downstream"].includes(direction)) {
    throw new Error('The direction must be "upstream" or "downstream"');
  }

  const nodeIds = new Set(spec.nodes.map((n) => n.id));
  if (!nodeIds.has(id)) {
    throw new Error(`The node ID "${id}" does not exist`);
  }

  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();

  for (const edge of spec.edges) {
    const { source, target } = edge;
    const downstreamTargets = downstream.get(source) ?? [];
    downstream.set(source, [...downstreamTargets, target]);

    const upstreamTargets = upstream.get(target) ?? [];
    upstream.set(target, [...upstreamTargets, source]);
  }

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
