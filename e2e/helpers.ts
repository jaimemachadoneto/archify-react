import { expect, type Locator } from "@playwright/test";

// A point on the pane where no node, edge or control is under the pointer.
export async function emptyPanePoint(pane: Locator): Promise<{ x: number; y: number }> {
  const point = await pane.evaluate((el) => {
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
