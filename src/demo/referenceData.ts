import { MAX_EDGES, MAX_LABEL_LENGTH, MAX_NODES, MAX_POSITION, type ProblemCode } from "@/diagram";

// The reference page repeats the tables of README.md. Reference.test.tsx compares the two,
// so a change in one file without the other fails the test.

export interface PropRow {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
}

export const PROPS: PropRow[] = [
  {
    name: "spec",
    type: "DiagramSpec",
    defaultValue: "required",
    description: "The diagram to draw.",
  },
  {
    name: "selectedId",
    type: "string | null",
    defaultValue: "required",
    description: "The ID of the selected node.",
  },
  {
    name: "onSelect",
    type: "(id: string | null) => void",
    defaultValue: "required",
    description:
      "Called with the ID when the user selects a node. Called with null when the user clicks the empty pane or presses Escape and a node is selected.",
  },
  {
    name: "height",
    type: "number",
    defaultValue: "required",
    description: "The height of the diagram in pixels.",
  },
  {
    name: "ariaLabel",
    type: "string",
    defaultValue: "required",
    description: "The label of the diagram group.",
  },
  {
    name: "highlight",
    type: "boolean",
    defaultValue: "true",
    description:
      "Reduces the opacity of the nodes and edges outside the path of the node under the pointer or with focus.",
  },
];

export interface FunctionRow {
  signature: string;
  job: string;
}

export const FUNCTIONS: FunctionRow[] = [
  {
    signature: "validateSpec(spec: unknown): Problem[]",
    job: "Examines an unknown value. It never throws.",
  },
  {
    signature: "layoutDiagram(spec: DiagramSpec): Promise<LayoutResult>",
    job: "Gives the position and size of each node and lane, and the sections of each edge.",
  },
  {
    signature: "findOverlaps(result: LayoutResult): Array<{ nodeA: string; nodeB: string }>",
    job: "Gives the pairs of nodes that cover each other.",
  },
  {
    signature:
      'reach(spec: DiagramSpec, id: string, direction: "upstream" | "downstream"): string[]',
    job: "Gives the IDs of the nodes on one side of a node, and the node itself. It throws for a direction or an ID that is not valid.",
  },
];

// The type makes the page fail to compile when the library adds a code and this list lacks it.
export const CODE_MEANING: Record<ProblemCode, string> = {
  INVALID_SHAPE: "A value has the wrong type or is out of range.",
  INVALID_VERSION: "The version is not 1.",
  TOO_MANY_NODES: `The spec has more than ${MAX_NODES} nodes.`,
  TOO_MANY_EDGES: `The spec has more than ${MAX_EDGES} edges.`,
  LABEL_TOO_LONG: `A label has more than ${MAX_LABEL_LENGTH} characters.`,
  DUPLICATE_LANE_ID: "Two lanes have the same ID.",
  DUPLICATE_NODE_ID: "Two nodes have the same ID.",
  DUPLICATE_EDGE_ID: "Two edges have the same ID.",
  EDGE_SOURCE_NOT_FOUND: "The source of an edge is not a node.",
  EDGE_TARGET_NOT_FOUND: "The target of an edge is not a node.",
  NODE_LANE_NOT_FOUND: "The lane of a node is not in the list of lanes.",
};

export const LIMITS = [
  { name: "MAX_NODES", value: MAX_NODES, meaning: "The maximum number of nodes in a spec." },
  { name: "MAX_EDGES", value: MAX_EDGES, meaning: "The maximum number of edges in a spec." },
  {
    name: "MAX_LABEL_LENGTH",
    value: MAX_LABEL_LENGTH,
    meaning: "The maximum number of characters in a label.",
  },
  {
    name: "MAX_POSITION",
    value: MAX_POSITION,
    meaning: "The maximum distance of a fixed position from zero, on each axis, in pixels.",
  },
];

export interface VariableRow {
  name: string;
  fallback: string;
  styles: string;
}

// Reference.test.tsx reads styles.css and fails when this list differs from the variables there.
export const HOST_VARIABLES: VariableRow[] = [
  {
    name: "--foreground",
    fallback: "CanvasText",
    styles:
      "The text, the edges, the handles, and the border and inner line of a node under the pointer or selected.",
  },
  { name: "--background", fallback: "Canvas", styles: "The pane behind the diagram." },
  {
    name: "--card",
    fallback: "Canvas",
    styles: "The node fill, the edge label and the controls.",
  },
  {
    name: "--card-foreground",
    fallback: "CanvasText",
    styles: "The text in a node and in an edge label.",
  },
  {
    name: "--border",
    fallback: "GrayText",
    styles: "The frame, the controls and the border of an edge label.",
  },
  {
    name: "--muted",
    fallback: "Canvas",
    styles: "The fill of a lane.",
  },
  {
    name: "--muted-foreground",
    fallback: "GrayText",
    styles:
      "The caption, the lane label and lane border, the node border, a skipped node, a muted line.",
  },
  {
    name: "--accent",
    fallback: "Canvas",
    styles: "The fill of a selected node, and of a hovered control.",
  },
  { name: "--accent-foreground", fallback: "CanvasText", styles: "The text of that node." },
  {
    name: "--destructive",
    fallback: "LinkText",
    styles: "A failed node, a failed edge and the alert.",
  },
  { name: "--ring", fallback: "Highlight", styles: "The outline of a focused element." },
  { name: "--input", fallback: "GrayText", styles: "The dots of the grid behind the diagram." },
  { name: "--radius", fallback: "6px", styles: "The corner radius." },
  { name: "--font-sans", fallback: "system-ui, sans-serif", styles: "The font family." },
];
