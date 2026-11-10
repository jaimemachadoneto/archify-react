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

// a -> b and a -> c fork, and c -> d continues one branch.
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

  it("shows an alert when the layout fails", async () => {
    vi.mocked(layoutDiagram).mockRejectedValueOnce(new Error("ELK could not lay out the graph"));
    draw(baseSpec);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("ELK could not lay out the graph");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
    const edge = (container: HTMLElement, id: string) => container.querySelector(`path#${id}`);

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
      expect(container.querySelector(".archify-edge-dot")).not.toBeNull();
      await userEvent.hover(b);
      expect(container.querySelector(".archify-edge-dot")).toHaveAttribute("data-dimmed", "true");
      await userEvent.unhover(b);
      expect(container.querySelector(".archify-edge-dot")).not.toHaveAttribute("data-dimmed");
    });

    it("never dims a lane label", async () => {
      const { container } = draw(laneSpec);
      await userEvent.hover(await node("Alpha"));
      expect(container.querySelector(".archify-lane")).not.toHaveAttribute("data-dimmed");
      expect(await node("Beta")).not.toHaveAttribute("data-dimmed");
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

  it("leaves the nodes unselectable by React Flow, because the app owns selection", async () => {
    const { container } = draw(baseSpec);
    await screen.findByRole("button", { name: /Beta/ });
    expect(container.querySelector(".react-flow__node-step.selectable")).toBeNull();
  });
});
