import { Activity, LayoutGrid, Moon, Search, Settings, Shield, Sun, Box } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { services, stats, type Status } from "@/data";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Overview", icon: LayoutGrid },
  { label: "Services", icon: Box, count: services.length },
  { label: "Activity", icon: Activity },
  { label: "Backups", icon: Shield },
  { label: "Settings", icon: Settings },
];

const statusBadge: Record<
  Status,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  running: { label: "Running", variant: "success" },
  degraded: { label: "Degraded", variant: "warning" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => currentTheme());
  const [page, setPage] = useState("Overview");

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2.5 px-2 pt-1 pb-4 font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-sm bg-sidebar-primary text-sm font-extrabold text-sidebar-primary-foreground">
            {"archify-react".charAt(0).toUpperCase()}
          </span>
          archify-react
        </div>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {nav.map(({ label, icon: Icon, count }) => (
            <button
              key={label}
              type="button"
              onClick={() => setPage(label)}
              aria-current={page === label ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                page === label && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              {count !== undefined && <span className="ml-auto font-mono text-xs">{count}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-col gap-5 p-5 md:p-7">
        <header className="flex flex-wrap items-center gap-3">
          <div>
            <p className="text-xs text-muted-foreground">archify-react</p>
            <h1 className="text-xl font-bold tracking-tight">{page}</h1>
          </div>
          <div className="relative ml-auto w-full max-w-64 sm:w-auto">
            <Search
              className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input aria-label="Search" placeholder="Search" className="pl-8" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button>New item</Button>
        </header>

        <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardHeader>
                <CardDescription>{s.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</p>
                <p
                  className={cn(
                    "font-mono text-xs font-medium",
                    s.good ? "text-success" : "text-destructive",
                  )}
                >
                  {s.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5">Service</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Image</th>
                <th className="px-4 py-2.5 text-right">CPU</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name} className="border-t hover:bg-accent/60">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.group}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusBadge[s.status].variant}>
                      {statusBadge[s.status].label}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground sm:table-cell">
                    {s.image}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{s.cpu}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Start here</CardTitle>
            <CardDescription>
              Replace the example data in src/data.ts. Write a test in src/App.test.tsx first.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
}
