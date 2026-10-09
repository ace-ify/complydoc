import { ArrowRightIcon, FileTextIcon, SendIcon, ShieldCheckIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KIND } from "@/features/pipeline/kinds";
import { formatStarted } from "@/features/pipeline/started";
import { plural } from "@/report/format";
import { findValue, path, type RunSighting, type Trail } from "@/report/findValue";
import { shortCommit } from "@/report/runContext";
import type { StepKind } from "@/report/traceView";

function pages(numbers: number[]): string {
  if (numbers.length === 0) return "";
  return `${numbers.length === 1 ? "page" : "pages"} ${numbers.join(", ")}`;
}

/** One run that held the value: the documents it was in, the steps it passed, where it was sent. */
function Run({ run }: { run: RunSighting }) {
  const steps = path(run.stages);
  return (
    <li className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium">{run.name}</span>
        <span className="text-xs text-muted-foreground">
          {run.kind === "pipeline" ? "Pipeline" : "Audit"} · {formatStarted(run.started_at)}
        </span>
        {run.commit && <span className="font-mono text-xs text-muted-foreground">{shortCommit(run.commit)}</span>}
      </div>
      {run.documents.map((document) => (
        <div key={document.path} className="flex items-center gap-2 text-sm">
          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate">{document.path}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{pages(document.pages)}</span>
        </div>
      ))}
      {steps.length > 0 && (
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm" aria-label="Steps it passed through">
          {steps.map((stage, index) => {
            const kind = KIND[stage.kind as StepKind] ?? KIND.custom;
            return (
              <li key={stage.step} className="flex items-center gap-1.5">
                {index > 0 && <ArrowRightIcon className="size-3 text-muted-foreground" aria-hidden="true" />}
                <kind.icon className={`size-3.5 ${kind.tone}`} aria-hidden="true" />
                <span>{stage.component}</span>
              </li>
            );
          })}
        </ol>
      )}
      {run.sent_to.length > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <SendIcon className="size-3.5" aria-hidden="true" />
          Sent to {run.sent_to.join(", ")}
        </p>
      ) : (
        run.kind === "pipeline" && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <ShieldCheckIcon className="size-3.5" aria-hidden="true" />
            Not sent anywhere
          </p>
        )
      )}
    </li>
  );
}

function Result({ trail }: { trail: Trail }) {
  if (!trail.found)
    return (
      <p className="text-sm text-muted-foreground">
        Not found in {plural(trail.reports_searched, "report")}. A value is found only where a run looked for its kind
        and read it as it is written here.
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-medium">{trail.label ?? "Identifier"}</span>
        <span className="font-mono">{trail.masked}</span>
        <span className="text-muted-foreground">
          in {plural(trail.runs.length, "run")} of {plural(trail.reports_searched, "report")}
        </span>
      </p>
      <ul className="flex flex-col gap-2">
        {trail.runs.map((run) => (
          <Run key={run.report} run={run} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Where a value went. Type an identifier as it is written; the server hashes it and
 * searches every report it serves for the hash, so the answer comes from reports that
 * never held the value, and the value is kept nowhere. A prototype.
 */
export function FindValueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [value, setValue] = useState("");
  const [trail, setTrail] = useState<Trail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      setTrail(await findValue(value));
    } catch (reason) {
      setTrail(null);
      setError(reason instanceof Error ? reason.message : "complydoc ui could not be reached.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Find a value</DialogTitle>
          <DialogDescription>
            Every document, step and host an identifier reached, across all the runs here. What you type is hashed to
            search and is not kept.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void find();
          }}
        >
          <Input
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-label="The value to find"
            placeholder="An account number, a name, an email address…"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" disabled={busy || !value.trim()}>
            Find
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {trail && <Result trail={trail} />}
      </DialogContent>
    </Dialog>
  );
}
