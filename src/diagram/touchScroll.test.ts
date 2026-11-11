import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardVerticalSwipe } from "./touchScroll";

function stubCoarse(coarse: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: coarse })),
  );
}

// jsdom cannot build a touch list, so the test sets the fields that the guard reads.
function touch(type: string, points: Array<[number, number]>): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
  });
  return event;
}

describe("guardVerticalSwipe", () => {
  let root: HTMLElement;
  let pane: HTMLElement;
  let reached: string[];
  let stop: () => void;

  beforeEach(() => {
    stubCoarse(true);
    root = document.createElement("div");
    pane = document.createElement("div");
    root.append(pane);
    document.body.append(root);
    reached = [];
    // The pane stands for the d3-zoom listener of React Flow.
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      pane.addEventListener(type, () => reached.push(type));
    }
    stop = guardVerticalSwipe(root);
  });

  afterEach(() => {
    stop();
    root.remove();
    vi.unstubAllGlobals();
  });

  it("keeps a vertical move away from the pane, so the page can scroll", () => {
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 190]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    expect(reached).toEqual(["touchstart"]);
  });

  it("gives a horizontal move to the pane, so the diagram pans", () => {
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[130, 202]]));
    pane.dispatchEvent(touch("touchmove", [[160, 204]]));
    expect(reached).toEqual(["touchstart", "touchmove", "touchmove"]);
  });

  it("keeps a small move away from the pane until the direction is clear", () => {
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[103, 201]]));
    expect(reached).toEqual(["touchstart"]);
  });

  it("decides again for the next gesture", () => {
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    pane.dispatchEvent(touch("touchend", []));
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[150, 200]]));
    expect(reached).toEqual(["touchstart", "touchend", "touchstart", "touchmove"]);
  });

  it("decides again after a touchcancel", () => {
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    pane.dispatchEvent(touch("touchcancel", []));
    // A move with no new start is free again: the cancel ended the vertical verdict.
    pane.dispatchEvent(touch("touchmove", [[100, 140]]));
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[150, 200]]));
    expect(reached).toEqual(["touchstart", "touchmove", "touchstart", "touchmove"]);
  });

  it("keeps a vertical move from a bubble listener on an ancestor, and a capture listener still gets it", () => {
    const bubble: string[] = [];
    const capture: string[] = [];
    const remove = new AbortController();
    document.addEventListener("touchmove", () => bubble.push("touchmove"), {
      signal: remove.signal,
    });
    document.addEventListener("touchmove", () => capture.push("touchmove"), {
      capture: true,
      signal: remove.signal,
    });
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    remove.abort();
    expect(bubble, "a bubble listener on the document").toEqual([]);
    expect(capture, "a capture listener on the document").toEqual(["touchmove"]);
  });

  it("gives a move with two fingers to the pane, so the user can pinch", () => {
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 190]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    pane.dispatchEvent(
      touch("touchmove", [
        [100, 150],
        [200, 150],
      ]),
    );
    expect(reached).toEqual(["touchstart", "touchmove"]);
  });

  it("does nothing when the pointer is not coarse", () => {
    stubCoarse(false);
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    expect(reached).toEqual(["touchstart", "touchmove"]);
  });

  it("does nothing when the browser has no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    expect(reached).toEqual(["touchstart", "touchmove"]);
  });

  it("removes its listeners when the caller stops it", () => {
    stop();
    pane.dispatchEvent(touch("touchstart", [[100, 200]]));
    pane.dispatchEvent(touch("touchmove", [[100, 150]]));
    expect(reached).toEqual(["touchstart", "touchmove"]);
  });
});
