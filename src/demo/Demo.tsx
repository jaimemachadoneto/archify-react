import { useState, type FC } from "react";
import { Card } from "@/components/ui/card";
import WorkflowDiagram from "@/diagram/WorkflowDiagram";
import type { DiagramSpec } from "@/diagram/spec";
import { useMediaQuery } from "@/diagram/useMediaQuery";

// The demo text is invented and generic. Each id is unique in the whole page.

// A request goes through a classifier. One branch is not used, and one step fails.
const traceSpec: DiagramSpec = {
  version: 1,
  direction: "RIGHT",
  nodes: [
    {
      id: "trace-start",
      label: "Receive request",
      kind: "start",
      state: "used",
      summary: "A request arrives with free text and no other data.",
    },
    {
      id: "trace-classify",
      label: "Classify intent",
      state: "used",
      summary: "A classifier gives the request a topic and a score between 0 and 1.",
    },
    {
      id: "trace-route",
      label: "Choose route",
      kind: "decision",
      state: "used",
      summary: "The router selects the cache for a known topic, and the search for a new topic.",
    },
    {
      id: "trace-cache",
      label: "Check cache",
      state: "skipped",
      summary: "The topic is new, so the cache has no answer. This step did not run.",
    },
    {
      id: "trace-search",
      label: "Search sources",
      state: "used",
      summary: "The search returns four documents that match the topic.",
    },
    {
      id: "trace-verify",
      label: "Check facts",
      state: "failed",
      summary: "Only one document supports the answer. The score of 0.4 is below the limit of 0.7.",
    },
    {
      id: "trace-clarify",
      label: "Ask to clarify",
      state: "used",
      summary: "The system asks the user for one more detail, then tries again.",
    },
    {
      id: "trace-answer",
      label: "Send answer",
      kind: "end",
      state: "used",
      summary: "The system sends the answer and the list of sources.",
    },
  ],
  edges: [
    { id: "trace-e1", source: "trace-start", target: "trace-classify", animated: true },
    { id: "trace-e2", source: "trace-classify", target: "trace-route", animated: true },
    { id: "trace-e3", source: "trace-route", target: "trace-cache", state: "skipped" },
    { id: "trace-e4", source: "trace-route", target: "trace-search", animated: true },
    { id: "trace-e5", source: "trace-search", target: "trace-verify", animated: true },
    {
      id: "trace-e6",
      source: "trace-verify",
      target: "trace-clarify",
      label: "low score",
      state: "failed",
    },
    { id: "trace-e7", source: "trace-clarify", target: "trace-answer", animated: true },
    { id: "trace-e8", source: "trace-cache", target: "trace-answer", state: "skipped" },
  ],
};

// A request moves through three lanes, one role in each lane.
const approvalSpec: DiagramSpec = {
  version: 1,
  direction: "RIGHT",
  lanes: [
    { id: "approval-requester", label: "Requester" },
    { id: "approval-reviewer", label: "Reviewer" },
    { id: "approval-manager", label: "Manager" },
  ],
  nodes: [
    {
      id: "approval-submit",
      label: "Submit request",
      kind: "start",
      lane: "approval-requester",
      state: "used",
      summary: "The requester sends a form with a title, a reason and a cost.",
    },
    {
      id: "approval-check",
      label: "Check request",
      lane: "approval-reviewer",
      state: "used",
      summary: "The reviewer reads the form and checks that each field has a value.",
    },
    {
      id: "approval-approve",
      label: "Approve budget",
      lane: "approval-manager",
      state: "used",
      summary: "The manager compares the cost with the budget and approves the request.",
    },
    {
      id: "approval-notify",
      label: "Send decision",
      kind: "end",
      lane: "approval-manager",
      state: "used",
      summary: "The manager sends the result to the requester.",
    },
  ],
  edges: [
    { id: "approval-e1", source: "approval-submit", target: "approval-check", animated: true },
    { id: "approval-e2", source: "approval-check", target: "approval-approve", animated: true },
    { id: "approval-e3", source: "approval-approve", target: "approval-notify", animated: true },
  ],
};

// A job runs again after a failure, until it succeeds.
const retrySpec: DiagramSpec = {
  version: 1,
  direction: "DOWN",
  nodes: [
    {
      id: "retry-queue",
      label: "Queue job",
      kind: "start",
      state: "used",
      summary: "A new job enters the queue with a limit of three attempts.",
    },
    {
      id: "retry-run",
      label: "Run job",
      state: "used",
      summary: "A worker runs the job. It can take up to ten seconds.",
    },
    {
      id: "retry-ok",
      label: "Succeeded?",
      kind: "decision",
      state: "used",
      summary: "The worker reports success or an error. An error sends the job back.",
    },
    {
      id: "retry-wait",
      label: "Wait and retry",
      state: "used",
      summary: "The job waits twice as long as before, then returns to the worker.",
    },
    {
      id: "retry-publish",
      label: "Publish result",
      kind: "end",
      state: "used",
      summary: "The result goes to the owner of the job.",
    },
  ],
  edges: [
    { id: "retry-e1", source: "retry-queue", target: "retry-run", animated: true },
    { id: "retry-e2", source: "retry-run", target: "retry-ok", animated: true },
    { id: "retry-e3", source: "retry-ok", target: "retry-wait", label: "error", animated: true },
    { id: "retry-e4", source: "retry-wait", target: "retry-run", label: "again", animated: true },
    { id: "retry-e5", source: "retry-ok", target: "retry-publish", label: "success" },
  ],
};

// A phone is at most this wide. A diagram that flows to the right is too wide for it.
const NARROW = "(max-width: 480px)";

type DemoItem = {
  title: string;
  text: string;
  height: number;
  // The height when the diagram flows from the top down on a narrow window.
  narrowHeight: number;
  // A diagram that flows to the right turns to flow down on a narrow window.
  turnsOnNarrow: boolean;
  spec: DiagramSpec;
};

const demos: DemoItem[] = [
  {
    title: "Decision trace",
    text: "The path of one request. A dashed step did not run, and a red step failed.",
    height: 220,
    narrowHeight: 760,
    turnsOnNarrow: true,
    spec: traceSpec,
  },
  {
    title: "Approval with lanes",
    text: "Each lane is one role. The request moves from one lane to the next.",
    height: 260,
    narrowHeight: 560,
    turnsOnNarrow: true,
    spec: approvalSpec,
  },
  {
    title: "Retry loop",
    text: "A step that returns to an earlier step, drawn from the top down.",
    height: 460,
    narrowHeight: 460,
    turnsOnNarrow: false,
    spec: retrySpec,
  },
];

// Each diagram keeps its own selection, because the page shows three diagrams.
const DemoDiagram: FC<DemoItem & { narrow: boolean }> = ({
  title,
  text,
  height: wideHeight,
  narrowHeight,
  turnsOnNarrow,
  spec: baseSpec,
  narrow,
}) => {
  const turned = narrow && turnsOnNarrow;
  const spec: DiagramSpec = turned ? { ...baseSpec, direction: "DOWN" } : baseSpec;
  const height = turned ? narrowHeight : wideHeight;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = spec.nodes.find((node) => node.id === selectedId);

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
      <WorkflowDiagram
        spec={spec}
        selectedId={selectedId}
        onSelect={setSelectedId}
        height={height}
        ariaLabel={title}
      />
      <Card data-selection aria-live="polite" className="min-h-16 p-3">
        {selected ? (
          <>
            <p className="text-sm font-semibold">{selected.label}</p>
            <p data-summary className="text-sm text-muted-foreground">
              {selected.summary ?? "This step has no summary."}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select a step to read its summary.</p>
        )}
      </Card>
    </section>
  );
};

const Demo: FC = () => {
  const narrow = useMediaQuery(NARROW);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      {demos.map((demo) => (
        <DemoDiagram key={demo.title} {...demo} narrow={narrow} />
      ))}
    </div>
  );
};

export default Demo;
