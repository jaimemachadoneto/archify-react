// A move of less than this many pixels does not show the direction of the swipe.
const DECIDE_DISTANCE = 8;

type Verdict = "free" | "deciding" | "vertical";

// d3-zoom of React Flow cancels each touchmove that starts on the pane, and then the browser does not scroll the page.
// This guard keeps a vertical one-finger swipe away from the pane, so the page scrolls. A horizontal swipe still pans.
// The guard acts only for a coarse pointer, because only there the stylesheet sets touch-action to pan-y.
export function guardVerticalSwipe(root: HTMLElement): () => void {
  let verdict: Verdict = "free";
  let startX = 0;
  let startY = 0;

  const coarse = () => window.matchMedia?.("(pointer: coarse)")?.matches === true;

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || !coarse()) {
      verdict = "free";
      return;
    }
    verdict = "deciding";
    startX = event.touches[0]!.clientX;
    startY = event.touches[0]!.clientY;
  };

  const onMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) verdict = "free";
    if (verdict === "deciding") {
      const dx = Math.abs(event.touches[0]!.clientX - startX);
      const dy = Math.abs(event.touches[0]!.clientY - startY);
      if (Math.max(dx, dy) >= DECIDE_DISTANCE) verdict = dy > dx ? "vertical" : "free";
    }
    // A stopped move is not lost: d3-zoom measures a pan from the start point of the touch.
    if (verdict !== "free") event.stopPropagation();
  };

  const onEnd = () => {
    verdict = "free";
  };

  // Capture phase, so the guard runs before the listener on the pane.
  const options = { capture: true, passive: true };
  root.addEventListener("touchstart", onStart, options);
  root.addEventListener("touchmove", onMove, options);
  root.addEventListener("touchend", onEnd, options);
  root.addEventListener("touchcancel", onEnd, options);
  return () => {
    root.removeEventListener("touchstart", onStart, options);
    root.removeEventListener("touchmove", onMove, options);
    root.removeEventListener("touchend", onEnd, options);
    root.removeEventListener("touchcancel", onEnd, options);
  };
}
