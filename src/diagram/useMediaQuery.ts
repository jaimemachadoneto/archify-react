import { useCallback, useSyncExternalStore } from "react";

// One list per query for the whole page. A new matchMedia function (a test stub) empties the cache.
let cachedMatchMedia: Window["matchMedia"] | undefined;
const lists = new Map<string, MediaQueryList>();

function listFor(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  if (window.matchMedia !== cachedMatchMedia) {
    lists.clear();
    cachedMatchMedia = window.matchMedia;
  }
  let list = lists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    lists.set(query, list);
  }
  return list;
}

// The server and a browser without matchMedia give false.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = listFor(query);
      if (!list) return () => {};
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => listFor(query)?.matches ?? false, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
