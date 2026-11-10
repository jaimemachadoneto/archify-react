import { useState, type ChangeEvent, type FC } from "react";
import { Button } from "@/components/ui/button";
import WorkflowDiagram from "@/diagram/WorkflowDiagram";
import type { DiagramSpec } from "@/diagram/spec";
import { useMediaQuery } from "@/diagram/useMediaQuery";
import "./playground.css";

type Direction = "RIGHT" | "DOWN";
type PresetKey = "lanes" | "pinned" | "invalid";
type Look = "host" | "custom";

// A ticket passes through three lanes. It divides at one decision.
const lanesSpec: DiagramSpec = {
  version: 1,
  direction: "RIGHT",
  lanes: [
    { id: "customer", label: "Customer" },
    { id: "support", label: "Support" },
    { id: "archive", label: "Archive" },
  ],
  nodes: [
    { id: "open", label: "Open ticket", kind: "start", lane: "customer" },
    { id: "triage", label: "Triage", lane: "support" },
    { id: "known", label: "Known issue?", kind: "decision", lane: "support" },
    { id: "answer", label: "Send answer", lane: "support" },
    { id: "engineer", label: "Ask engineer", lane: "support", state: "failed" },
    { id: "close", label: "Close ticket", kind: "end", lane: "archive" },
  ],
  edges: [
    { id: "e1", source: "open", target: "triage", animated: true },
    { id: "e2", source: "triage", target: "known", animated: true },
    { id: "e3", source: "known", target: "answer", label: "yes", animated: true },
    { id: "e4", source: "known", target: "engineer", label: "no", state: "failed" },
    { id: "e5", source: "answer", target: "close", animated: true },
    { id: "e6", source: "engineer", target: "close", state: "skipped" },
  ],
};

// The nodes "scan" and "review" have a fixed position, so the layout does not move them.
const pinnedSpec: DiagramSpec = {
  version: 1,
  direction: "RIGHT",
  nodes: [
    { id: "upload", label: "Upload file", kind: "start" },
    { id: "scan", label: "Scan file", position: { x: 160, y: 110 } },
    { id: "review", label: "Review file", position: { x: 320, y: 0 } },
    { id: "store", label: "Store file", kind: "end" },
  ],
  edges: [
    { id: "e1", source: "upload", target: "scan", animated: true },
    { id: "e2", source: "scan", target: "review", animated: true },
    { id: "e3", source: "review", target: "store", animated: true },
  ],
};

// This spec has three problems: a duplicate node ID, an unknown target and an unknown source.
const invalidSpec: DiagramSpec = {
  version: 1,
  direction: "RIGHT",
  nodes: [
    { id: "receive", label: "Receive order" },
    { id: "receive", label: "Receive order again" },
  ],
  edges: [
    { id: "e1", source: "receive", target: "ship" },
    { id: "e2", source: "pack", target: "receive" },
  ],
};

const presets: Record<PresetKey, { label: string; spec: DiagramSpec }> = {
  lanes: { label: "Valid with lanes", spec: lanesSpec },
  pinned: { label: "Pinned positions", spec: pinnedSpec },
  invalid: { label: "Invalid spec", spec: invalidSpec },
};

const looks: Record<Look, string> = { host: "Host variables", custom: "Custom palette" };

const HEIGHT: Record<Direction, number> = { RIGHT: 340, DOWN: 640 };
// A phone is at most this wide. The diagram needs a different height there, and a new view when the layout changes.
const NARROW = "(max-width: 480px)";
const NARROW_HEIGHT: Record<Direction, number> = { RIGHT: 420, DOWN: 760 };
// A longer text is not parsed on each key. A valid spec at the limits of the library is far shorter.
const MAX_TEXT_LENGTH = 300_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const directionOf = (spec: unknown): Direction =>
  isRecord(spec) && spec.direction === "DOWN" ? "DOWN" : "RIGHT";

// A value that JSON.parse made can be too deep for JSON.stringify. The caller keeps the text then.
const format = (spec: unknown): string | null => {
  try {
    return JSON.stringify(spec, null, 2) ?? null;
  } catch {
    return null;
  }
};

const fieldClass =
  "h-11 rounded-md border border-border bg-card px-2 text-sm text-card-foreground sm:h-9 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const labelClass = "flex flex-col gap-1 text-sm font-medium";
const ringClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
// A row of a control is at least 24 px high (WCAG 2.5.8), and 44 px on a phone.
const rowClass = "flex min-h-11 items-center gap-2 text-sm sm:min-h-6";

const Playground: FC = () => {
  const narrow = useMediaQuery(NARROW);
  const [presetKey, setPresetKey] = useState<PresetKey>("lanes");
  // The text can hold JSON that is not a spec, so the state is unknown, not DiagramSpec.
  // On a phone the diagram starts from the top down, like the other examples: a wide diagram does not fit there.
  const [spec, setSpec] = useState<unknown>(() =>
    narrow ? { ...lanesSpec, direction: "DOWN" } : lanesSpec,
  );
  const [text, setText] = useState(
    () => format(narrow ? { ...lanesSpec, direction: "DOWN" } : lanesSpec) ?? "",
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(true);
  const [look, setLook] = useState<Look>("host");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const direction = directionOf(spec);
  const textIsGood = jsonError === null;

  // The selected step can be gone after a new spec. The host owns the selection, so the playground clears it.
  const hasStep = (value: unknown, id: string | null) =>
    id !== null &&
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.some((node) => isRecord(node) && node.id === id);

  // A control rewrites the text. Typing in the text never calls this, so the text stays as typed.
  const show = (next: unknown) => {
    setSpec(next);
    const written = format(next);
    if (written !== null) setText(written);
    setJsonError(null);
    if (!hasStep(next, selectedId)) setSelectedId(null);
  };

  const onPreset = (event: ChangeEvent<HTMLSelectElement>) => {
    const key = event.target.value as PresetKey;
    setPresetKey(key);
    show({ ...presets[key].spec, direction });
  };

  const onDirection = (next: Direction) => {
    // Text that is not valid JSON is the work of the user. A control must not replace it.
    if (!textIsGood) {
      setSpec((current: unknown) => ({
        ...(isRecord(current) ? current : presets[presetKey].spec),
        direction: next,
      }));
      return;
    }
    const base = isRecord(spec) ? spec : presets[presetKey].spec;
    show({ ...base, direction: next });
  };

  const onText = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    if (value.length > MAX_TEXT_LENGTH) {
      setJsonError(`The text is too long. The limit is ${MAX_TEXT_LENGTH} characters.`);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(value);
      setSpec(parsed);
      setJsonError(null);
      if (!hasStep(parsed, selectedId)) setSelectedId(null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      setJsonError(`The text is not valid JSON: ${reason}. The diagram keeps the last spec.`);
    }
  };

  const onReset = () => show({ ...presets[presetKey].spec, direction });

  return (
    <section
      className={`playground flex min-w-0 flex-col gap-3 ${look === "custom" ? "playground--custom" : ""}`}
    >
      <h2 className="text-lg font-semibold tracking-tight">Playground</h2>
      <p className="text-sm text-muted-foreground">
        Change the controls to see the features that the examples above do not show. Edit the JSON
        to draw your own spec.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Direction</legend>
          {(["RIGHT", "DOWN"] as const).map((value) => (
            <label key={value} className={rowClass}>
              <input
                type="radio"
                name="playground-direction"
                value={value}
                checked={direction === value}
                onChange={() => onDirection(value)}
                className={`size-4 accent-primary ${ringClass}`}
              />
              {value}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Path</span>
          <label className={rowClass}>
            <input
              type="checkbox"
              checked={highlight}
              onChange={(event) => setHighlight(event.target.checked)}
              className={`size-4 accent-primary ${ringClass}`}
            />
            Highlight
          </label>
          <span className="text-xs text-muted-foreground">
            Hover or focus a step to dim the steps outside its path.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            Spec preset
            <select value={presetKey} onChange={onPreset} className={fieldClass}>
              {(Object.keys(presets) as PresetKey[]).map((key) => (
                <option key={key} value={key}>
                  {presets[key].label}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            A preset replaces the JSON below. The direction stays.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            Look
            <select
              value={look}
              onChange={(event) => setLook(event.target.value as Look)}
              className={fieldClass}
            >
              {(Object.keys(looks) as Look[]).map((key) => (
                <option key={key} value={key}>
                  {looks[key]}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            Custom palette sets the --archify-* variables on the diagram only. It has a light and a
            dark variant. The page does not change.
          </span>
        </div>
      </div>

      <WorkflowDiagram
        // A new key gives a new view, so the diagram fits the window again after a direction or a preset change.
        key={`${direction}-${presetKey}-${narrow ? "narrow" : "wide"}`}
        spec={spec as DiagramSpec}
        selectedId={selectedId}
        onSelect={setSelectedId}
        height={(narrow ? NARROW_HEIGHT : HEIGHT)[direction]}
        ariaLabel="Playground diagram"
        highlight={highlight}
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {selectedId === null ? "Select a step to see its ID." : `Selected step ID: ${selectedId}`}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor="playground-json">
          Spec JSON
        </label>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          Reset the JSON
        </Button>
      </div>
      {jsonError !== null && (
        <p id="playground-json-error" role="alert" className="text-sm text-destructive">
          {jsonError}
        </p>
      )}
      <textarea
        id="playground-json"
        value={text}
        onChange={onText}
        spellCheck={false}
        rows={16}
        aria-invalid={jsonError !== null}
        aria-describedby={jsonError === null ? undefined : "playground-json-error"}
        className={`w-full rounded-md border border-border bg-card p-3 font-mono text-xs text-card-foreground aria-invalid:border-destructive ${ringClass}`}
      />
    </section>
  );
};

export default Playground;
