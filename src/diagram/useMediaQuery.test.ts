import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
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

  it("follows a change with addListener when the browser has no addEventListener", () => {
    const listeners = new Set<() => void>();
    const list = {
      matches: true,
      addListener: vi.fn((listener: () => void) => listeners.add(listener)),
      removeListener: vi.fn((listener: () => void) => listeners.delete(listener)),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => list),
    );
    const { result, unmount } = renderHook(() => useMediaQuery("(max-width: 480px)"));
    expect(result.current).toBe(true);
    expect(list.addListener).toHaveBeenCalledTimes(1);
    act(() => {
      list.matches = false;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
    unmount();
    expect(list.removeListener).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });

  it("reads one media query list for two hooks with the same query", () => {
    stubMatchMedia(false);
    renderHook(() => [useMediaQuery("(max-width: 480px)"), useMediaQuery("(max-width: 480px)")]);
    expect(window.matchMedia).toHaveBeenCalledTimes(1);
  });

  it("returns false on the server", () => {
    stubMatchMedia(true);
    const Probe = () => String(useMediaQuery("(max-width: 480px)"));
    expect(renderToString(createElement(Probe))).toBe("false");
  });
});
