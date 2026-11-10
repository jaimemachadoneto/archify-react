import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import Demo from "@/demo/Demo";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

export default function App() {
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
            Three examples and a playground, all with invented data. Hover or focus a step to follow
            its path. Press a step to select it.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto shrink-0"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>
      <Demo />
    </main>
  );
}
