import { useId, type FC } from "react";
import {
  BaseEdge,
  EdgeText,
  getSmoothStepPath,
  type Edge as FlowEdge,
  type EdgeProps,
} from "@xyflow/react";
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
      <g className="archify-edge-group" data-dimmed={dimmed ? "true" : undefined}>
        <BaseEdge
          id={id}
          path={path}
          markerEnd={`url(#${markerId})`}
          className="archify-edge"
          data-state={state}
        />
        {showDot && (
          // The key is the path. A new path needs a new dot, because a running SMIL animation does not read a new path.
          // WebKit draws the circle at the origin of the SVG until the first sample of the motion.
          // The circle is hidden, and a set element with the same begin time shows it with the first position.
          // A begin value that names the motion (id.begin) never starts in any browser, so use a time.
          <circle key={path} r="4" className="archify-edge-dot" visibility="hidden">
            <set attributeName="visibility" to="visible" begin="0s" />
            <animateMotion begin="0s" dur="2s" repeatCount="indefinite" path={path} />
          </circle>
        )}
        {/* The label comes last, so it paints over the dot. */}
        {data?.label && (
          <EdgeText
            x={routed?.labelX ?? fallbackX}
            y={routed?.labelY ?? fallbackY}
            label={data.label}
          />
        )}
      </g>
    </>
  );
};

export default FlowEdgeView;
