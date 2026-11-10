import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";

afterEach(() => {
  document.documentElement.className = "";
});

describe("App", () => {
  it("shows the title of the demo", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Workflow diagrams");
  });

  it("shows three diagrams, each with a title", async () => {
    render(<App />);
    const titles = ["Decision trace", "Approval with lanes", "Retry loop"];
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(titles);
    for (const title of titles) {
      const group = screen.getByRole("group", { name: title });
      expect((await within(group).findAllByRole("button")).length).toBeGreaterThanOrEqual(4);
    }
  });

  it("shows the label and the summary of the selected node under its own diagram only", async () => {
    render(<App />);
    const retry = screen.getByRole("group", { name: "Retry loop" });
    // fireEvent: user-event sends a mousedown without a view, and the pan code of React Flow needs it.
    fireEvent.click(await within(retry).findByRole("button", { name: /Wait and retry/ }));

    const panels = document.querySelectorAll("[data-selection]");
    expect(panels).toHaveLength(3);
    expect(panels[2]).toHaveTextContent("Wait and retry");
    expect(panels[2]).toHaveTextContent("The job waits twice as long as before");
    expect(panels[0]).toHaveTextContent("Select a step");
    expect(panels[1]).toHaveTextContent("Select a step");
  });

  it("switches to the dark theme and back", async () => {
    render(<App />);
    const root = document.documentElement;

    await userEvent.click(screen.getByRole("button", { name: "Dark theme" }));
    expect(root).toHaveClass("dark");

    await userEvent.click(screen.getByRole("button", { name: "Light theme" }));
    expect(root).toHaveClass("light");
    expect(root).not.toHaveClass("dark");
  });
});
