import { expect, test } from "@playwright/test";

// These tests use the signals that the section "Test a host" of the README gives.
test("a test waits for the layout with aria-busy and the node buttons", async ({ page }) => {
  await page.goto("/");
  const diagram = page.getByRole("group", { name: "Decision trace" });
  await expect(diagram).not.toHaveAttribute("aria-busy");
  await expect(diagram.getByRole("button", { name: /Receive request/ })).toBeVisible();
  // The demo spec has 8 nodes. Every node button is inside a React Flow node.
  await expect(diagram.locator("button.archify-node")).toHaveCount(8);
});

test("a node has the data-id with the step: prefix and the ID of the spec", async ({ page }) => {
  await page.goto("/");
  const diagram = page.getByRole("group", { name: "Decision trace" });
  await expect(diagram).not.toHaveAttribute("aria-busy");
  const node = diagram.locator('[data-id="step:trace-start"]');
  await expect(node).toHaveCount(1);
  await expect(node.getByRole("button", { name: /Receive request/ })).toBeVisible();
  // An ID without the prefix matches nothing.
  await expect(diagram.locator('[data-id="trace-start"]')).toHaveCount(0);
});
