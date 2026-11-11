import { expect, test, type Locator, type Page } from "@playwright/test";

// One entry for each diagram of the demo page. The labels are the ones in Demo.tsx.
const diagrams = [
  {
    slug: "trace",
    title: "Decision trace",
    labels: ["Receive request", "Check cache", "Send answer"],
  },
  {
    slug: "approval",
    title: "Approval with lanes",
    labels: ["Submit request", "Check request", "Send decision"],
  },
  { slug: "retry", title: "Retry loop", labels: ["Queue job", "Wait and retry"] },
] as const;

const diagram = (page: Page, title: string): Locator => page.getByRole("group", { name: title });
// The panel under a diagram. The section of the diagram has the title as a heading.
const panelOf = (page: Page, title: string): Locator =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) })
    .locator("[data-selection]");
const nodesOf = (page: Page, title: string): Locator =>
  diagram(page, title).locator("button.archify-node");

// The layout is asynchronous, so a test waits until every diagram shows its nodes.
async function openDemo(page: Page): Promise<void> {
  await page.goto("/");
  for (const { title, labels } of diagrams) {
    await expect(nodesOf(page, title).first()).toBeVisible();
    for (const label of labels) {
      await expect(nodesOf(page, title).filter({ hasText: label })).toHaveCount(1);
    }
  }
  // fitView runs after the first measure. Wait until it moved every viewport and the transforms stay the same.
  let previous = "";
  await expect
    .poll(
      async () => {
        const transforms = await page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLElement>(".react-flow__viewport")).map(
            (viewport) => viewport.style.transform,
          ),
        );
        const now = transforms.join("|");
        const fitted = transforms.every((t) => t !== "translate(0px, 0px) scale(1)");
        const stable = fitted && now === previous;
        previous = now;
        return stable;
      },
      { intervals: [100], timeout: 10_000 },
    )
    .toBe(true);
}

async function tabToNode(page: Page): Promise<void> {
  await page.getByRole("button", { name: /theme/i }).focus();
  let onNode = false;
  for (let i = 0; i < 12 && !onNode; i++) {
    await page.keyboard.press("Tab");
    onNode = await page.evaluate(
      () => document.activeElement?.classList.contains("archify-node") ?? false,
    );
  }
  expect(onNode, "Tab must reach a node button").toBe(true);
}

test.describe("the demo page", () => {
  test("shows the node buttons of every diagram", async ({ page }) => {
    await openDemo(page);
    for (const { title } of diagrams) {
      expect(await nodesOf(page, title).count()).toBeGreaterThanOrEqual(4);
    }
  });

  test("shows no error and no failed request", async ({ page }) => {
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") problems.push(message.text());
    });
    await openDemo(page);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("keeps each label inside its node", async ({ page }) => {
    await openDemo(page);
    for (const { title } of diagrams) {
      const clipped = await nodesOf(page, title).evaluateAll((buttons) =>
        buttons
          .filter((b) => b.scrollWidth > b.clientWidth || b.scrollHeight > b.clientHeight)
          .map((b) => b.textContent),
      );
      expect(clipped, `${title}: labels that overflow`).toEqual([]);
    }
  });

  test("does not overlap two nodes of one diagram", async ({ page }) => {
    await openDemo(page);
    for (const { title } of diagrams) {
      const boxes = await nodesOf(page, title).evaluateAll((buttons) =>
        buttons.map((b) => {
          const r = b.getBoundingClientRect();
          return {
            name: b.textContent ?? "",
            left: r.left,
            right: r.right,
            top: r.top,
            bottom: r.bottom,
          };
        }),
      );
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const apart =
            a.right <= b.left + 0.5 ||
            b.right <= a.left + 0.5 ||
            a.bottom <= b.top + 0.5 ||
            b.bottom <= a.top + 0.5;
          expect(apart, `${title}: "${a.name}" overlaps "${b.name}"`).toBe(true);
        }
      }
    }
  });

  for (const { title } of diagrams) {
    test(`does not move a node when the mouse drags it: ${title}`, async ({ page }) => {
      await openDemo(page);
      const node = nodesOf(page, title).first();
      // The mouse events go to the window, so the node must be inside it before the drag.
      await node.evaluate((el) => el.scrollIntoView({ block: "center" }));
      const before = await node.boundingBox();
      expect(before).not.toBeNull();
      const x = before!.x + before!.width / 2;
      const y = before!.y + before!.height / 2;
      const viewport = page.viewportSize()!;
      expect(x, "drag start x inside the window").toBeGreaterThan(0);
      expect(x + 80, "drag end x inside the window").toBeLessThan(viewport.width);
      expect(y, "drag start y inside the window").toBeGreaterThan(0);
      expect(y + 40, "drag end y inside the window").toBeLessThan(viewport.height);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 40, y + 20, { steps: 5 });
      await page.mouse.move(x + 80, y + 40, { steps: 5 });
      await page.mouse.up();
      const after = await node.boundingBox();
      expect(after?.x, `${title}: x`).toBeCloseTo(before!.x, 1);
      expect(after?.y, `${title}: y`).toBeCloseTo(before!.y, 1);
    });
  }

  test("keeps the page scrollable with the wheel over a diagram", async ({ page }) => {
    await openDemo(page);
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(scrollHeight, "the demo page must be taller than the window").toBeGreaterThan(
      viewportHeight + 200,
    );
    const box = await diagram(page, "Decision trace").boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("dims the nodes outside the path of the node under the pointer", async ({ page }) => {
    await openDemo(page);
    const scope = diagram(page, "Decision trace");
    await expect(scope.locator("[data-dimmed]")).toHaveCount(0);
    // The hover must reach the button through the React Flow node wrapper.
    await nodesOf(page, "Decision trace").filter({ hasText: "Check cache" }).hover();
    await expect(scope.locator("button.archify-node[data-dimmed]").first()).toBeVisible();
    await expect(
      scope.locator(".archify-edge-group[data-dimmed] path.archify-edge").first(),
    ).toBeAttached();
    await expect(
      scope.locator('button.archify-node[data-dimmed]:not([data-state="skipped"])').first(),
    ).toHaveCSS("opacity", "0.6");
    // The hovered node and its own path stay clear.
    await expect(
      nodesOf(page, "Decision trace").filter({ hasText: "Check cache" }),
    ).not.toHaveAttribute("data-dimmed", /.*/);
    await page.mouse.move(2, 2);
    await expect(scope.locator("[data-dimmed]")).toHaveCount(0);
  });

  test("selects a node with a click and shows its label and summary", async ({ page }) => {
    await openDemo(page);
    const node = nodesOf(page, "Retry loop").filter({ hasText: "Wait and retry" });
    await node.click();
    await expect(node).toHaveAttribute("aria-pressed", "true");
    const panel = panelOf(page, "Retry loop");
    await expect(panel).toContainText("Wait and retry");
    await expect(panel.locator("[data-summary]")).not.toBeEmpty();
    // A real click gives the button the focus. A pan must not start on a node.
    await expect(node).toBeFocused();
  });

  // A point on the pane where no node, edge or control is under the pointer.
  async function emptyPanePoint(page: Page, title: string): Promise<{ x: number; y: number }> {
    const point = await diagram(page, title)
      .locator(".react-flow__pane")
      .evaluate((el) => {
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

  test("clears the selection with a click on the empty pane", async ({ page }) => {
    await openDemo(page);
    const node = nodesOf(page, "Retry loop").filter({ hasText: "Wait and retry" });
    const panel = panelOf(page, "Retry loop");
    await node.click();
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await diagram(page, "Retry loop").evaluate((el) => el.scrollIntoView({ block: "center" }));
    const { x, y } = await emptyPanePoint(page, "Retry loop");
    await page.mouse.click(x, y);
    await expect(node).toHaveAttribute("aria-pressed", "false");
    await expect(panel).toContainText("Select a step");
  });

  test("keeps the selection when the mouse pans the diagram", async ({ page }) => {
    await openDemo(page);
    const scope = diagram(page, "Retry loop");
    const node = nodesOf(page, "Retry loop").filter({ hasText: "Wait and retry" });
    await node.click();
    await scope.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const viewport = scope.locator(".react-flow__viewport");
    const before = await viewport.evaluate((el) => (el as HTMLElement).style.transform);
    const { x, y } = await emptyPanePoint(page, "Retry loop");
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y + 10, { steps: 5 });
    await page.mouse.move(x + 60, y + 20, { steps: 5 });
    await page.mouse.up();
    // The pan is real: the viewport moved. The selection stays.
    await expect
      .poll(() => viewport.evaluate((el) => (el as HTMLElement).style.transform))
      .not.toBe(before);
    await expect(node).toHaveAttribute("aria-pressed", "true");
  });

  test("keeps the pane touch action at none for a mouse on a desktop", async ({ page }) => {
    await openDemo(page);
    await expect(diagram(page, "Retry loop").locator(".react-flow__pane")).toHaveCSS(
      "touch-action",
      "none",
    );
  });

  test("selects a focused node with the Enter key and shows a focus ring", async ({ page }) => {
    await openDemo(page);
    await tabToNode(page);
    const focused = page.locator("button.archify-node:focus");
    const outline = await focused.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
    await expect(focused).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(focused).toHaveAttribute("aria-pressed", "true");
  });

  test("uses only the shared colours: the node fill is the card token", async ({ page }) => {
    await openDemo(page);
    const [fill, token] = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--card)";
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      const node = document.querySelector("button.archify-node[data-state='used']");
      return [node ? getComputedStyle(node).backgroundColor : "", want];
    });
    expect(fill).toBe(token);
  });

  // The cue of the pointer is a border and an inner line, not the fill: the muted fill of a lane is the same colour.
  test("shows a node under the pointer with a border and an inner line, and a selected node with more", async ({
    page,
  }) => {
    await openDemo(page);
    const title = "Retry loop";
    const look = (node: Locator) =>
      node.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          fill: style.backgroundColor,
          border: style.borderTopColor,
          shadow: style.boxShadow,
          weight: Number(style.fontWeight),
        };
      });
    // The border and the line move in 150 ms, so this waits until two reads in a row are the same.
    const settled = async (node: Locator) => {
      let previous = "";
      await expect
        .poll(
          async () => {
            const now = JSON.stringify(await look(node));
            const same = now === previous;
            previous = now;
            return same;
          },
          { intervals: [250] },
        )
        .toBe(true);
      return JSON.parse(previous) as Awaited<ReturnType<typeof look>>;
    };
    const first = nodesOf(page, title).filter({ hasText: "Queue job" });
    const second = nodesOf(page, title).filter({ hasText: "Wait and retry" });
    const plain = await settled(first);
    await first.hover();
    const hovered = await settled(first);
    expect(hovered.fill, "the pointer keeps the fill").toBe(plain.fill);
    expect(hovered.border, "the pointer changes the border").not.toBe(plain.border);
    expect(hovered.shadow, "the pointer adds an inner line").not.toBe(plain.shadow);
    expect(hovered.weight).toBe(plain.weight);
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    const selected = await settled(second);
    expect(selected.fill, "a selected node has the accent fill").not.toBe(hovered.fill);
    expect(selected.shadow, "a selected node has a wider inner line").not.toBe(hovered.shadow);
    expect(selected.weight, "a selected node is bold").toBeGreaterThanOrEqual(700);
    // The pointer still rests on the selected node after the click, so this is a selected node under the pointer.
    expect(await settled(second)).toEqual(selected);
    await page.mouse.move(2, 2);
    expect(await settled(second), "a selected node without the pointer").toEqual(selected);
  });

  test("keeps the accent fill of a selected skipped node and a selected failed node under the pointer", async ({
    page,
  }) => {
    await openDemo(page);
    const accent = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.color = "var(--accent)";
      document.body.append(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    });
    for (const label of ["Check cache", "Check facts"]) {
      const node = nodesOf(page, "Decision trace").filter({ hasText: label });
      await node.scrollIntoViewIfNeeded();
      await node.click();
      await expect(node).toHaveAttribute("aria-pressed", "true");
      await node.hover();
      await expect(node, `${label} under the pointer`).toHaveCSS("background-color", accent);
      await expect(node).toHaveCSS("font-weight", "700");
    }
  });

  test("takes a screenshot of each diagram", async ({ page }, testInfo) => {
    await openDemo(page);
    for (const { slug, title } of diagrams) {
      const group = diagram(page, title);
      await group.scrollIntoViewIfNeeded();
      await group.screenshot({ path: testInfo.outputPath(`${slug}.png`) });
      await group.screenshot({ path: `test-results/review/${testInfo.project.name}-${slug}.png` });
    }
    await page.screenshot({
      path: `test-results/review/${testInfo.project.name}-page.png`,
      fullPage: true,
    });
  });
});

test.describe("the states of a node", () => {
  test("takes a screenshot of the focus, selected, hover and failed states", async ({
    page,
  }, testInfo) => {
    await openDemo(page);
    const title = "Decision trace";
    const group = diagram(page, title);
    const shot = (name: string) =>
      group.screenshot({ path: `test-results/review/${testInfo.project.name}-state-${name}.png` });
    const blur = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    await tabToNode(page);
    await expect(page.locator("button.archify-node:focus")).toBeVisible();
    await shot("focus");
    await blur();

    await nodesOf(page, title).filter({ hasText: "Classify intent" }).click();
    await blur();
    await page.mouse.move(2, 2);
    await expect(group.locator("[data-dimmed]")).toHaveCount(0);
    await shot("selected");

    await nodesOf(page, title).filter({ hasText: "Search sources" }).hover();
    await expect(group.locator("button.archify-node[data-dimmed]").first()).toBeVisible();
    await shot("hover");

    await nodesOf(page, title).filter({ hasText: "Check facts" }).click();
    await blur();
    await page.mouse.move(2, 2);
    await expect(group.locator("[data-dimmed]")).toHaveCount(0);
    await shot("selected-failed");

    await nodesOf(page, title).filter({ hasText: "Check cache" }).click();
    await blur();
    await page.mouse.move(2, 2);
    await shot("selected-skipped");
  });

  test("keeps a selected failed node different from a failed node and from a selected node", async ({
    page,
  }) => {
    await openDemo(page);
    const failed = nodesOf(page, "Decision trace").filter({ hasText: "Check facts" });
    const look = () =>
      failed.evaluate((el) => {
        const style = getComputedStyle(el);
        return { shadow: style.boxShadow, weight: style.fontWeight, border: style.borderTopColor };
      });
    const plain = await look();
    await failed.click();
    await page.mouse.move(2, 2);
    const selected = await look();
    // The failed signal stays (same border colour), and a selected signal is added that is not a colour only.
    expect(selected.border).toBe(plain.border);
    expect(selected.shadow).not.toBe(plain.shadow);
    expect(Number(selected.weight)).toBeGreaterThan(Number(plain.weight));

    const skipped = nodesOf(page, "Decision trace").filter({ hasText: "Check cache" });
    const skippedPlain = Number(await skipped.evaluate((el) => getComputedStyle(el).fontWeight));
    await skipped.click();
    await page.mouse.move(2, 2);
    const skippedSelected = Number(await skipped.evaluate((el) => getComputedStyle(el).fontWeight));
    expect(skippedSelected).toBeGreaterThan(skippedPlain);
    expect(skippedSelected).toBeGreaterThanOrEqual(700);
  });
});

// The demo turns a diagram to flow down at "(max-width: 480px)": 480 is narrow and 481 is wide.
test.describe("when the window narrows", () => {
  test.use({ viewport: { width: 1000, height: 800 } });

  test("switches the trace diagram to flow down when the window narrows", async ({ page }) => {
    await openDemo(page);
    const node = (label: string) => nodesOf(page, "Decision trace").filter({ hasText: label });
    const boxes = async () => {
      const start = await node("Receive request").boundingBox();
      const cache = await node("Check cache").boundingBox();
      if (!start || !cache) throw new Error("a node has no box");
      return { start, cache };
    };
    const flowsRight = async () => {
      const { start, cache } = await boxes();
      return cache.x >= start.x + start.width && cache.y < start.y + start.height;
    };
    const flowsDown = async () => {
      const { start, cache } = await boxes();
      return cache.y >= start.y + start.height;
    };

    expect(await flowsRight()).toBe(true);
    await page.setViewportSize({ width: 480, height: 800 });
    await expect.poll(flowsDown).toBe(true);
    await page.setViewportSize({ width: 481, height: 800 });
    await expect.poll(flowsRight).toBe(true);
  });
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("has no horizontal page scroll", async ({ page }) => {
    await openDemo(page);
    const [scrollWidth, clientWidth] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("keeps the text of every node readable", async ({ page }) => {
    await openDemo(page);
    for (const { title } of diagrams) {
      const sizes = await nodesOf(page, title).evaluateAll((buttons) =>
        buttons.map((b) => {
          const rect = b.getBoundingClientRect();
          // The zoom of the diagram is the rendered height divided by the layout height.
          const zoom = rect.height / (b as HTMLElement).offsetHeight;
          return {
            name: b.textContent ?? "",
            height: rect.height,
            font: parseFloat(getComputedStyle(b).fontSize) * zoom,
          };
        }),
      );
      expect(sizes.length, `${title}: node buttons`).toBeGreaterThanOrEqual(4);
      for (const size of sizes) {
        expect(size.height, `${title}: height of "${size.name}"`).toBeGreaterThanOrEqual(24);
        expect(size.font, `${title}: font size of "${size.name}"`).toBeGreaterThanOrEqual(9);
      }
    }
  });

  test("keeps the zoom of every diagram at the minimum zoom or above", async ({ page }) => {
    await openDemo(page);
    const zooms = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".react-flow__viewport")).map((v) =>
        Number(v.style.transform.match(/scale\(([\d.]+)\)/)?.[1]),
      ),
    );
    // Three examples and the playground.
    expect(zooms).toHaveLength(4);
    for (const zoom of zooms) expect(zoom).toBeGreaterThanOrEqual(0.7);
  });

  test("shows every diagram inside the window", async ({ page }, testInfo) => {
    await openDemo(page);
    for (const { slug, title } of diagrams) {
      const box = await diagram(page, title).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      await diagram(page, title).screenshot({
        path: `test-results/review/${testInfo.project.name}-phone-${slug}.png`,
      });
    }
  });
});
