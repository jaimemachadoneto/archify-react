import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LayoutResult } from "@/diagram/layout";
import { layoutDiagram } from "@/diagram/layout";
import type { DiagramSpec } from "@/diagram/spec";
import Playground from "./Playground";

// This mock puts the nodes in a row or in a column. It replaces ELK, which is slow in jsdom.
vi.mock("@/diagram/layout", () => ({
  layoutDiagram: vi.fn(async (spec: DiagramSpec): Promise<LayoutResult> => {
    const down = spec.direction === "DOWN";
    return {
      nodes: spec.nodes.map((node, index) => ({
        ...node,
        x: down ? 0 : index * 150,
        y: down ? index * 100 : 0,
        width: 100,
        height: 50,
      })),
      edges: spec.edges.map((edge) => ({ ...edge, sections: [] })),
      lanes: [],
    };
  }),
}));

const lastSpec = (): DiagramSpec => {
  const calls = vi.mocked(layoutDiagram).mock.calls;
  return calls[calls.length - 1][0];
};

const textarea = () => screen.getByRole("textbox", { name: "Spec JSON" }) as HTMLTextAreaElement;
const nodeButtons = () => screen.findAllByRole("button", { pressed: false });

describe("Playground", () => {
  beforeEach(() => {
    vi.mocked(layoutDiagram).mockClear();
  });

  it("draws the valid preset with lanes and shows its JSON", async () => {
    render(<Playground />);
    expect((await nodeButtons()).length).toBeGreaterThanOrEqual(4);
    const spec = JSON.parse(textarea().value) as DiagramSpec;
    expect(spec.lanes?.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names each control", () => {
    render(<Playground />);
    expect(screen.getByRole("radio", { name: "RIGHT" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "DOWN" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Highlight" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Spec preset" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Look" })).toHaveValue("host");
    expect(textarea()).toBeInTheDocument();
  });

  it("sets the direction of the spec and rewrites the JSON", async () => {
    render(<Playground />);
    await nodeButtons();
    await userEvent.click(screen.getByRole("radio", { name: "DOWN" }));
    expect(screen.getByRole("radio", { name: "DOWN" })).toBeChecked();
    expect((JSON.parse(textarea().value) as DiagramSpec).direction).toBe("DOWN");
    await vi.waitFor(() => expect(lastSpec().direction).toBe("DOWN"));
  });

  it("keeps the direction when the user chooses another preset", async () => {
    render(<Playground />);
    await userEvent.click(screen.getByRole("radio", { name: "DOWN" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Spec preset" }),
      "Pinned positions",
    );
    expect((JSON.parse(textarea().value) as DiagramSpec).direction).toBe("DOWN");
  });

  it("dims the nodes outside the path only when Highlight is on", async () => {
    render(<Playground />);
    await nodeButtons();
    // "Ask engineer" is on the other branch of the decision, so it is outside the path of "Send answer".
    const answer = screen.getByRole("button", { name: /Send answer/ });
    const engineer = screen.getByRole("button", { name: /Ask engineer/ });

    await userEvent.hover(answer);
    expect(engineer).toHaveAttribute("data-dimmed", "true");
    expect(answer).not.toHaveAttribute("data-dimmed");
    await userEvent.unhover(answer);
    expect(engineer).not.toHaveAttribute("data-dimmed");

    await userEvent.click(screen.getByRole("checkbox", { name: "Highlight" }));
    expect(screen.getByRole("checkbox", { name: "Highlight" })).not.toBeChecked();
    await userEvent.hover(answer);
    expect(engineer).not.toHaveAttribute("data-dimmed");
  });

  it("shows pinned positions in the Pinned positions preset", async () => {
    render(<Playground />);
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Spec preset" }),
      "Pinned positions",
    );
    const spec = JSON.parse(textarea().value) as DiagramSpec;
    expect(spec.nodes.filter((node) => node.position).length).toBeGreaterThanOrEqual(2);
    await vi.waitFor(() => expect(lastSpec().nodes.some((n) => n.position)).toBe(true));
    expect((await nodeButtons()).length).toBe(spec.nodes.length);
  });

  it("shows the problem list of the diagram for the Invalid spec preset, and no second alert", async () => {
    render(<Playground />);
    await nodeButtons();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Spec preset" }),
      "Invalid spec",
    );
    const alert = await screen.findByRole("alert");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(alert).toHaveTextContent("The diagram spec is not valid.");
    expect(within(alert).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(alert).toHaveTextContent(/more than once/);
    expect(alert).toHaveTextContent(/unknown target node/);
  });

  it("keeps the last good spec on the diagram when the text is not valid JSON", async () => {
    render(<Playground />);
    const before = await nodeButtons();
    fireEvent.change(textarea(), { target: { value: '{ "version": 1, ' } });

    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent(/not valid JSON/);
    expect(textarea()).toHaveAttribute("aria-invalid", "true");
    expect(textarea()).toHaveAccessibleDescription(/not valid JSON/);
    // The text stays as the user typed it.
    expect(textarea().value).toBe('{ "version": 1, ');
    expect(await nodeButtons()).toHaveLength(before.length);
  });

  it("clears the error when the text is valid JSON again", async () => {
    render(<Playground />);
    await nodeButtons();
    const good = textarea().value;
    fireEvent.change(textarea(), { target: { value: "{" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(textarea(), { target: { value: good } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("passes JSON that is not a valid spec to the diagram, which shows the problems", async () => {
    render(<Playground />);
    await nodeButtons();
    fireEvent.change(textarea(), {
      target: { value: '{ "version": 2, "nodes": [], "edges": [] }' },
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The diagram spec is not valid.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("draws a spec that the user edits in the text", async () => {
    render(<Playground />);
    await nodeButtons();
    const edited: DiagramSpec = {
      version: 1,
      nodes: [{ id: "only", label: "Only step" }],
      edges: [],
    };
    fireEvent.change(textarea(), { target: { value: JSON.stringify(edited) } });
    expect(await screen.findByRole("button", { name: /Only step/ })).toBeInTheDocument();
  });

  it("does not rewrite the text while the user types", async () => {
    render(<Playground />);
    await nodeButtons();
    const compact = '{"version":1,"nodes":[{"id":"a","label":"Alpha"}],"edges":[]}';
    fireEvent.change(textarea(), { target: { value: compact } });
    await screen.findByRole("button", { name: /Alpha/ });
    expect(textarea().value).toBe(compact);
  });

  it("follows the direction in the text with the direction control", async () => {
    render(<Playground />);
    await nodeButtons();
    const spec = JSON.parse(textarea().value) as DiagramSpec;
    fireEvent.change(textarea(), {
      target: { value: JSON.stringify({ ...spec, direction: "DOWN" }) },
    });
    expect(screen.getByRole("radio", { name: "DOWN" })).toBeChecked();
  });

  it("selects a node and shows the ID of the spec, not an ID inside React Flow", async () => {
    render(<Playground />);
    await nodeButtons();
    const triage = screen.getByRole("button", { name: /Triage/ });
    fireEvent.click(triage);
    expect(triage).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selected step ID: triage")).toBeInTheDocument();
  });

  it("clears the selected text when the user clicks the empty pane", async () => {
    const { container } = render(<Playground />);
    await nodeButtons();
    fireEvent.click(screen.getByRole("button", { name: /Triage/ }));
    expect(screen.getByText("Selected step ID: triage")).toBeInTheDocument();
    fireEvent.click(container.querySelector(".react-flow__pane")!);
    expect(screen.getByText("Select a step to see its ID.")).toBeInTheDocument();
  });

  it("clears the selection when another preset has no such step", async () => {
    render(<Playground />);
    await nodeButtons();
    fireEvent.click(screen.getByRole("button", { name: /Triage/ }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Spec preset" }),
      "Pinned positions",
    );
    expect(screen.getByText("Select a step to see its ID.")).toBeInTheDocument();
  });

  it("clears the selection when the edited text removes the selected step", async () => {
    render(<Playground />);
    await nodeButtons();
    fireEvent.click(screen.getByRole("button", { name: /Triage/ }));
    const only: DiagramSpec = { version: 1, nodes: [{ id: "x", label: "X" }], edges: [] };
    fireEvent.change(textarea(), { target: { value: JSON.stringify(only) } });
    await screen.findByRole("button", { name: /^X/ });
    expect(screen.getByText("Select a step to see its ID.")).toBeInTheDocument();
  });

  it("survives JSON that is not an object, and the direction control restores the preset", async () => {
    render(<Playground />);
    await nodeButtons();
    for (const text of ["null", "[]", "42", '"text"']) {
      fireEvent.change(textarea(), { target: { value: text } });
      expect((await screen.findAllByRole("alert")).length).toBeGreaterThanOrEqual(1);
    }
    fireEvent.change(textarea(), { target: { value: "null" } });
    await userEvent.click(screen.getByRole("radio", { name: "DOWN" }));
    const restored = JSON.parse(textarea().value) as DiagramSpec;
    expect(restored.direction).toBe("DOWN");
    expect(restored.nodes.length).toBeGreaterThan(0);
  });

  it("keeps the text that the user types when the direction changes and the text is not valid JSON", async () => {
    render(<Playground />);
    await nodeButtons();
    const half = '{ "version": 1, "nodes": [';
    fireEvent.change(textarea(), { target: { value: half } });
    await userEvent.click(screen.getByRole("radio", { name: "DOWN" }));
    expect(textarea().value).toBe(half);
    expect(screen.getByRole("alert")).toHaveTextContent(/not valid JSON/);
  });

  it("keeps the text when the direction changes and the text has a field that cannot be written back", async () => {
    render(<Playground />);
    await nodeButtons();
    // A text that is valid JSON but that JSON.stringify cannot write again would throw. The text stays.
    const deep = "[".repeat(5000) + "]".repeat(5000);
    const text = `{"version":1,"nodes":[],"edges":[],"x":${deep}}`;
    fireEvent.change(textarea(), { target: { value: text } });
    await userEvent.click(screen.getByRole("radio", { name: "DOWN" }));
    expect(screen.getByRole("radio", { name: "DOWN" })).toBeChecked();
    expect(textarea().value).toBe(text);
  });

  it("does not parse a text that is longer than the limit, and says so", async () => {
    render(<Playground />);
    await nodeButtons();
    const before = vi.mocked(layoutDiagram).mock.calls.length;
    fireEvent.change(textarea(), { target: { value: " ".repeat(300_001) } });
    expect(screen.getByRole("alert")).toHaveTextContent(/too long/);
    expect(vi.mocked(layoutDiagram).mock.calls.length).toBe(before);
  });

  it("tells the reader what the Custom palette changes", () => {
    render(<Playground />);
    expect(screen.getByText(/--archify-\* variables/)).toBeInTheDocument();
  });

  it("offers a way back to the preset after the user edits the text", async () => {
    render(<Playground />);
    await nodeButtons();
    fireEvent.change(textarea(), { target: { value: '{"version":1,"nodes":[],"edges":[]}' } });
    await userEvent.click(screen.getByRole("button", { name: "Reset the JSON" }));
    expect((JSON.parse(textarea().value) as DiagramSpec).lanes?.length).toBeGreaterThanOrEqual(2);
  });

  it("sets a class on the wrapper for the custom palette", async () => {
    const { container } = render(<Playground />);
    const wrapper = container.querySelector(".playground") as HTMLElement;
    expect(wrapper).not.toHaveClass("playground--custom");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Look" }), "Custom palette");
    expect(wrapper).toHaveClass("playground--custom");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Look" }), "Host variables");
    expect(wrapper).not.toHaveClass("playground--custom");
    expect(wrapper.querySelector(".archify-diagram")).not.toBeNull();
  });
});
