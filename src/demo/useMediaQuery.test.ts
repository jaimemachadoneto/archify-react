import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => list),
  );
  return {
    change(next: boolean) {
      list.matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when the browser has no matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(max-width: 480px)"));
    expect(result.current).toBe(false);
  });

  it("returns the current match and follows a change", () => {
    const media = stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 480px)"));
    expect(result.current).toBe(true);
    act(() => media.change(false));
    expect(result.current).toBe(false);
  });
});
