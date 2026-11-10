export type Theme = "light" | "dark";

// The theme is a class on <html>: tokens.css defines the colours for
// .light and .dark. With neither class, the system preference applies.
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function currentTheme(root: HTMLElement = document.documentElement): Theme {
  if (root.classList.contains("dark")) return "dark";
  if (root.classList.contains("light")) return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
