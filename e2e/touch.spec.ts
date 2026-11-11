import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";

// A phone: a narrow window with touch input and a coarse pointer.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const title = "Retry loop";
const diagram = (page: Page): Locator => page.getByRole("group", { name: title });
const nodes = (page: Page): Locator => diagram(page).locator("button.archify-node");
const pane = (page: Page): Locator => diagram(page).locator(".react-flow__pane");

async function openDemo(page: Page): Promise<void> {
  await page.goto("/");
  await expect(nodes(page).first()).toBeVisible();
  await expect(nodes(page).filter({ hasText: "Wait and retry" })).toHaveCount(1);
}

// Put the diagram in the middle of the window, so a swipe starts and ends inside it.
async function centre(page: Page): Promise<void> {
  await diagram(page).evaluate((el) => el.scrollIntoView({ block: "center" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const now = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.scrollY)).toBe(now);
}

// A point on the pane where no node, edge or control is under the finger.
async function emptyPanePoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await pane(page).evaluate((el) => {
    const box = el.getBoundingClientRect();
    for (let y = box.top + 8; y < box.bottom - 8; y += 8) {
      for (let x = box.left + 8; x < box.right - 8; x += 8) {
        if (document.elementFromPoint(x, y) === el) return { x, y };
      }
    }
    return null;
  });
  expect(point, "an empty point on the pane").not.toBeNull();
  return point!;
}

async function swipeUp(cdp: CDPSession, x: number, y: number): Promise<void> {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 10; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - step * 12 }],
    });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test.describe("touch input on a phone", () => {
  test("uses a coarse pointer, and the pane lets a vertical swipe scroll the page", async ({
    page,
  }) => {
    await openDemo(page);
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    await expect(pane(page)).toHaveCSS("touch-action", "pan-y");
  });

  test("scrolls the page for a swipe up that starts on empty pane", async ({ page }) => {
    await openDemo(page);
    await centre(page);
    const before = await page.evaluate(() => window.scrollY);
    const { x, y } = await emptyPanePoint(page);
    await swipeUp(await page.context().newCDPSession(page), x, y);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 20);
  });

  test("scrolls the page for a swipe up that starts on a node", async ({ page }) => {
    await openDemo(page);
    await centre(page);
    const before = await page.evaluate(() => window.scrollY);
    const box = await nodes(page).first().boundingBox();
    expect(box).not.toBeNull();
    await swipeUp(
      await page.context().newCDPSession(page),
      box!.x + box!.width / 2,
      box!.y + box!.height / 2,
    );
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 20);
  });

  test("pans the diagram for a horizontal swipe, and keeps the page where it is", async ({
    page,
  }) => {
    await openDemo(page);
    await centre(page);
    const scrollY = await page.evaluate(() => window.scrollY);
    const viewport = diagram(page).locator(".react-flow__viewport");
    const before = await viewport.evaluate((el) => (el as HTMLElement).style.transform);
    const { x, y } = await emptyPanePoint(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + step * 12, y }],
      });
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect
      .poll(() => viewport.evaluate((el) => (el as HTMLElement).style.transform))
      .not.toBe(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  test("selects a node for a tap, and clears the selection for a tap on empty pane", async ({
    page,
  }) => {
    await openDemo(page);
    await centre(page);
    const node = nodes(page).filter({ hasText: "Wait and retry" });
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(node).toHaveAttribute("aria-pressed", "true");
    const { x, y } = await emptyPanePoint(page);
    await page.touchscreen.tap(x, y);
    await expect(node).toHaveAttribute("aria-pressed", "false");
  });
});
