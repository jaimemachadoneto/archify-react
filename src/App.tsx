import { Moon, Sun } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import Demo from "@/demo/Demo";
import Reference, { REFERENCE_HASH } from "@/demo/Reference";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

// The page is a hash route. GitHub Pages has no fallback for a path, so only a hash survives a reload.
function subscribeToHash(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}
const readHash = () => window.location.hash;
// A link to a part of the page, such as #reference-codes, keeps the page open.
const isReferenceHash = (hash: string) =>
  hash === REFERENCE_HASH || hash.startsWith(`${REFERENCE_HASH}-`);

const linkClass =
  "inline-flex min-h-11 items-center rounded-sm underline-offset-4 hover:underline sm:min-h-6 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default function App() {
  const onReference = isReferenceHash(useSyncExternalStore(subscribeToHash, readHash));
  // The browser looks for the fragment before React draws the page, so a link to a part scrolls here.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash !== REFERENCE_HASH && isReferenceHash(hash)) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, []);
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <main className="mx-auto flex min-w-0 max-w-5xl flex-col gap-6 p-5 md:p-8">
      <header className="flex items-start gap-3">
        <div>
          <p className="text-xs text-muted-foreground">archify-react</p>
          <h1 className="text-xl font-bold tracking-tight">Workflow diagrams</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {onReference
              ? "The props, the functions, the problem codes, the limits and the host variables."
              : "Three examples and a playground, all with invented data. Hover or focus a step to follow its path. Press a step to select it."}
          </p>
          <nav aria-label="Pages" className="mt-1 flex gap-4 text-sm font-medium">
            <a
              href="#"
              aria-current={onReference ? undefined : "page"}
              className={`${linkClass} ${onReference ? "" : "underline"}`}
            >
              Demo
            </a>
            <a
              href={REFERENCE_HASH}
              aria-current={onReference ? "page" : undefined}
              className={`${linkClass} ${onReference ? "underline" : ""}`}
            >
              Reference
            </a>
          </nav>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-11 shrink-0 md:size-9"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>
      {onReference ? <Reference /> : <Demo />}
    </main>
  );
}
