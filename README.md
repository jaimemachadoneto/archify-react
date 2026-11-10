# archify-react

A web app on the shared stack of the workspace: React, Vite, Tailwind CSS
and shadcn/ui, with the shared design tokens.

| Command    | Job                                                          |
| ---------- | ------------------------------------------------------------ |
| `run`      | Starts the dev server.                                       |
| `check`    | Runs the unit tests (Vitest).                                |
| `pnpm e2e` | Runs the browser tests (Playwright), in light and dark mode. |
| `lint`     | Checks the types and the format.                             |
| `build`    | Writes the app to `dist/`.                                   |

The colours, the radius and the fonts come from `design/tokens.json` in
devbase. Do not edit `src/styles/tokens.css` or `src/styles/theme.css`. To
get the latest values, run `base design sync archify-react`.
