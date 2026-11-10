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
