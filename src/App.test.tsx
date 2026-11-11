import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  document.documentElement.className = "";
  window.location.hash = "";
});

describe("App", () => {
  it("shows the title of the demo", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Workflow diagrams");
  });

  it("shows three diagrams and the playground, each with a title", async () => {
    render(<App />);
    const titles = ["Decision trace", "Approval with lanes", "Retry loop"];
    // The playground has the fourth heading.
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      ...titles,
      "Playground",
    ]);
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

  it("opens the demo for an empty hash and for a hash that is not a page", () => {
    window.location.hash = "#playground";
    render(<App />);
    expect(screen.getByRole("heading", { level: 2, name: "Playground" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Reference" })).not.toBeInTheDocument();
  });

  it("links to the reference page from the top of the demo", async () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Pages" });
    expect(within(nav).getByRole("link", { name: "Demo" })).toHaveAttribute("aria-current", "page");
    const link = within(nav).getByRole("link", { name: "Reference" });
    expect(link).toHaveAttribute("href", "#reference");
    expect(link).not.toHaveAttribute("aria-current");

    await userEvent.click(link);
    expect(await screen.findByRole("heading", { level: 2, name: "Reference" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Playground" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Decision trace" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Reference" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Workflow diagrams");
  });

  it("goes back to the demo with the link Demo", async () => {
    window.location.hash = "#reference";
    render(<App />);
    expect(screen.getByRole("heading", { level: 2, name: "Reference" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Demo" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "Playground" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Reference" })).not.toBeInTheDocument();
  });

  it("keeps the reference page open for a link to one of its parts", async () => {
    window.location.hash = "#reference";
    render(<App />);
    await userEvent.click(screen.getByRole("link", { name: "Problem codes" }));
    expect(window.location.hash).toBe("#reference-codes");
    expect(screen.getByRole("heading", { level: 2, name: "Reference" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Problem codes" })).toBeInTheDocument();
  });

  it("scrolls to the part of the reference page that the first hash names", () => {
    // The browser looks for the fragment before React draws the page, so the app must scroll.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#reference-codes";
    render(<App />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("reference-codes"));
  });

  it("does not scroll for the hash of the page itself", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#reference";
    render(<App />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("switches to the dark theme and back", async () => {
    render(<App />);
    const root = document.documentElement;

    await userEvent.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(root).toHaveClass("dark");

    await userEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(root).toHaveClass("light");
    expect(root).not.toHaveClass("dark");
  });
});
