import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";

afterEach(() => {
  document.documentElement.className = "";
});

describe("App", () => {
  it("shows the current page as the title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Overview");
  });

  it("marks the selected page in the navigation", async () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });

    await userEvent.click(within(nav).getByRole("button", { name: /Services/ }));

    expect(within(nav).getByRole("button", { name: /Services/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("button", { name: /Overview/ })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Services");
  });

  it("shows each service with its status", () => {
    render(<App />);
    const failed = screen.getByRole("row", { name: /gamma-app/ });
    expect(within(failed).getByText("Failed")).toBeInTheDocument();
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
