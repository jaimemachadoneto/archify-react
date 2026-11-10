import type { FC } from "react";
import { Handle, Position, type Node as FlowNode, type NodeProps } from "@xyflow/react";
import type { DiagramNode } from "../spec";

export type DiagramNodeData = {
  // The id in the spec. The id of the React Flow node has a prefix.
  specId: string;
  label: string;
  kind: NonNullable<DiagramNode["kind"]>;
  state?: DiagramNode["state"];
  selected: boolean;
  onSelect: (id: string) => void;
  // True when a path is highlighted and this node is not on it.
  dimmed: boolean;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
};

export type DiagramFlowNode = FlowNode<DiagramNodeData, "step">;

// The button is the only click target, so one click calls onSelect once.
// A native button also gives the Enter and the Space keys.
const Node: FC<NodeProps<DiagramFlowNode>> = ({
  data,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
}) => {
  const { specId, label, kind, state, selected, onSelect, dimmed, onActivate, onDeactivate } = data;

  // "nopan" keeps a mouse drag on a node from panning the diagram: React Flow adds it only to a draggable node.
  const classes = ["archify-node", "nopan"];
  if (selected) classes.push("archify-node--selected");
  if (state) classes.push(`archify-node--${state}`);

  return (
    <>
      {/* The layout draws the edges. React Flow needs the handles to place them. */}
      <Handle
        type="target"
        position={targetPosition}
        isConnectable={false}
        className="archify-handle"
        style={{ visibility: "hidden" }}
      />
      <button
        type="button"
        className={classes.join(" ")}
        data-state={state ?? "used"}
        data-kind={kind}
        title={label}
        aria-pressed={selected}
        // The attribute is absent, not "false", when the node is not dimmed.
        data-dimmed={dimmed ? "true" : undefined}
        style={{ width: "100%", height: "100%" }}
        onClick={() => onSelect(specId)}
        onPointerEnter={() => onActivate(specId)}
        onPointerLeave={() => onDeactivate(specId)}
        onFocus={() => onActivate(specId)}
        onBlur={() => onDeactivate(specId)}
      >
        <span className="archify-node__label">{label}</span>
        {kind !== "step" && <span className="archify-sr-only">({kind})</span>}
        {/* A caption says the state in words, so a colour is never the only sign. */}
        {state === "skipped" && <span className="archify-node__note">not used</span>}
        {state === "failed" && <span className="archify-node__note">failed</span>}
      </button>
      <Handle
        type="source"
        position={sourcePosition}
        isConnectable={false}
        className="archify-handle"
        style={{ visibility: "hidden" }}
      />
    </>
  );
};

export default Node;
