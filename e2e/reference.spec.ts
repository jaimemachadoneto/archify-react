import { expect, test, type Page } from "@playwright/test";
import { PROBLEM_CODES } from "../src/diagram/spec";
import { MAX_EDGES, MAX_LABEL_LENGTH, MAX_NODES, MAX_POSITION } from "../src/diagram/validate";

// The cells of the body rows of one table, by the name of the table.
async function rowsOf(page: Page, name: string): Promise<string[][]> {
  return page
    .getByRole("table", { name })
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) => [...row.querySelectorAll("th, td")].map((cell) => cell.textContent ?? "")),
    );
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("the reference page", () => {
  test("loads with no console error and shows the values of the library", async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/#reference");
    await expect(page.getByRole("heading", { level: 2, name: "Reference" })).toBeVisible();

    const codes = await rowsOf(page, "Problem codes");
    expect(codes.map(([code]) => code)).toEqual([...PROBLEM_CODES]);

    const limits = Object.fromEntries(
      await rowsOf(page, "Limits").then((r) => r.map((c) => c.slice(0, 2))),
    );
    expect(limits).toEqual({
      MAX_NODES: String(MAX_NODES),
      MAX_EDGES: String(MAX_EDGES),
      MAX_LABEL_LENGTH: String(MAX_LABEL_LENGTH),
      MAX_POSITION: String(MAX_POSITION),
    });

    // The demo does not load on this page.
    await expect(page.getByRole("heading", { level: 2, name: "Playground" })).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("reference.png"), fullPage: true });
  });

  test("opens from the link at the top of the demo and goes back", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Playground" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Pages" })
      .getByRole("link", { name: "Reference" })
      .click();
    await expect(page).toHaveURL(/#reference$/);
    await expect(page.getByRole("heading", { level: 2, name: "Reference" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Playground" })).toHaveCount(0);

    await page
      .getByRole("navigation", { name: "Pages" })
      .getByRole("link", { name: "Demo" })
      .click();
    await expect(page.getByRole("heading", { level: 2, name: "Playground" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Reference" })).toHaveCount(0);
    await expect(
      page.getByRole("group", { name: "Decision trace" }).locator("button.archify-node").first(),
    ).toBeVisible();

    // The back button of the browser returns to the page that opened the reference.
    await page.goBack();
    await expect(page.getByRole("heading", { level: 2, name: "Reference" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("opens at a part of the page for a link with a part", async ({ page }) => {
    await page.goto("/#reference-codes");
    await expect(page.getByRole("heading", { level: 2, name: "Reference" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Problem codes" })).toBeInViewport();
  });

  test("does not scroll the page sideways on a phone, and a wide table scrolls in its box", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#reference");
    await expect(page.getByRole("table", { name: "Props of WorkflowDiagram" })).toBeVisible();

    const page_ = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(page_.scroll).toBeLessThanOrEqual(page_.client);

    const box = await page
      .getByRole("region", { name: "Props" })
      .evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
    expect(box.scroll, "the table is wider than its box").toBeGreaterThan(box.client);
  });
});
