# archify-react

archify-react draws a workflow diagram in a React app. The diagram shows the path of a request through its steps.

Try the demo at https://jaimemachadoneto.github.io/archify-react/. Read the reference at https://jaimemachadoneto.github.io/archify-react/#reference.

- React 19 and react-dom 19 are the peer dependencies. The host needs no Tailwind.
- The stylesheet is plain CSS.
- The component draws the diagram. The host keeps the selection.
- The layout uses ELK and runs in the browser.

## Install

Install the package from the release:

```
pnpm add https://github.com/jaimemachadoneto/archify-react/releases/download/v0.1.0/archify-react-0.1.0.tgz
```

React 19 and react-dom 19 are peer dependencies. The package declares `@xyflow/react` and `elkjs` as its own dependencies.

## Use

```tsx
import { useState } from "react";
import { WorkflowDiagram, type DiagramSpec } from "archify-react";
import "archify-react/styles.css";

export function Trace({ spec }: { spec: DiagramSpec }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <WorkflowDiagram
      spec={spec}
      selectedId={selectedId}
      onSelect={setSelectedId}
      height={400}
      ariaLabel="Decision trace"
    />
  );
}
```

1. Import `archify-react/styles.css` one time. The JavaScript of the package imports no CSS.
2. Keep the selected ID in your state. The component holds no selection. A click on the empty pane calls `onSelect(null)` when a node is selected, so a state setter clears the selection. A pan or a zoom does not call `onSelect`.
3. Give `onSelect` a stable function, for example a state setter. A new function on each render builds the nodes again.

If your app does not define the host variables, define them in your CSS. This example sets six of them:

```css
:root {
  --foreground: #1c1917;
  --background: #faf9f7;
  --card: #ffffff;
  --border: #e5e0d9;
  --destructive: #b91c1c;
  --ring: #c2410c;
}
```

Without these variables, the diagram uses the system colours. A failed edge draws in the link colour of the browser. The section Theme lists all the variables.

The root element of the component takes the width of its parent element.

| Prop         | Type                           | Default  | Description                                                                                                                     |
| ------------ | ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `spec`       | `DiagramSpec`                  | required | The diagram to draw.                                                                                                            |
| `selectedId` | `string \| null`               | required | The ID of the selected node.                                                                                                    |
| `onSelect`   | `(id: string \| null) => void` | required | Called with the ID when the user selects a node. Called with `null` when the user clicks the empty pane and a node is selected. |
| `height`     | `number`                       | required | The height of the diagram in pixels.                                                                                            |
| `ariaLabel`  | `string`                       | required | The label of the diagram group.                                                                                                 |
| `highlight`  | `boolean`                      | `true`   | Reduces the opacity of the nodes and edges outside the path of the node under the pointer or with focus.                        |

A new `spec` object with the same content does not run the layout again.

## The spec

```ts
const spec: DiagramSpec = {
  version: 1,
  direction: "RIGHT",
  lanes: [{ id: "ops", label: "Operations" }],
  nodes: [
    { id: "a", label: "Receive request", kind: "start" },
    { id: "b", label: "Check the cache", state: "skipped" },
  ],
  edges: [{ id: "e1", source: "a", target: "b", label: "yes", animated: true }],
};
```

| Field       | Type                  | Default   | Description                                   |
| ----------- | --------------------- | --------- | --------------------------------------------- |
| `version`   | `1`                   | required  | The version of the spec. The value must be 1. |
| `direction` | `"RIGHT"` or `"DOWN"` | `"RIGHT"` | The direction of the flow.                    |
| `lanes`     | `DiagramLane[]`       | `[]`      | The lanes of the diagram.                     |
| `nodes`     | `DiagramNode[]`       | required  | The steps of the diagram.                     |
| `edges`     | `DiagramEdge[]`       | required  | The transitions between the steps.            |

A lane has an `id` and a `label`. The lane draws a box around its nodes and a label above the box. A node joins a lane with its `lane` field.

### A node

| Field      | Type                                         | Default  | Description                                                                |
| ---------- | -------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| `id`       | `string`                                     | required | The identity of the node. It must be unique.                               |
| `label`    | `string`                                     | required | The text in the node. The box holds two lines, or one line with a caption. |
| `summary`  | `string`                                     | none     | Text for the host. The library does not draw it.                           |
| `kind`     | `"step"`, `"decision"`, `"start"` or `"end"` | `"step"` | The shape of the node.                                                     |
| `state`    | `"used"`, `"skipped"` or `"failed"`          | `"used"` | The state of the flow at this node.                                        |
| `lane`     | `string`                                     | none     | The ID of the lane of the node.                                            |
| `position` | `{ x: number, y: number }`                   | none     | A fixed position in pixels. Each value is between -1000000 and 1000000.    |

A `start` node and an `end` node draw as a pill. A `decision` node draws with a small diamond before its label.

### An edge

| Field      | Type                                | Default  | Description                                          |
| ---------- | ----------------------------------- | -------- | ---------------------------------------------------- |
| `id`       | `string`                            | required | The identity of the edge. It must be unique.         |
| `source`   | `string`                            | required | The ID of the node where the edge starts.            |
| `target`   | `string`                            | required | The ID of the node where the edge ends.              |
| `label`    | `string`                            | none     | The text in the middle of the edge.                  |
| `state`    | `"used"`, `"skipped"` or `"failed"` | `"used"` | The state of the flow on this edge.                  |
| `animated` | `boolean`                           | `false`  | A dot moves along the edge when the state is `used`. |

### The states

- `used`: the flow goes through this node or edge.
- `skipped`: the flow does not go through this node or edge. A node shows the caption "not used". An edge draws a dashed line.
- `failed`: this node or edge failed. A node shows the caption "failed". The colour is the danger colour.

A node shows its state in words, so the colour of a node is never the only sign. A failed edge shows its state with the danger colour and a wider line only.

`position` gives a node a fixed position in pixels. An edge to a node with a fixed position draws between the handles of the two nodes.

## Functions

The library exports four functions for a host that prepares a spec, or that draws its own view.

| Function                     | Returns                 | Job                                                          |
| ---------------------------- | ----------------------- | ------------------------------------------------------------ |
| `validateSpec(spec)`         | `Problem[]`             | Examines an unknown value. It never throws.                  |
| `layoutDiagram(spec)`        | `Promise<LayoutResult>` | Gives the position and the size of each node, lane and edge. |
| `findOverlaps(result)`       | `{ nodeA, nodeB }[]`    | Gives the pairs of nodes that cover each other.              |
| `reach(spec, id, direction)` | `string[]`              | Gives the nodes that a node reaches upstream or downstream.  |

### validateSpec(spec: unknown): Problem[]

The function returns the list of problems. The list is empty for a valid spec. A problem has a `code`, a `message` and an optional `path`. The message is English text. Show it to the user as it is. The array `PROBLEM_CODES` holds all the codes, and the type `ProblemCode` is one of them.

```ts
import { validateSpec } from "archify-react";

const problems = validateSpec(input);
if (problems.length > 0) {
  console.warn(problems.map((problem) => problem.message));
}
```

| Code                    | Meaning                               |
| ----------------------- | ------------------------------------- |
| `INVALID_SHAPE`         | A value has the wrong type.           |
| `INVALID_VERSION`       | The version is not 1.                 |
| `TOO_MANY_NODES`        | The spec has more than 500 nodes.     |
| `TOO_MANY_EDGES`        | The spec has more than 2000 edges.    |
| `LABEL_TOO_LONG`        | A label has more than 200 characters. |
| `DUPLICATE_LANE_ID`     | Two lanes have the same ID.           |
| `DUPLICATE_NODE_ID`     | Two nodes have the same ID.           |
| `DUPLICATE_EDGE_ID`     | Two edges have the same ID.           |
| `EDGE_SOURCE_NOT_FOUND` | The source of an edge is not a node.  |
| `EDGE_TARGET_NOT_FOUND` | The target of an edge is not a node.  |
| `NODE_LANE_NOT_FOUND`   | The lane of a node is not a lane.     |

### layoutDiagram(spec: DiagramSpec): Promise<LayoutResult>

The function examines the spec first. If the spec is not valid, the promise rejects with the messages of the problems in one error. The function is asynchronous, because ELK calculates the layout.

The result holds three lists:

- `nodes`: each node with `x`, `y`, `width` and `height` in absolute pixels. The layout gives a node a box of 100 by 50 pixels.
- `edges`: each edge with `sections`. A section has a `startPoint`, an `endPoint` and optional `bendPoints`. An edge to or from a node with a fixed position has no sections.
- `lanes`: each lane as a box with `id`, `x`, `y`, `width` and `height`.

### findOverlaps(result: LayoutResult)

The function returns each pair of nodes whose boxes cover each other. Use it in a test that proves the layout stays clear.

The function examines nodes only. It does not examine lanes. A node with a fixed `position` can leave its lane, and the box of the lane then grows. Such a box can cover another lane or a node of another lane, and the function does not report it. To find that, compare the `lanes` boxes of the result in your own test.

### reach(spec, id, direction)

`direction` is `"upstream"` or `"downstream"`. The function returns the IDs of the nodes on that side of the node, and it includes the node itself.

The function throws when `direction` has another value. It also throws when `id` is not the ID of a node in the spec.

## Limits

The validation reports these limits as problems:

- 500 nodes.
- 2000 edges.
- A label of at most 200 characters.
- A value of `position` between -1000000 and 1000000.

The layout runs on the main thread. A larger spec can make the page slow to answer.

## When the spec has a problem

- If the spec is not valid, the component draws an alert with the list of problems in the place of the diagram.
- If the layout fails, the component draws an alert that starts with "The diagram layout failed." and holds the text of the error. It also sends the error to the console.
- While the next layout runs, the component keeps the last layout on the screen, and it sets `aria-busy` on the diagram.

## Theme

The stylesheet reads these host variables. Each one has a fallback for a host that does not define it.

| Host variable         | Fallback                | Styles                                                 |
| --------------------- | ----------------------- | ------------------------------------------------------ |
| `--foreground`        | `CanvasText`            | The text, the edges and the handles.                   |
| `--background`        | `Canvas`                | The pane behind the diagram.                           |
| `--card`              | `Canvas`                | The node fill, the edge label and the controls.        |
| `--card-foreground`   | `CanvasText`            | The text in a node and in an edge label.               |
| `--border`            | `GrayText`              | The frame and the controls.                            |
| `--muted`             | `Canvas`                | The fill of a lane and of a node under the pointer.    |
| `--muted-foreground`  | `GrayText`              | The caption, a lane, a skipped node, a muted line.     |
| `--accent`            | `Canvas`                | The fill of a selected node, and of a hovered control. |
| `--accent-foreground` | `CanvasText`            | The text of that node.                                 |
| `--destructive`       | `LinkText`              | A failed node and a failed edge.                       |
| `--ring`              | `Highlight`             | The outline of a focused element.                      |
| `--input`             | `GrayText`              | The dots of the grid behind the diagram.               |
| `--radius`            | `6px`                   | The corner radius.                                     |
| `--font-sans`         | `system-ui, sans-serif` | The font family.                                       |

For a look of its own, override the private variables. The rules read only these, so the change stays inside the diagram.

```css
.archify-diagram {
  --archify-danger: #e11d48;
  --archify-radius: 12px;
  --archify-font: "IBM Plex Sans", system-ui, sans-serif;
}
```

The stylesheet is plain CSS. It is not in a CSS layer. It imports the base rules of React Flow, so import `archify-react/styles.css` one time only.

## Accessibility

- Each node is a button with `aria-pressed`. A keyboard user can focus a node and select it.
- The diagram is a group with the label from `ariaLabel`.
- A node shows its state in words. A skipped edge draws a dashed line.
- A failed edge shows its state with the danger colour and a wider line only.
- A problem and an error show in a region with the role `alert`.
- The animation stops when the user prefers reduced motion.
- On a touch device, a swipe up or down on the diagram scrolls the page.

## Test a host

jsdom does no layout and lacks some browser APIs. A test that renders `WorkflowDiagram` under jsdom needs three stubs for browser APIs that React Flow uses. Run this code one time, before the first render, for example in the setup file of the test runner:

```ts host-stubs
// React Flow observes the size of each node with a ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

// React Flow reads the zoom from a DOMMatrixReadOnly when it updates the nodes.
class DOMMatrixReadOnlyStub {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = scale ? Number(scale) : 1;
  }
}
globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly;

// React Flow measures the text of an edge label with getBBox. Without a layout, the box is empty.
Object.defineProperty(SVGElement.prototype, "getBBox", {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});
```

The test `src/diagram/hostTesting.test.tsx` of this repository runs this code block as it is. It removes each stub in turn, and the test fails:

| Missing stub        | What fails                                                                      |
| ------------------- | ------------------------------------------------------------------------------- |
| `ResizeObserver`    | The first render throws `ResizeObserver is not defined`.                        |
| `getBBox`           | An edge with a `label` throws `getBBox is not a function` after the layout.     |
| `DOMMatrixReadOnly` | A change of `direction` throws `window.DOMMatrixReadOnly is not a constructor`. |

### Clean up after each test

Testing Library removes the rendered diagram after each test only when the test runner has a global `afterEach`. Vitest has no global `afterEach` unless the config sets `globals: true`. Without it, the diagram of one test stays in the document in the next test. Call `cleanup` after each test, for example in the same setup file:

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

### Wait for the layout

The layout is asynchronous, so the nodes are not in the first render. Until the layout is ready, the group of the diagram has `aria-busy="true"` and holds no node. When the layout is ready, the nodes are buttons and `aria-busy` is gone.

With Testing Library, wait for a node button:

```tsx
render(
  <WorkflowDiagram
    spec={spec}
    selectedId={null}
    onSelect={onSelect}
    height={300}
    ariaLabel="Trace"
  />,
);
const node = await screen.findByRole("button", { name: /Receive request/ }, { timeout: 5000 });
```

Under load, the first layout can take longer than the default timeout of one second, so give a longer timeout.

After you change the spec, the old layout stays on the screen while the next layout runs, and a new node is not there yet. Wait for `aria-busy` to go:

```tsx
const group = screen.getByRole("group", { name: "Trace" });
await waitFor(() => expect(group).not.toHaveAttribute("aria-busy"));
```

With Playwright, use the same signals:

```ts
const diagram = page.getByRole("group", { name: "Decision trace" });
await expect(diagram).not.toHaveAttribute("aria-busy");
await expect(diagram.getByRole("button", { name: /Receive request/ })).toBeVisible();
```

To find a node by the ID in the spec, use `diagram.locator('[data-id="step:<id>"]')`. React Flow moves the view to fit the diagram after the first measure. Before a screenshot or a click at a position, wait until the `transform` style of `.react-flow__viewport` stops changing.

### What to test under jsdom

jsdom does no layout: `getBoundingClientRect` gives zeros, so a test cannot check where a node is. Test the structure: the buttons, their names, `aria-pressed` and `data-state`. To test positions, call `layoutDiagram` and `findOverlaps` on the spec. Use Playwright to test what the user sees.

## Known limits

- On a touch device (a coarse pointer), a vertical swipe on the diagram scrolls the page, also when the swipe starts on a node. A horizontal swipe pans the diagram. A touch cannot pan the diagram up or down, so give a tall diagram a `height` that shows all of it. The zoom controls work as before. A device with a mouse as the main pointer, such as a laptop with a touch screen, keeps the React Flow behavior: `touch-action: none` on the pane, and a touch pans the diagram in all directions.
- The diagram needs a parent with a width.
- The React Flow attribution stays visible.
- A long label stops after two lines, or one line with a caption. The `title` of the node shows all of it.
- A lane label that is wider than its lane ends with an ellipsis. The `title` of the label shows all of it.
- The `data-id` of a node element is `step:` and the ID of the node. A test must not select a node by the ID alone.

## Develop

These commands work in the project shell:

| Command    | Job                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fmt`      | Formats the code.                                                                                                                   |
| `lint`     | Checks the types and the format.                                                                                                    |
| `check`    | Runs the unit tests. It also builds and packs the library.                                                                          |
| `build`    | Builds the library and the demo. `pnpm build:lib` writes the library to `dist/`. `pnpm build` also writes the demo to `dist-demo/`. |
| `pnpm e2e` | Runs the browser tests. It needs the browsers of the devenv shell.                                                                  |

`pnpm build:pages` writes the demo for the project site, with `/archify-react/` as the base. The workflow `.github/workflows/pages.yaml` publishes it.

The demo page holds three examples and a playground. The link Reference at the top opens the reference page at `#reference`. A hash route works on GitHub Pages, which has no fallback for a path. The page reads the limits and the problem codes from the library, and a test compares its tables with this file and with the stylesheet. The playground has controls for the direction, the highlight, the spec and the look. Run `pnpm dev`. Then open `http://localhost:5173`. The demo reads the same variables as a host app. A click on the empty pane in the playground clears the selected step ID.

## Licence

MIT. Read `LICENSE` for the text.

The package depends on `@xyflow/react` (MIT) and `elkjs` (EPL-2.0). The library build keeps both external, so no code of a dependency is inside `dist/`. React Flow requires the attribution on the diagram, and the stylesheet keeps it visible.
