import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => cleanup());

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = MockResizeObserver;

// React Flow reads the zoom of the viewport from a DOMMatrixReadOnly, which jsdom lacks.
class MockDOMMatrixReadOnly {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = scale ? Number(scale) : 1;
  }
}

global.DOMMatrixReadOnly = MockDOMMatrixReadOnly as unknown as typeof DOMMatrixReadOnly;

// React Flow measures the text of an edge label with getBBox, which jsdom lacks.
Object.defineProperty(SVGElement.prototype, "getBBox", {
  configurable: true,
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});
