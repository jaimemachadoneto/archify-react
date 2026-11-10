import { useCallback, useEffect, useMemo, useState, type FC } from "react";
import { Background, Controls, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/base.css";
import { layoutDiagram, type LayoutResult } from "./layout";
import type { DiagramSpec } from "./spec";
import { reach } from "./reach";
import { validateSpec } from "./validate";
import Node, { type DiagramFlowNode } from "./components/Node";
import Lane, { type LaneFlowNode } from "./components/Lane";
import FlowEdgeView, { type DiagramFlowEdge } from "./components/FlowEdge";

export interface WorkflowDiagramProps {
  // The component runs the layout again when this object changes, so keep it stable (for example with useMemo).
  spec: DiagramSpec;
  selectedId: string | null;
  // Pass a stable function (for example a state setter), or the component rebuilds the step nodes on each render.
  onSelect: (id: string) => void;
  height: number;
  ariaLabel: string;
  // Dim the nodes and edges outside the path of the node under the pointer or with focus.
  highlight?: boolean;
}

// Defined outside the component, so React Flow gets the same objects on each render.
const nodeTypes = { step: Node, lane: Lane };
const edgeTypes = { flow: FlowEdgeView };

// The result belongs to one spec. A result for an older spec is never drawn.
type Outcome = { spec: DiagramSpec; layout: LayoutResult } | { spec: DiagramSpec; error: string };

const WorkflowDiagram: FC<WorkflowDiagramProps> = ({
  spec,
  selectedId,
  onSelect,
  height,
  ariaLabel,
  highlight = true,
}) => {
  const problems = useMemo(() => validateSpec(spec), [spec]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (problems.length > 0) return;
    let cancelled = false;
    layoutDiagram(spec).then(
      (layout) => {
        if (!cancelled) setOutcome({ spec, layout });
      },
      (error: unknown) => {
        if (!cancelled) {
          setOutcome({ spec, error: error instanceof Error ? error.message : String(error) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [spec, problems]);

  const current = outcome?.spec === spec ? outcome : null;
  const layout = current && "layout" in current ? current.layout : null;

  // One source of truth for the active node: the node under the pointer or with focus.
  const [activeId, setActiveId] = useState<string | null>(null);
  // A new spec can unmount the node that was active, and then no leave event comes.
  // React allows this reset during the render, and it avoids a frame with a stale dimming.
  const [activeSpec, setActiveSpec] = useState(spec);
  if (activeSpec !== spec) {
    setActiveSpec(spec);
    setActiveId(null);
  }
  const onActivate = useCallback((id: string) => setActiveId(id), []);
  // A leave or a blur from an older node must not clear a newer active node.
  const onDeactivate = useCallback(
    (id: string) => setActiveId((now) => (now === id ? null : now)),
    [],
  );

  // The ids on the path of the active node, or null when nothing is highlighted.
  // The active node can be missing after the spec changes: then nothing is dimmed.
  const onPath = useMemo(() => {
    if (!highlight || activeId === null || !spec.nodes.some((n) => n.id === activeId)) return null;
    return new Set([...reach(spec, activeId, "upstream"), ...reach(spec, activeId, "downstream")]);
  }, [highlight, activeId, spec]);

  const laneNodes = useMemo<LaneFlowNode[]>(() => {
    if (!layout) return [];
    const laneLabels = new Map(spec.lanes?.map((lane) => [lane.id, lane.label]));
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
  }, [layout, spec]);

  const stepNodes = useMemo<DiagramFlowNode[]>(() => {
    if (!layout) return [];
    const vertical = spec.direction === "DOWN";
    const sourcePosition = vertical ? Position.Bottom : Position.Right;
    const targetPosition = vertical ? Position.Top : Position.Left;
    return layout.nodes.map((node) => ({
      id: node.id,
      type: "step",
      data: {
        label: node.label,
        state: node.state,
        selected: selectedId === node.id,
        onSelect,
        dimmed: onPath !== null && !onPath.has(node.id),
        onActivate,
        onDeactivate,
      },
      position: { x: node.x, y: node.y },
      width: node.width,
      height: node.height,
      sourcePosition,
      targetPosition,
      // React Flow sets pointer-events none on a node that is not selectable. The button must stay a target.
      style: { pointerEvents: "all" },
      // React Flow measures the handles in a browser. These boxes keep the edges
      // drawn where no layout engine exists, such as in a test.
      handles: [
        {
          type: "target",
          position: targetPosition,
          x: vertical ? node.width / 2 : 0,
          y: vertical ? 0 : node.height / 2,
          width: 1,
          height: 1,
        },
        {
          type: "source",
          position: sourcePosition,
          x: vertical ? node.width / 2 : node.width,
          y: vertical ? node.height : node.height / 2,
          width: 1,
          height: 1,
        },
      ],
    }));
  }, [layout, spec, selectedId, onPath, onSelect, onActivate, onDeactivate]);

  const edges = useMemo<DiagramFlowEdge[]>(() => {
    if (!layout) return [];
    return layout.edges.map((edge) => ({
      id: edge.id,
      type: "flow",
      source: edge.source,
      target: edge.target,
      focusable: false,
      data: {
        label: edge.label,
        state: edge.state,
        animated: edge.animated ?? false,
        sections: edge.sections,
        dimmed: onPath !== null && !(onPath.has(edge.source) && onPath.has(edge.target)),
      },
    }));
  }, [layout, onPath]);

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

  if (current && "error" in current) {
    return (
      <div role="group" aria-label={ariaLabel} style={wrapper}>
        <div role="alert" className="archify-alert">
          {current.error}
        </div>
      </div>
    );
  }

  if (!layout) {
    return <div role="group" aria-label={ariaLabel} style={wrapper} />;
  }

  return (
    <div role="group" aria-label={ariaLabel} style={wrapper}>
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
        minZoom={0.25}
        zoomOnScroll={false}
        preventScrolling={false}
        fitView
      >
        <Controls showInteractive={false} position="top-right" />
        <Background color="var(--input)" gap={20} />
      </ReactFlow>
    </div>
  );
};

export default WorkflowDiagram;
