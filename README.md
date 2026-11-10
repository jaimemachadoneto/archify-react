# archify-react

archify-react draws workflow diagrams in a React app. A diagram shows the path of a request through its nodes and edges.

## Install

Install the package from the release:

```
pnpm add <release URL>
```

The package needs React 19 and react-dom 19 as peer dependencies.

## Use

Import the component and the stylesheet:

```tsx
import { WorkflowDiagram } from "archify-react";
import "archify-react/styles.css";

<WorkflowDiagram
  spec={spec}
  selectedId={selectedId}
  onSelect={setSelectedId}
  height={400}
  ariaLabel="Decision trace"
/>;
```

| Prop         | Type                   | Default  | Description                                                    |
| ------------ | ---------------------- | -------- | -------------------------------------------------------------- |
| `spec`       | `DiagramSpec`          | required | The diagram to draw.                                           |
| `selectedId` | `string \| null`       | required | The ID of the selected node.                                   |
| `onSelect`   | `(id: string) => void` | required | Called when the user selects a node.                           |
| `height`     | `number`               | required | The height of the diagram in pixels.                           |
| `ariaLabel`  | `string`               | required | The label of the diagram group.                                |
| `highlight`  | `boolean`              | `true`   | Dims the nodes and edges outside the path of the hovered node. |

## The spec

The spec has a version, a direction, lanes, nodes and edges.

```ts
{
  version: 1,
  direction: "RIGHT", // or "DOWN"
  lanes: [{ id: "ops", label: "Operations" }],
  nodes: [
    { id: "a", label: "A", kind: "start", state: "used", lane: "ops", position: { x: 10, y: 20 } },
  ],
  edges: [{ id: "e1", source: "a", target: "b", label: "yes", state: "used", animated: true }],
}
```

Each node has an `id` and a `label`. A node can have a `kind`, a `state`, a `lane` and a `position`. The kinds are "start", "decision" and "end". The default kind is "step".

The states mean:

- `used`: the flow goes through this node.
- `skipped`: the flow does not go through this node. The caption "not used" shows.
- `failed`: this node failed. The caption "failed" shows.

An edge connects a source node to a target node. An edge can have a `label` and a `state`. An edge with `animated: true` shows a dot that moves along the edge.

`position` pins a node to a place in pixels. The edge to a pinned node draws between the handles of the two nodes.

## Limits

The spec has these limits:

- 500 nodes.
- 2000 edges.
- A label of at most 200 characters.

The layout runs on the main thread, so a larger spec can freeze the page.

## Theme

The CSS reads these host variables, each with a fallback:

`--foreground`, `--background`, `--card`, `--card-foreground`, `--border`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--ring`, `--input`, `--radius`, `--font-sans`.

The stylesheet is plain CSS. It is not in a CSS layer. The host needs no Tailwind.

## Accessibility

- Each node is a button with `aria-pressed`.
- The diagram is a group with the label from `ariaLabel`.
- An error shows in a region with the `alert` role.
- The animation stops when the user prefers reduced motion.
- A keyboard user can focus and select a node.

## Known limits

- The pane sets `touch-action: none`. A touch on the diagram does not scroll the page.
- The diagram needs a parent with a width.
- The React Flow attribution stays visible.

## Validation and helpers

The library exports `validateSpec`, `layoutDiagram`, `findOverlaps` and `reach`.

- `validateSpec(spec)` returns the list of problems in a spec.
- `layoutDiagram(spec)` returns the layout of a spec.
- `findOverlaps(result)` returns the pairs of nodes that overlap.
- `reach(spec, id, direction)` returns the nodes that a node reaches.

## Develop

These commands work in the project shell:

| Command    | Job                                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fmt`      | Formats the code.                                                                                                                   |
| `lint`     | Checks the types and the format.                                                                                                    |
| `check`    | Runs the unit tests. It also builds and packs the library.                                                                          |
| `build`    | Builds the library and the demo. `pnpm build:lib` writes the library to `dist/`. `pnpm build` also writes the demo to `dist-demo/`. |
| `pnpm e2e` | Runs the browser tests. It needs the browsers of the devenv shell.                                                                  |

## Licence

TODO: add a licence before the first release.
