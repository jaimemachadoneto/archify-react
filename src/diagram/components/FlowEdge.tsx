import { useId, type FC } from "react";
import { BaseEdge, getSmoothStepPath, type Edge as FlowEdge, type EdgeProps } from "@xyflow/react";
import type { DiagramEdge } from "../spec";
import type { EdgeSection } from "../layout";
import { useMediaQuery } from "../useMediaQuery";

export type DiagramEdgeData = {
  label?: string;
  state?: DiagramEdge["state"];
  animated: boolean;
  sections: EdgeSection[];
  // True when a path is highlighted and this edge is not on it.
  dimmed: boolean;
};

export type DiagramFlowEdge = FlowEdge<DiagramEdgeData, "flow">;

function pathOf(sections: EdgeSection[]): { path: string; labelX: number; labelY: number } | null {
  const points = sections.flatMap((s) => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]);
  if (points.length < 2) return null;
  // The label goes in the middle of the longest segment: never at a bend or at an end.
  let middleX = points[0].x;
  let middleY = points[0].y;
  let longest = -1;
  for (let i = 1; i < points.length; i++) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (length > longest) {
      longest = length;
      middleX = (points[i].x + points[i - 1].x) / 2;
      middleY = (points[i].y + points[i - 1].y) / 2;
    }
  }
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return { path, labelX: middleX, labelY: middleY };
}

// CSS cannot stop an SVG animateMotion, so the component reads the media query in JavaScript.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const FlowEdgeView: FC<EdgeProps<DiagramFlowEdge>> = ({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}) => {
  // Use the route from the layout. Without one, React Flow draws a path between the handles.
  const routed = pathOf(data?.sections ?? []);
  const [fallbackPath, fallbackX, fallbackY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const path = routed?.path ?? fallbackPath;
  const reducedMotion = useMediaQuery(REDUCED_MOTION);
  const markerId = useId();
  // Only a used edge shows the dot: a skipped or a failed edge carries no flow.
  const state = data?.state ?? "used";
  const dimmed = data?.dimmed === true;
  const showDot = data?.animated === true && state === "used" && !reducedMotion;

  return (
    <>
      {/* The arrowhead is a marker with the state of the edge, so that the CSS can colour it. */}
      <defs>
        <marker
          id={markerId}
          className="archify-arrow"
          data-state={state}
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        labelX={routed?.labelX ?? fallbackX}
        labelY={routed?.labelY ?? fallbackY}
        label={data?.label}
        markerEnd={`url(#${markerId})`}
        className="archify-edge"
        data-state={state}
        data-dimmed={dimmed ? "true" : undefined}
      />
      {showDot && (
        <circle r="4" className="archify-edge-dot" data-dimmed={dimmed ? "true" : undefined}>
          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
};

export default FlowEdgeView;
