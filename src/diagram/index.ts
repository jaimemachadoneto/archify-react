// The only public entry of the library. Keep this list small: each name is a promise to the consumer.
export { default as WorkflowDiagram } from "./WorkflowDiagram";
export type { WorkflowDiagramProps } from "./WorkflowDiagram";
export type {
  DiagramSpec,
  DiagramLane,
  DiagramNode,
  DiagramEdge,
  Problem,
  ProblemCode,
} from "./spec";
export { PROBLEM_CODES } from "./spec";
export { validateSpec, MAX_NODES, MAX_EDGES, MAX_LABEL_LENGTH, MAX_POSITION } from "./validate";
export { layoutDiagram, findOverlaps } from "./layout";
export type { LayoutResult, LaneBox, EdgeSection } from "./layout";
export { reach } from "./reach";
