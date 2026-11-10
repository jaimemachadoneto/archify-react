import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { Background, Controls, Position, ReactFlow } from "@xyflow/react";
import { layoutDiagram, type LayoutResult } from "./layout";
import type { DiagramSpec } from "./spec";
import { reach } from "./reach";
import { validateSpec } from "./validate";
import Node, { type DiagramFlowNode } from "./components/Node";
import Lane, { type LaneFlowNode } from "./components/Lane";
import FlowEdgeView, { type DiagramFlowEdge } from "./components/FlowEdge";

export interface WorkflowDiagramProps {
  // A new object with the same content does not run the layout again.
  spec: DiagramSpec;
  selectedId: string | null;
  // Pass a stable function (for example a state setter), or the component rebuilds the nodes on each render.
  onSelect: (id: string) => void;
  height: number;
  ariaLabel: string;
  // Dim the nodes and edges outside the path of the node under the pointer or with focus.
  highlight?: boolean;
}

// Defined outside the component, so React Flow gets the same objects on each render.
const nodeTypes = { step: Node, lane: Lane };
const edgeTypes = { flow: FlowEdgeView };
const MIN_ZOOM = 0.7;

// Only these fields change the layout. A change to another field redraws without ELK.
function layoutKeyOf(spec: DiagramSpec): string {
  return JSON.stringify([
    spec.direction ?? "RIGHT",
    (spec.lanes ?? []).map((lane) => [lane.id, lane.label]),
    spec.nodes.map((node) => [node.id, node.label, node.lane, node.position?.x, node.position?.y]),
    spec.edges.map((edge) => [edge.id, edge.source, edge.target, edge.label]),
  ]);
}

// A result belongs to one layout key. The last result stays on screen until the next one arrives.
type Outcome =
  | { key: string; spec: DiagramSpec; layout: LayoutResult }
  | { key: string; spec: DiagramSpec; error: string };

const WorkflowDiagram: FC<WorkflowDiagramProps> = ({
  spec,
  selectedId,
  onSelect,
  height,
  ariaLabel,
  highlight = true,
}) => {
  const problems = useMemo(() => validateSpec(spec), [spec]);
  const valid = problems.length === 0;
  const layoutKey = useMemo(() => (valid ? layoutKeyOf(spec) : null), [spec, valid]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [lastLayout, setLastLayout] = useState<{ spec: DiagramSpec; layout: LayoutResult } | null>(
    null,
  );

  useEffect(() => {
    if (layoutKey === null) return;
    let cancelled = false;
    layoutDiagram(spec).then(
      (layout) => {
        if (cancelled) return;
        setOutcome({ key: layoutKey, spec, layout });
        setLastLayout({ spec, layout });
      },
      (error: unknown) => {
        if (cancelled) return;
        console.error("archify-react: layout failed", error);
        const message = error instanceof Error ? error.message : String(error);
        setOutcome({ key: layoutKey, spec, error: message });
      },
    );
    return () => {
      cancelled = true;
    };
    // The key holds every field of the spec that the layout reads.
  }, [layoutKey]);

  const current = outcome?.key === layoutKey ? outcome : null;
  const pending = valid && current === null;
  const failed = current !== null && "error" in current ? current.error : null;
  const shown = failed === null ? lastLayout : null;
  const layout = shown?.layout ?? null;

  const [activeId, setActiveId] = useState<string | null>(null);
  // A new spec can remove the active node, and then no leave event comes.
  const activeGone = activeId !== null && valid && !spec.nodes.some((n) => n.id === activeId);
  if (activeGone) setActiveId(null);
  const onActivate = useCallback((id: string) => setActiveId(id), []);
  // A leave or a blur from an older node must not clear a newer active node.
  const onDeactivate = useCallback(
    (id: string) => setActiveId((now) => (now === id ? null : now)),
    [],
  );

  // Two sets, so that an edge that goes around the active node is not on the path.
  const path = useMemo(() => {
    if (!highlight || !valid || activeId === null || activeGone) return null;
    return {
      up: new Set(reach(spec, activeId, "upstream")),
      down: new Set(reach(spec, activeId, "downstream")),
    };
  }, [highlight, valid, activeId, activeGone, spec]);

  const specNodes = useMemo(
    () => new Map(valid ? spec.nodes.map((node) => [node.id, node]) : []),
    [spec, valid],
  );
  const specEdges = useMemo(
    () => new Map(valid ? spec.edges.map((edge) => [edge.id, edge]) : []),
    [spec, valid],
  );

  const laneNodes = useMemo<LaneFlowNode[]>(() => {
    if (!layout) return [];
    const laneLabels = new Map((valid ? (spec.lanes ?? []) : []).map((l) => [l.id, l.label]));
    return layout.lanes.map((lane) => ({
      id: `lane:${lane.id}`,
      type: "lane",
      data: { label: laneLabels.get(lane.id) ?? lane.id },
      position: { x: lane.x, y: lane.y },
      width: lane.width,
      height: lane.height,
      zIndex: -1,
      draggable: false,
      selectable: false,
      focusable: false,
      style: { pointerEvents: "none" },
    }));
  }, [layout, spec, valid]);

  const vertical = shown?.spec.direction === "DOWN";
  const stepNodes = useMemo<DiagramFlowNode[]>(() => {
    if (!layout) return [];
    const sourcePosition = vertical ? Position.Bottom : Position.Right;
    const targetPosition = vertical ? Position.Top : Position.Left;
    return layout.nodes.map((placed) => {
      const node = specNodes.get(placed.id) ?? placed;
      return {
        id: placed.id,
        type: "step",
        data: {
          label: node.label,
          kind: node.kind ?? "step",
          state: node.state,
          selected: selectedId === placed.id,
          onSelect,
          dimmed: path !== null && !path.up.has(placed.id) && !path.down.has(placed.id),
          onActivate,
          onDeactivate,
        },
        position: { x: placed.x, y: placed.y },
        width: placed.width,
        height: placed.height,
        sourcePosition,
        targetPosition,
        // React Flow sets pointer-events none on a node that is not selectable. The button must stay a target.
        style: { pointerEvents: "all" },
        // jsdom cannot measure the handles, so these boxes let a test draw the edges.
        handles: [
          {
            type: "target",
            position: targetPosition,
            x: vertical ? placed.width / 2 : 0,
            y: vertical ? 0 : placed.height / 2,
            width: 1,
            height: 1,
          },
          {
            type: "source",
            position: sourcePosition,
            x: vertical ? placed.width / 2 : placed.width,
            y: vertical ? placed.height : placed.height / 2,
            width: 1,
            height: 1,
          },
        ],
      };
    });
  }, [layout, vertical, specNodes, selectedId, path, onSelect, onActivate, onDeactivate]);

  const edges = useMemo<DiagramFlowEdge[]>(() => {
    if (!layout) return [];
    const onPath = (source: string, target: string) =>
      path === null ||
      (path.up.has(source) && path.up.has(target)) ||
      (path.down.has(source) && path.down.has(target));
    return layout.edges.map((placed) => {
      const edge = specEdges.get(placed.id) ?? placed;
      return {
        id: placed.id,
        type: "flow",
        source: placed.source,
        target: placed.target,
        focusable: false,
        data: {
          label: edge.label,
          state: edge.state,
          animated: edge.animated ?? false,
          sections: placed.sections,
          dimmed: !onPath(placed.source, placed.target),
        },
      };
    });
  }, [layout, specEdges, path]);

  const flowNodes = useMemo(() => [...laneNodes, ...stepNodes], [laneNodes, stepNodes]);

  const wrapper = { height, width: "100%" };

  if (problems.length > 0) {
    return (
      <div role="group" aria-label={ariaLabel} style={wrapper}>
        <div role="alert" className="archify-alert">
          <p>The diagram spec is not valid.</p>
          <ul>
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`}>{problem.message}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (failed !== null) {
    return (
      <div role="group" aria-label={ariaLabel} style={wrapper}>
        <div role="alert" className="archify-alert">
          <p>The diagram layout failed.</p>
          {failed}
        </div>
      </div>
    );
  }

  const busy = pending ? true : undefined;

  if (!layout) {
    return <div role="group" aria-label={ariaLabel} aria-busy={busy} style={wrapper} />;
  }

  return (
    <div role="group" aria-label={ariaLabel} aria-busy={busy} style={wrapper}>
      <ReactFlow<DiagramFlowNode | LaneFlowNode, DiagramFlowEdge>
        nodes={flowNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        className="archify-diagram"
        // Below this zoom the text is too small to read. A wide diagram is panned inside the canvas.
        minZoom={MIN_ZOOM}
        fitViewOptions={{ minZoom: MIN_ZOOM }}
        zoomOnScroll={false}
        preventScrolling={false}
        fitView
      >
        <Controls showInteractive={false} position="top-right" />
        <Background color="var(--archify-input)" gap={20} />
      </ReactFlow>
    </div>
  );
};

export default WorkflowDiagram;
