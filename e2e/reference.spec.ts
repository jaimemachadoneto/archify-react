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

  for (const width of [1280, 390]) {
    test(`keeps the page navigation where it is when the view changes (${width} px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      const nav = page.getByRole("navigation", { name: "Pages" });
      const text = page.locator("header p").last();
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 2, name: "Playground" })).toBeVisible();
      const demo = { nav: await nav.boundingBox(), text: await text.boundingBox() };
      await nav.getByRole("link", { name: "Reference" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Reference" })).toBeVisible();
      const reference = { nav: await nav.boundingBox(), text: await text.boundingBox() };
      expect(reference.nav!.y).toBe(demo.nav!.y);
      expect(reference.text!.y).toBe(demo.text!.y);
      expect(reference.text!.height).toBe(demo.text!.height);
    });
  }

  test("has links of at least 44 by 44 pixels, with no gap between wrapped rows, on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#reference");
    const links = page.getByRole("navigation").getByRole("link");
    const boxes = await links.evaluateAll((all) =>
      all.map((link) => {
        const box = link.getBoundingClientRect();
        return {
          text: link.textContent,
          width: box.width,
          height: box.height,
          top: box.top,
          bottom: box.bottom,
        };
      }),
    );
    expect(boxes.length).toBe(7);
    for (const box of boxes) {
      expect(box.width, `${box.text} width`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${box.text} height`).toBeGreaterThanOrEqual(44);
    }
    // The links of the contents wrap to a second row. A row starts where the row before it ends.
    const contents = boxes.slice(2);
    const rows = [...new Set(contents.map((box) => Math.round(box.top)))].sort((a, b) => a - b);
    expect(rows.length, "the contents wrap on a phone").toBeGreaterThan(1);
    const bottom = Math.max(
      ...contents.filter((b) => Math.round(b.top) === rows[0]).map((b) => b.bottom),
    );
    expect(rows[1] - bottom).toBeLessThanOrEqual(1);
  });

  test("frames a table with a border of at least 3 to 1 against the page", async ({ page }) => {
    await page.goto("/#reference");
    const ratio = await page.getByRole("region", { name: "Props" }).evaluate((region) => {
      const luminance = (colour: string) => {
        const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
          const c = Number(value) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const frame = luminance(getComputedStyle(region).borderTopColor);
      const background = luminance(getComputedStyle(document.body).backgroundColor);
      return (Math.max(frame, background) + 0.05) / (Math.min(frame, background) + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  test("keeps the name of a row in view after a sideways scroll, and shows the hint on a phone only", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#reference");
    const hint = page.getByText("Scroll sideways to see all the columns.").first();
    await expect(hint).toBeVisible();
    const region = page.getByRole("region", { name: "Props" });
    await region.evaluate((el) => (el.scrollLeft = 200));
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    const regionBox = (await region.boundingBox())!;
    const name = page
      .getByRole("table", { name: "Props of WorkflowDiagram" })
      .getByRole("rowheader", {
        name: "selectedId",
      });
    const nameBox = (await name.boundingBox())!;
    expect(nameBox.x).toBeGreaterThanOrEqual(regionBox.x - 1);
    expect(nameBox.x).toBeLessThanOrEqual(regionBox.x + 4);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(hint).toBeHidden();
  });
});
