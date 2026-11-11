import { expect, test, type Locator, type Page } from "@playwright/test";

const diagram = (page: Page): Locator => page.getByRole("group", { name: "Playground diagram" });
const nodes = (page: Page): Locator => diagram(page).locator("button.archify-node");

// The layout is asynchronous, so a test waits until the diagram shows the steps of the preset.
async function openPlayground(page: Page): Promise<void> {
  await page.goto("/");
  await expect(nodes(page).filter({ hasText: "Send answer" })).toHaveCount(1);
}

// The size of the box around all steps, as the user sees it.
async function boundsOfNodes(page: Page): Promise<{ width: number; height: number }> {
  return nodes(page).evaluateAll((buttons) => {
    const boxes = buttons.map((button) => button.getBoundingClientRect());
    return {
      width: Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left)),
      height: Math.max(...boxes.map((b) => b.bottom)) - Math.min(...boxes.map((b) => b.top)),
    };
  });
}

test.describe("the playground", () => {
  test("renders a diagram, the controls and the JSON of the spec", async ({ page }) => {
    await openPlayground(page);
    await expect(page.getByRole("heading", { level: 2, name: "Playground" })).toBeVisible();
    await expect(diagram(page).locator(".archify-lane")).toHaveCount(3);
    expect(await nodes(page).count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole("radio", { name: "RIGHT" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Highlight" })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Spec preset" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Look" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Spec JSON" })).toContainText('"version": 1');
  });

  test("draws the preset taller than wide when the direction is DOWN", async ({ page }) => {
    await openPlayground(page);
    const wide = await boundsOfNodes(page);
    expect(wide.width, "RIGHT is wider than tall").toBeGreaterThan(wide.height);
    await page.getByRole("radio", { name: "DOWN" }).check();
    await expect
      .poll(async () => {
        const { width, height } = await boundsOfNodes(page);
        return height > width;
      })
      .toBe(true);
  });

  test("shows the problem list of the diagram for the Invalid spec preset", async ({ page }) => {
    await openPlayground(page);
    await page
      .getByRole("combobox", { name: "Spec preset" })
      .selectOption({ label: "Invalid spec" });
    const alert = diagram(page).getByRole("alert");
    await expect(alert).toContainText("The diagram spec is not valid.");
    await expect(alert).toContainText("occurs more than once");
    await expect(alert).toContainText('unknown target node "ship"');
    // The playground draws no alert of its own while the JSON is valid.
    await expect(page.getByRole("alert")).toHaveCount(1);
  });

  test("keeps the last good diagram when the text is not valid JSON", async ({ page }) => {
    await openPlayground(page);
    await page.getByRole("textbox", { name: "Spec JSON" }).fill("{ not json");
    await expect(page.getByRole("alert")).toContainText("not valid JSON");
    await expect(nodes(page).filter({ hasText: "Send answer" })).toHaveCount(1);
  });

  test("dims nothing on hover when Highlight is off", async ({ page }) => {
    await openPlayground(page);
    const answer = nodes(page).filter({ hasText: "Send answer" });
    await answer.hover();
    await expect(diagram(page).locator("button.archify-node[data-dimmed]").first()).toBeVisible();
    await page.mouse.move(2, 2);
    await expect(diagram(page).locator("[data-dimmed]")).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Highlight" }).uncheck();
    await answer.hover();
    await expect(answer).toBeVisible();
    await expect(diagram(page).locator("[data-dimmed]")).toHaveCount(0);

    // A positive control: with Highlight on again, the same hover dims, so the check above is not empty.
    await page.mouse.move(2, 2);
    await page.getByRole("checkbox", { name: "Highlight" }).check();
    await answer.hover();
    await expect(diagram(page).locator("button.archify-node[data-dimmed]").first()).toBeVisible();
  });

  test("changes --archify-radius when the look is Custom palette", async ({ page }) => {
    await openPlayground(page);
    const radius = () =>
      diagram(page)
        .locator(".archify-diagram")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--archify-radius").trim());
    const host = await radius();
    await page.getByRole("combobox", { name: "Look" }).selectOption({ label: "Custom palette" });
    await expect.poll(radius).toBe("16px");
    expect(host).not.toBe("16px");
    await page.getByRole("combobox", { name: "Look" }).selectOption({ label: "Host variables" });
    await expect.poll(radius).toBe(host);
  });

  test("uses a palette of its own in each theme", async ({ page }, testInfo) => {
    await openPlayground(page);
    await page.getByRole("combobox", { name: "Look" }).selectOption({ label: "Custom palette" });
    const card = () =>
      diagram(page)
        .locator(".archify-diagram")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--archify-card").trim());
    // The project name is the colour scheme of the browser, so a missing dark block fails here.
    await expect.poll(card).toBe(testInfo.project.name === "dark" ? "#083344" : "#ecfeff");
  });

  test("draws the border of a lane with at least 3 to 1 against its fill", async ({ page }) => {
    await openPlayground(page);
    const measure = () =>
      diagram(page)
        .locator(".archify-lane")
        .first()
        .evaluate((el) => {
          const style = getComputedStyle(el);
          const channels = (colour: string) =>
            colour
              .match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number);
          const luminance = (colour: string) => {
            const [r, g, b] = channels(colour).map((v) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const [a, b] = [luminance(style.borderTopColor), luminance(style.backgroundColor)];
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
    expect(await measure(), "host variables").toBeGreaterThanOrEqual(3);
    await page.getByRole("combobox", { name: "Look" }).selectOption({ label: "Custom palette" });
    expect(await measure(), "custom palette").toBeGreaterThanOrEqual(3);
  });

  test("lets the label of a lane receive the pointer, and a click on it keeps the pane working", async ({
    page,
  }) => {
    await openPlayground(page);
    const label = diagram(page).locator(".archify-lane__label").first();
    await expect(label).toHaveAttribute("title", "Customer");
    // The lane node has pointer-events none. The label must still be the element under the pointer, or its title never shows.
    await label.scrollIntoViewIfNeeded();
    const box = (await label.boundingBox())!;
    const hit = await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.className ?? null,
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hit).toBe("archify-lane__label");

    // A click on the label does not change the selection, and a click on the empty pane still clears it.
    const node = nodes(page).filter({ hasText: "Open ticket" });
    await node.click();
    await expect(node).toHaveAttribute("aria-pressed", "true");
    await label.click();
    // The label is not the pane, so the click keeps the selection.
    await expect(node).toHaveAttribute("aria-pressed", "true");
    const point = await diagram(page)
      .locator(".react-flow__pane")
      .evaluate((el) => {
        const rect = el.getBoundingClientRect();
        for (let y = rect.top + 8; y < rect.bottom - 8; y += 8) {
          for (let x = rect.left + 8; x < rect.right - 8; x += 8) {
            if (document.elementFromPoint(x, y) === el) return { x, y };
          }
        }
        return null;
      });
    expect(point, "an empty point on the pane").not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await expect(node).toHaveAttribute("aria-pressed", "false");
  });

  test("ends a long lane label with an ellipsis inside the lane", async ({ page }) => {
    await openPlayground(page);
    const label = "A very long lane label that the box of the lane cannot show in one line";
    const spec = {
      version: 1,
      lanes: [{ id: "ops", label }],
      nodes: [
        { id: "a", label: "Start", lane: "ops" },
        { id: "b", label: "End", lane: "ops" },
      ],
      edges: [{ id: "e1", source: "a", target: "b" }],
    };
    await page.getByRole("textbox", { name: "Spec JSON" }).fill(JSON.stringify(spec));
    const lane = diagram(page).locator(".archify-lane");
    await expect(lane).toHaveCount(1);
    const text = lane.locator(".archify-lane__label");
    await expect(text).toHaveAttribute("title", label);
    const measured = async () =>
      text.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const laneBox = el.parentElement!.getBoundingClientRect();
        return {
          overflow: getComputedStyle(el).textOverflow,
          // The text is cut: its content is wider than its box.
          cut: el.scrollWidth > el.clientWidth,
          inside: box.right <= laneBox.right + 0.5 && box.left >= laneBox.left - 0.5,
        };
      });
    await expect.poll(measured).toEqual({ overflow: "ellipsis", cut: true, inside: true });
  });

  test("never shows a new edge dot at the origin of the SVG, and shows it after the start", async ({
    page,
  }) => {
    // A dot has no position until the first sample of its animation. A browser can paint that frame (seen in WebKit).
    await page.addInitScript(() => {
      type Sample = { visible: boolean; atOrigin: boolean };
      const samples: Sample[] = [];
      (window as unknown as { __samples: Sample[] }).__samples = samples;
      const sample = (dot: SVGCircleElement) => {
        const box = dot.getBoundingClientRect();
        const svg = dot.ownerSVGElement!.getBoundingClientRect();
        samples.push({
          visible: getComputedStyle(dot).visibility === "visible",
          // The circle has a radius of 4 and no offset at the origin.
          atOrigin: Math.abs(box.x - svg.x + 4) < 1 && Math.abs(box.y - svg.y + 4) < 1,
        });
      };
      new MutationObserver((records) => {
        for (const record of records) {
          for (const added of record.addedNodes) {
            if (!(added instanceof Element)) continue;
            for (const dot of added.querySelectorAll<SVGCircleElement>("circle.archify-edge-dot")) {
              sample(dot);
              // The frames after the insertion: the first paint can come after any of them.
              let frames = 0;
              const next = () => {
                sample(dot);
                if (++frames < 6) requestAnimationFrame(next);
              };
              requestAnimationFrame(next);
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await openPlayground(page);
    // A new direction gives new paths, so the dots are new.
    await page.getByRole("radio", { name: "DOWN" }).check();
    const dots = diagram(page).locator("circle.archify-edge-dot");
    await expect(dots.first()).toBeAttached();
    await page.waitForTimeout(500);
    const samples = await page.evaluate(
      () =>
        (window as unknown as { __samples: Array<{ visible: boolean; atOrigin: boolean }> })
          .__samples,
    );
    expect(samples.length, "the test saw new dots").toBeGreaterThan(10);
    expect(
      samples.filter((s) => s.visible && s.atOrigin),
      "a painted dot at the origin",
    ).toEqual([]);
    // The dot must not stay hidden: every dot shows when its animation runs.
    await expect
      .poll(() =>
        dots.evaluateAll((all) => all.every((d) => getComputedStyle(d).visibility === "visible")),
      )
      .toBe(true);
  });

  test("shows the whole diagram inside its frame on a phone, also after a change", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 900 });
    await openPlayground(page);
    // The diagram starts from the top down on a phone. RIGHT is wider than the window, because the zoom has a minimum.
    await expect(page.getByRole("radio", { name: "DOWN" })).toBeChecked();
    const allInside = async () => {
      const frame = await diagram(page).locator(".archify-diagram").boundingBox();
      const boxes = await nodes(page).evaluateAll((buttons) =>
        buttons.map((b) => b.getBoundingClientRect().toJSON()),
      );
      return boxes.every(
        (b) =>
          b.left >= frame!.x - 1 &&
          b.right <= frame!.x + frame!.width + 1 &&
          b.top >= frame!.y - 1 &&
          b.bottom <= frame!.y + frame!.height + 1,
      );
    };
    await expect
      .poll(allInside, { message: "every step is inside the frame at the start" })
      .toBe(true);
    await page
      .getByRole("combobox", { name: "Spec preset" })
      .selectOption({ label: "Pinned positions" });
    await expect(diagram(page)).not.toHaveAttribute("aria-busy", "true");
    await expect
      .poll(allInside, { message: "every step is inside the frame after a preset" })
      .toBe(true);
  });

  test("fits a phone window with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openPlayground(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const box = await diagram(page).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
  });

  test("does not overlap two steps in any preset", async ({ page }) => {
    await openPlayground(page);
    for (const preset of ["Pinned positions", "Valid with lanes"]) {
      await page.getByRole("combobox", { name: "Spec preset" }).selectOption({ label: preset });
      await expect(nodes(page).first()).toBeVisible();
      for (const direction of ["DOWN", "RIGHT"]) {
        await page.getByRole("radio", { name: direction }).check();
        // The group is busy until the layout of the new spec arrives. The old layout stays on screen until then.
        await expect(diagram(page)).not.toHaveAttribute("aria-busy", "true");
        const boxes = await nodes(page).evaluateAll((buttons) =>
          buttons.map((b) => {
            const r = b.getBoundingClientRect();
            return { name: b.textContent ?? "", l: r.left, r: r.right, t: r.top, b: r.bottom };
          }),
        );
        expect(boxes.length).toBeGreaterThanOrEqual(4);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i];
            const c = boxes[j];
            const apart =
              a.r <= c.l + 0.5 || c.r <= a.l + 0.5 || a.b <= c.t + 0.5 || c.b <= a.t + 0.5;
            expect(apart, `${preset} ${direction}: "${a.name}" overlaps "${c.name}"`).toBe(true);
          }
        }
      }
    }
  });
});
