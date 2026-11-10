import { useSyncExternalStore, type FC } from "react";
import { BaseEdge, getSmoothStepPath, type Edge as FlowEdge, type EdgeProps } from "@xyflow/react";
import type { DiagramEdge } from "../spec";
import type { EdgeSection } from "../layout";

export type DiagramEdgeData = {
  label?: string;
  state?: DiagramEdge["state"];
  animated: boolean;
  sections: EdgeSection[];
};

export type DiagramFlowEdge = FlowEdge<DiagramEdgeData, "flow">;

function pathOf(sections: EdgeSection[]): { path: string; labelX: number; labelY: number } | null {
  const points = sections.flatMap((s) => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]);
  if (points.length < 2) return null;
  const middle = points[Math.floor(points.length / 2)];
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return { path, labelX: middle.x, labelY: middle.y };
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// CSS cannot stop an SVG animateMotion, so the component reads the media query in JavaScript.
// A browser without matchMedia, or no window, counts as "no preference".
function subscribeToMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION).matches;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => false);
}

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
  const reducedMotion = useReducedMotion();
  // Only a used edge shows the dot: a skipped or a failed edge carries no flow.
  const state = data?.state ?? "used";
  const showDot = data?.animated === true && state === "used" && !reducedMotion;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        labelX={routed?.labelX ?? fallbackX}
        labelY={routed?.labelY ?? fallbackY}
        label={data?.label}
        className="archify-edge"
        data-state={state}
      />
      {showDot && (
        <circle r="4" className="archify-edge-dot">
          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  );
};

export default FlowEdgeView;
