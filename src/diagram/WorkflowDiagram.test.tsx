import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkflowDiagram from "./WorkflowDiagram";
import type { DiagramSpec } from "./spec";
import { layoutDiagram } from "./layout";

// The spy calls the real layout, so the tests still draw the real result.
// The spy lets a test see that an invalid spec never reaches the layout, and
// lets another test make the layout fail.
vi.mock("./layout", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./layout")>();
  return { ...actual, layoutDiagram: vi.fn(actual.layoutDiagram) };
});

const baseSpec: DiagramSpec = {
  version: 1,
  nodes: [
    { id: "alpha", label: "Alpha", state: "used" },
    { id: "beta", label: "Beta", state: "used" },
  ],
  edges: [{ id: "e1", source: "alpha", target: "beta" }],
};

const skippedSpec: DiagramSpec = {
  ...baseSpec,
  nodes: [
    { id: "alpha", label: "Alpha", state: "used" },
    { id: "beta", label: "Beta", state: "skipped" },
  ],
};

const laneSpec: DiagramSpec = {
  version: 1,
  lanes: [{ id: "ops", label: "Operations lane" }],
  nodes: [
    { id: "alpha", label: "Alpha", lane: "ops" },
    { id: "beta", label: "Beta", lane: "ops" },
  ],
  edges: [{ id: "e1", source: "alpha", target: "beta" }],
};

const invalidSpec: DiagramSpec = {
  version: 1,
  nodes: [{ id: "alpha", label: "Alpha" }],
  edges: [{ id: "e1", source: "alpha", target: "missing" }],
};

// a -> b and a -> c fork, and c -> d continues one path.
const forkSpec: DiagramSpec = {
  version: 1,
  nodes: [
    { id: "a", label: "Node A" },
    { id: "b", label: "Node B" },
    { id: "c", label: "Node C" },
    { id: "d", label: "Node D" },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "ac", source: "a", target: "c", animated: true },
    { id: "cd", source: "c", target: "d" },
  ],
};

// The loop b -> c -> b must not make the reach calculation run forever.
const cycleSpec: DiagramSpec = {
  version: 1,
  nodes: [
    { id: "a", label: "Node A" },
    { id: "b", label: "Node B" },
    { id: "c", label: "Node C" },
    { id: "d", label: "Node D" },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "cb", source: "c", target: "b" },
    { id: "ad", source: "a", target: "d" },
  ],
};

function draw(
  spec: DiagramSpec,
  props: {
    selectedId?: string | null;
    onSelect?: (id: string) => void;
    highlight?: boolean;
  } = {},
) {
  return render(
    <WorkflowDiagram
      spec={spec}
      selectedId={props.selectedId ?? null}
      onSelect={props.onSelect ?? (() => {})}
      {...(props.highlight === undefined ? {} : { highlight: props.highlight })}
      height={400}
      ariaLabel="Decision trace"
    />,
  );
}

describe("WorkflowDiagram", () => {
  beforeEach(() => {
    vi.mocked(layoutDiagram).mockClear();
  });

  it("draws each node as a button with aria-pressed false", async () => {
    draw(baseSpec);
    const alpha = await screen.findByRole("button", { name: /Alpha/ });
    const beta = await screen.findByRole("button", { name: /Beta/ });
    expect(alpha).toHaveAttribute("aria-pressed", "false");
    expect(beta).toHaveAttribute("aria-pressed", "false");
    expect(alpha).toHaveAttribute("type", "button");
  });

  it("calls onSelect with the node id exactly once for a click", async () => {
    const onSelect = vi.fn();
    draw(baseSpec, { onSelect });
    // fireEvent sends only the click. userEvent.click also sends a mousedown without
    // a window, which the pan handler of React Flow (d3-zoom) cannot read in jsdom.
    fireEvent.click(await screen.findByRole("button", { name: /Beta/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("beta");
  });

  it("calls onSelect when the user presses Enter on a node", async () => {
    const onSelect = vi.fn();
    draw(baseSpec, { onSelect });
    const alpha = await screen.findByRole("button", { name: /Alpha/ });
    alpha.focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("calls onSelect when the user presses Space on a node", async () => {
    const onSelect = vi.fn();
    draw(baseSpec, { onSelect });
    const alpha = await screen.findByRole("button", { name: /Alpha/ });
    alpha.focus();
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("sets aria-pressed true only on the selected node", async () => {
    draw(baseSpec, { selectedId: "alpha" });
    expect(await screen.findByRole("button", { name: /Alpha/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByRole("button", { name: /Beta/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the text 'not used' on a skipped node only", async () => {
    draw(skippedSpec);
    const beta = await screen.findByRole("button", { name: /Beta/ });
    const alpha = await screen.findByRole("button", { name: /Alpha/ });
    expect(within(beta).getByText("not used")).toBeInTheDocument();
    expect(within(alpha).queryByText("not used")).not.toBeInTheDocument();
    expect(beta).toHaveAttribute("data-state", "skipped");
  });

  it("draws an edge path from the sections of the layout", async () => {
    const { container } = draw(baseSpec);
    await screen.findByRole("button", { name: /Beta/ });
    const path = container.querySelector(".archify-edge");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("d")).toMatch(/^M [\d.-]+ [\d.-]+ L /);
  });

  it("shows the lane label for a spec with lanes", async () => {
    draw(laneSpec);
    expect(await screen.findByText("Operations lane")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("shows the problems of an invalid spec in an alert and does not lay it out", () => {
    draw(invalidSpec);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/unknown target node "missing"/);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(layoutDiagram).not.toHaveBeenCalled();
  });

  it("shows an alert for a spec of the wrong shape and does not throw", () => {
    const wrongShape = { version: 1, nodes: [{ id: "alpha", label: "Alpha" }] };
    draw(wrongShape as unknown as DiagramSpec);
    expect(screen.getByRole("alert")).toHaveTextContent("edges");
    expect(layoutDiagram).not.toHaveBeenCalled();
  });

  it("shows an alert and logs the error when the layout fails", async () => {
    const error = new Error("ELK could not lay out the graph");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(layoutDiagram).mockRejectedValueOnce(error);
    draw(baseSpec);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      /^The diagram layout failed\.\s*ELK could not lay out the graph$/,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(log).toHaveBeenCalledWith("archify-react: layout failed", error);
    log.mockRestore();
  });

  it("ignores a layout result for a spec that the caller already replaced", async () => {
    let resolveFirst: (value: Awaited<ReturnType<typeof layoutDiagram>>) => void = () => {};
    const actual = await vi.importActual<typeof import("./layout")>("./layout");
    vi.mocked(layoutDiagram).mockImplementationOnce(
      () => new Promise((resolve) => (resolveFirst = resolve)),
    );
    const staleResult = await actual.layoutDiagram(baseSpec);
    const view = draw(baseSpec);
    view.rerender(
      <WorkflowDiagram
        spec={laneSpec}
        selectedId={null}
        onSelect={() => {}}
        height={400}
        ariaLabel="Decision trace"
      />,
    );
    expect(await screen.findByText("Operations lane")).toBeInTheDocument();
    // act() flushes the state update that a stale result would cause.
    await act(async () => {
      resolveFirst(staleResult);
    });
    expect(screen.getByText("Operations lane")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("draws an empty spec with no alert and no button", async () => {
    draw({ version: 1, nodes: [], edges: [] });
    const group = screen.getByRole("group", { name: "Decision trace" });
    await vi.waitFor(() => expect(group).not.toHaveAttribute("aria-busy"));
    expect(layoutDiagram).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // The zoom controls are buttons too, so the test looks for node buttons only.
    expect(group.querySelector("button.archify-node")).toBeNull();
    expect(group.querySelector(".react-flow")).not.toBeNull();
  });

  it("puts the aria label and the height on the group", () => {
    draw(baseSpec);
    const group = screen.getByRole("group", { name: "Decision trace" });
    expect(group).toHaveStyle({ height: "400px" });
  });

  describe("highlight", () => {
    const node = (name: string) => screen.findByRole("button", { name: new RegExp(name) });
    const dimmedNodes = (container: HTMLElement) =>
      Array.from(container.querySelectorAll("button[data-dimmed]")).map((b) =>
        b.textContent?.trim(),
      );
    // The edge group holds the path, the dot and the label, and carries data-dimmed.
    const edge = (container: HTMLElement, id: string) =>
      container.querySelector(`path#${id}`)?.closest(".archify-edge-group") ?? null;

    it("dims the nodes outside the reach of a hovered node", async () => {
      const { container } = draw(forkSpec);
      await userEvent.hover(await node("Node B"));
      // The reach of b is b and its upstream node a.
      expect(dimmedNodes(container).sort()).toEqual(["Node C", "Node D"]);
      expect(await node("Node A")).not.toHaveAttribute("data-dimmed");
      expect(await node("Node B")).not.toHaveAttribute("data-dimmed");
      expect(await node("Node C")).toHaveAttribute("data-dimmed", "true");
    });

    it("dims the edges that have an end outside the reach", async () => {
      const { container } = draw(forkSpec);
      await userEvent.hover(await node("Node B"));
      expect(edge(container, "ab")).not.toHaveAttribute("data-dimmed");
      expect(edge(container, "ac")).toHaveAttribute("data-dimmed", "true");
      expect(edge(container, "cd")).toHaveAttribute("data-dimmed", "true");
    });

    it("also dims the moving dot of a dimmed edge", async () => {
      const { container } = draw(forkSpec);
      const b = await node("Node B");
      const dotGroup = () =>
        container.querySelector(".archify-edge-dot")?.closest(".archify-edge-group");
      expect(dotGroup()).toBeTruthy();
      expect(dotGroup()).toBe(edge(container, "ac"));
      await userEvent.hover(b);
      expect(dotGroup()).toHaveAttribute("data-dimmed", "true");
      await userEvent.unhover(b);
      expect(dotGroup()).not.toHaveAttribute("data-dimmed");
    });

    it("also dims the label of a dimmed edge", async () => {
      const labelled: DiagramSpec = {
        ...forkSpec,
        edges: forkSpec.edges.map((e) => (e.id === "cd" ? { ...e, label: "next" } : e)),
      };
      draw(labelled);
      await userEvent.hover(await node("Node B"));
      const label = await screen.findByText("next");
      expect(label.closest(".archify-edge-group")).toHaveAttribute("data-dimmed", "true");
    });

    it("never dims a lane label, also when it dims a node of the lane", async () => {
      // gamma has no path to or from alpha, so it is outside the reach of alpha.
      const spec: DiagramSpec = {
        ...laneSpec,
        nodes: [...laneSpec.nodes, { id: "gamma", label: "Gamma", lane: "ops" }],
      };
      const { container } = draw(spec);
      await userEvent.hover(await node("Alpha"));
      // This proves that the dimming runs in this fixture.
      expect(await node("Gamma")).toHaveAttribute("data-dimmed", "true");
      expect(await node("Beta")).not.toHaveAttribute("data-dimmed");
      expect(container.querySelector(".archify-lane")).not.toHaveAttribute("data-dimmed");
      expect(container.querySelector('[data-id="lane:ops"]')).not.toHaveAttribute("data-dimmed");
    });

    it("leaves no data-dimmed attribute after the pointer leaves", async () => {
      const { container } = draw(forkSpec);
      const b = await node("Node B");
      await userEvent.hover(b);
      expect(container.querySelector("[data-dimmed]")).not.toBeNull();
      await userEvent.unhover(b);
      expect(container.querySelector("[data-dimmed]")).toBeNull();
    });

    it("dims on keyboard focus and clears on blur", async () => {
      const { container } = draw(forkSpec);
      const b = await node("Node B");
      act(() => b.focus());
      expect(dimmedNodes(container).sort()).toEqual(["Node C", "Node D"]);
      expect(edge(container, "ac")).toHaveAttribute("data-dimmed", "true");
      act(() => b.blur());
      expect(container.querySelector("[data-dimmed]")).toBeNull();
    });

    it("dims nothing when highlight is false", async () => {
      const { container } = draw(forkSpec, { highlight: false });
      const b = await node("Node B");
      await userEvent.hover(b);
      expect(container.querySelector("[data-dimmed]")).toBeNull();
      act(() => b.focus());
      expect(container.querySelector("[data-dimmed]")).toBeNull();
    });

    it("shows only the reach of the second node after the pointer moves to it", async () => {
      const { container } = draw(forkSpec);
      await userEvent.hover(await node("Node B"));
      await userEvent.hover(await node("Node C"));
      // The reach of c is c, its upstream a and its downstream d.
      expect(dimmedNodes(container)).toEqual(["Node B"]);
      expect(edge(container, "ab")).toHaveAttribute("data-dimmed", "true");
      expect(edge(container, "ac")).not.toHaveAttribute("data-dimmed");
      expect(edge(container, "cd")).not.toHaveAttribute("data-dimmed");
    });

    it("includes the nodes of both directions in the reach", async () => {
      const { container } = draw(forkSpec);
      await userEvent.hover(await node("Node C"));
      expect(dimmedNodes(container)).toEqual(["Node B"]);
    });

    it("dims an edge that bypasses the active node", async () => {
      const bypassSpec: DiagramSpec = {
        version: 1,
        nodes: [
          { id: "a", label: "Node A" },
          { id: "b", label: "Node B" },
          { id: "c", label: "Node C" },
          { id: "d", label: "Node D" },
        ],
        edges: [
          { id: "ab", source: "a", target: "b" },
          { id: "bd", source: "b", target: "d" },
          { id: "ad", source: "a", target: "d" },
          { id: "ac", source: "a", target: "c" },
        ],
      };
      const { container } = draw(bypassSpec);
      await userEvent.hover(await node("Node B"));
      expect(edge(container, "ab")).not.toHaveAttribute("data-dimmed");
      expect(edge(container, "bd")).not.toHaveAttribute("data-dimmed");
      expect(edge(container, "ad")).toHaveAttribute("data-dimmed", "true");
      expect(edge(container, "ac")).toHaveAttribute("data-dimmed", "true");
    });

    it("finishes for a spec with a cycle", async () => {
      const { container } = draw(cycleSpec);
      await userEvent.hover(await node("Node B"));
      expect(dimmedNodes(container)).toEqual(["Node D"]);
      expect(edge(container, "ad")).toHaveAttribute("data-dimmed", "true");
    });

    it("does not call onSelect for a hover and calls it once for a click", async () => {
      const onSelect = vi.fn();
      draw(forkSpec, { onSelect });
      const b = await node("Node B");
      await userEvent.hover(b);
      expect(onSelect).not.toHaveBeenCalled();
      fireEvent.click(b);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith("b");
    });

    it("drops the dimming when the spec replaces the active node", async () => {
      const view = draw(forkSpec);
      await userEvent.hover(await node("Node D"));
      view.rerender(
        <WorkflowDiagram
          spec={baseSpec}
          selectedId={null}
          onSelect={() => {}}
          height={400}
          ariaLabel="Decision trace"
        />,
      );
      await screen.findByRole("button", { name: /Beta/ });
      expect(view.container.querySelector("[data-dimmed]")).toBeNull();
    });
  });

  describe("a new spec object", () => {
    const redraw = (view: ReturnType<typeof draw>, spec: DiagramSpec) =>
      view.rerender(
        <WorkflowDiagram
          spec={spec}
          selectedId={null}
          onSelect={() => {}}
          height={400}
          ariaLabel="Decision trace"
        />,
      );

    it("keeps the active node when the new spec has the same content", async () => {
      const view = draw(forkSpec);
      await userEvent.hover(await screen.findByRole("button", { name: /Node D/ }));
      expect(view.container.querySelector("[data-dimmed]")).not.toBeNull();
      redraw(view, structuredClone(forkSpec));
      expect(view.container.querySelector("button[data-dimmed]")).not.toBeNull();
    });

    it("keeps the node buttons and the focus, and does not lay out again", async () => {
      const view = draw(forkSpec);
      const b = await screen.findByRole("button", { name: /Node B/ });
      act(() => b.focus());
      redraw(view, structuredClone(forkSpec));
      expect(screen.getByRole("button", { name: /Node B/ })).toBe(b);
      expect(document.activeElement).toBe(b);
      await act(async () => {});
      expect(screen.getByRole("button", { name: /Node B/ })).toBe(b);
      expect(layoutDiagram).toHaveBeenCalledTimes(1);
    });

    it("shows a new state at once and does not lay out again", async () => {
      const view = draw(forkSpec);
      await screen.findByRole("button", { name: /Node B/ });
      const failed = structuredClone(forkSpec);
      failed.nodes[1].state = "failed";
      failed.edges[0].state = "skipped";
      redraw(view, failed);
      expect(screen.getByRole("button", { name: /Node B/ })).toHaveAttribute(
        "data-state",
        "failed",
      );
      expect(view.container.querySelector("path#ab")).toHaveAttribute("data-state", "skipped");
      await act(async () => {});
      expect(layoutDiagram).toHaveBeenCalledTimes(1);
    });

    it("lays out again for a new label and keeps the last layout until the new one arrives", async () => {
      const view = draw(forkSpec);
      await screen.findByRole("button", { name: /Node B/ });
      const renamed = structuredClone(forkSpec);
      renamed.nodes[1].label = "Node B2";
      redraw(view, renamed);
      expect(screen.getByRole("button", { name: /Node A/ })).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /Node B2/ })).toBeInTheDocument();
      expect(layoutDiagram).toHaveBeenCalledTimes(2);
    });

    it("lays out again for a new edge and draws it", async () => {
      const view = draw(forkSpec);
      await screen.findByRole("button", { name: /Node B/ });
      const more = structuredClone(forkSpec);
      more.edges.push({ id: "bd", source: "b", target: "d" });
      redraw(view, more);
      await vi.waitFor(() => expect(view.container.querySelector("path#bd")).not.toBeNull());
      expect(layoutDiagram).toHaveBeenCalledTimes(2);
    });
  });

  describe("the busy state", () => {
    it("sets aria-busy on the group while the layout runs, and removes it after", async () => {
      draw(baseSpec);
      const group = screen.getByRole("group", { name: "Decision trace" });
      expect(group).toHaveAttribute("aria-busy", "true");
      await screen.findByRole("button", { name: /Beta/ });
      expect(group).not.toHaveAttribute("aria-busy");
    });
  });

  describe("the kind of a node", () => {
    const kindSpec: DiagramSpec = {
      version: 1,
      nodes: [
        { id: "start", label: "Begin", kind: "start" },
        { id: "choose", label: "Choose", kind: "decision" },
        { id: "work", label: "Work" },
        { id: "end", label: "Finish", kind: "end" },
      ],
      edges: [],
    };

    it("sets data-kind on each node button, with step as the default", async () => {
      draw(kindSpec);
      expect(await screen.findByRole("button", { name: /Begin/ })).toHaveAttribute(
        "data-kind",
        "start",
      );
      expect(screen.getByRole("button", { name: /Choose/ })).toHaveAttribute(
        "data-kind",
        "decision",
      );
      expect(screen.getByRole("button", { name: /Work/ })).toHaveAttribute("data-kind", "step");
      expect(screen.getByRole("button", { name: /Finish/ })).toHaveAttribute("data-kind", "end");
    });

    it("gives the kind in words to assistive technology, but not for a step", async () => {
      draw(kindSpec);
      expect(await screen.findByRole("button", { name: /Choose.*decision/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Begin.*start/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Finish.*end/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Work/ })).toHaveAccessibleName("Work");
    });
  });

  it("shows the full label as a tooltip, because a long label is cut", async () => {
    draw(baseSpec);
    expect(await screen.findByRole("button", { name: /Alpha/ })).toHaveAttribute("title", "Alpha");
  });

  describe("the failed state", () => {
    it("says in words that a node failed, not with a colour only", async () => {
      draw({
        ...baseSpec,
        nodes: [
          { id: "alpha", label: "Alpha", state: "used" },
          { id: "beta", label: "Beta", state: "failed" },
        ],
      });
      expect(await screen.findByRole("button", { name: /Beta.*failed/ })).toHaveAttribute(
        "data-state",
        "failed",
      );
      expect(screen.getByRole("button", { name: /Alpha/ })).not.toHaveTextContent("failed");
    });
  });

  it("keeps the node wrapper a pointer target, so that hover and click reach the button", async () => {
    const { container } = draw(baseSpec);
    const button = await screen.findByRole("button", { name: /Alpha/ });
    expect(container.querySelector(".react-flow__node-step")).toHaveStyle({ pointerEvents: "all" });
    expect(button.style.pointerEvents).toBe("");
  });

  it("marks the node button nopan, so that a drag on a node does not pan the diagram", async () => {
    draw(baseSpec);
    expect(await screen.findByRole("button", { name: /Alpha/ })).toHaveClass("nopan");
  });

  it("leaves the nodes unselectable by React Flow, because the app owns selection", async () => {
    const { container } = draw(baseSpec);
    await screen.findByRole("button", { name: /Beta/ });
    expect(container.querySelector(".react-flow__node-step.selectable")).toBeNull();
  });
});
