import type { FC, ReactNode } from "react";
import { PROBLEM_CODES } from "@/diagram";
import { CODE_MEANING, FUNCTIONS, HOST_VARIABLES, LIMITS, PROPS } from "./referenceData";

// The hash of the reference page and of each of its parts. App.tsx opens the page for all of them.
export const REFERENCE_HASH = "#reference";

const PARTS = [
  { id: "reference-props", title: "Props" },
  { id: "reference-functions", title: "Functions" },
  { id: "reference-codes", title: "Problem codes" },
  { id: "reference-limits", title: "Limits" },
  { id: "reference-variables", title: "Host variables" },
] as const;

const linkClass =
  "rounded-sm underline underline-offset-4 hover:text-muted-foreground " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const th = "bg-muted px-3 py-2 text-left font-medium";
const td = "border-t border-border px-3 py-2 align-top";
// The first cell of a row stays at the left edge, so the name of a row is in view after a sideways scroll.
const sticky = "sticky left-0 shadow-[inset_-1px_0_0_var(--border)]";
const rowHead = `${td} ${sticky} bg-card text-left font-normal`;

const Code: FC<{ children: ReactNode }> = ({ children }) => (
  <code className="font-mono text-xs">{children}</code>
);

// A wide table scrolls inside its own box, so the page never scrolls sideways. The box takes focus,
// so a keyboard user can scroll it.
const Part: FC<{
  id: string;
  title: string;
  caption: string;
  intro?: string;
  head: string[];
  children: ReactNode;
}> = ({ id, title, caption, intro, head, children }) => (
  <section id={id} className="flex min-w-0 scroll-mt-4 flex-col gap-2">
    <h3 id={`${id}-title`} className="text-base font-semibold tracking-tight">
      {title}
    </h3>
    {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
    <div
      role="region"
      aria-labelledby={`${id}-title`}
      tabIndex={0}
      className="overflow-x-auto rounded-md border border-muted-foreground bg-card text-card-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((name, index) => (
              <th key={name} scope="col" className={index === 0 ? `${th} ${sticky}` : th}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
    <p className="text-xs text-muted-foreground sm:hidden">
      Scroll sideways to see all the columns.
    </p>
  </section>
);

const Reference: FC = () => (
  <section id="reference" className="flex min-w-0 flex-col gap-6">
    <div className="flex flex-col gap-2">
      <h2 id="reference-title" className="text-lg font-semibold tracking-tight">
        Reference
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">
        The public names of archify-react. The limits and the problem codes come from the code of
        the library, so this page shows the values of this version.
      </p>
      <nav aria-label="Contents">
        <ul className="flex flex-wrap gap-x-2 text-sm">
          {PARTS.map((part) => (
            <li key={part.id}>
              <a
                href={`#${part.id}`}
                className={`${linkClass} inline-flex min-h-11 min-w-11 items-center justify-center px-2 sm:min-h-6`}
              >
                {part.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>

    <Part
      id="reference-props"
      title="Props"
      caption="Props of WorkflowDiagram"
      intro="The props of the WorkflowDiagram component."
      head={["Prop", "Type", "Default", "Description"]}
    >
      {PROPS.map((prop) => (
        <tr key={prop.name}>
          <th scope="row" className={rowHead}>
            <Code>{prop.name}</Code>
          </th>
          <td className={td}>
            <Code>{prop.type}</Code>
          </td>
          <td className={td}>{prop.defaultValue}</td>
          <td className={td}>{prop.description}</td>
        </tr>
      ))}
    </Part>

    <Part
      id="reference-functions"
      title="Functions"
      caption="Functions"
      intro="Four functions for a host that prepares a spec, or that draws its own view."
      head={["Signature", "Job"]}
    >
      {FUNCTIONS.map((fn) => (
        <tr key={fn.signature}>
          <th scope="row" className={rowHead}>
            <Code>{fn.signature}</Code>
          </th>
          <td className={td}>{fn.job}</td>
        </tr>
      ))}
    </Part>

    <Part
      id="reference-codes"
      title="Problem codes"
      caption="Problem codes"
      intro="The code of each problem that validateSpec reports."
      head={["Code", "Meaning"]}
    >
      {PROBLEM_CODES.map((code) => (
        <tr key={code}>
          <th scope="row" className={`${rowHead} whitespace-nowrap`}>
            <Code>{code}</Code>
          </th>
          <td className={td}>{CODE_MEANING[code]}</td>
        </tr>
      ))}
    </Part>

    <Part
      id="reference-limits"
      title="Limits"
      caption="Limits"
      intro="The validation reports a value beyond a limit as a problem."
      head={["Name", "Value", "Meaning"]}
    >
      {LIMITS.map((limit) => (
        <tr key={limit.name}>
          <th scope="row" className={`${rowHead} whitespace-nowrap`}>
            <Code>{limit.name}</Code>
          </th>
          <td className={td}>{String(limit.value)}</td>
          <td className={td}>{limit.meaning}</td>
        </tr>
      ))}
    </Part>

    <Part
      id="reference-variables"
      title="Host variables"
      caption="Host variables"
      intro="The stylesheet reads these variables. A host that does not define one gets the fallback."
      head={["Host variable", "Fallback", "Styles"]}
    >
      {HOST_VARIABLES.map((variable) => (
        <tr key={variable.name}>
          <th scope="row" className={`${rowHead} whitespace-nowrap`}>
            <Code>{variable.name}</Code>
          </th>
          <td className={td}>
            <Code>{variable.fallback}</Code>
          </td>
          <td className={td}>{variable.styles}</td>
        </tr>
      ))}
    </Part>
  </section>
);

export default Reference;
