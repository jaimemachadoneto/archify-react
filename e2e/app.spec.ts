import { expect, test } from "@playwright/test";

// The page must use the shared colours in both modes: the body background is
// the --background token, never a value that a component sets by itself.
test("the page uses the shared background colour", async ({ page }, testInfo) => {
  await page.goto("/");
  const [background, token] = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.color = "var(--background)";
    document.body.append(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    return [getComputedStyle(document.body).backgroundColor, want];
  });
  expect(background).toBe(token);
  await page.screenshot({ path: testInfo.outputPath("page.png"), fullPage: true });
});

test.describe("the theme button", () => {
  const button = (page: import("@playwright/test").Page) =>
    page.getByRole("button", { name: /Switch to (light|dark) theme/ });

  test("is at least 44 by 44 pixels on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const box = await button(page).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("keeps its small size on a wide window", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const box = await button(page).boundingBox();
    expect(box!.width).toBe(36);
    expect(box!.height).toBe(36);
  });
});
