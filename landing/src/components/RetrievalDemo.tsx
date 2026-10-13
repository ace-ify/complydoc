import { CheckIcon, ScissorsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { QUESTIONS, SPLITTER_RUNS, TOP_K, type RetrievalStatus } from "@/data/retrieval";
import { useInView } from "@/hooks/useInView";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const HOLD_MS = 4200;
const STAGGER_MS = 260;

const STATUS: Record<RetrievalStatus, { label: string; icon: typeof CheckIcon; className: string }> = {
  retrieved: { label: "retrieved", icon: CheckIcon, className: "bg-success-soft text-success" },
  split: { label: "split", icon: ScissorsIcon, className: "bg-destructive-soft text-destructive" },
};

/**
 * The retrieval check, one splitter at a time: the same questions, and whether a chunk
 * holding each answer ranks in the top results. It steps through the splitters on its
 * own once on screen, and stops when a reader picks one or asks for less motion.
 */
export function RetrievalDemo() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (!seen || still || picked) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % SPLITTER_RUNS.length), HOLD_MS);
    return () => clearInterval(timer);
  }, [seen, still, picked]);

  const run = SPLITTER_RUNS[active];
  if (!run) return null;
  const answered = run.results.filter((status) => status === "retrieved").length;

  return (
    <div ref={ref} className="flex flex-col overflow-hidden rounded-xl border bg-card text-sm shadow-sm">
      <div role="tablist" aria-label="Splitter" className="flex flex-wrap gap-1.5 border-b p-3">
        {SPLITTER_RUNS.map((splitter, i) => (
          <button
            key={splitter.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => {
              setActive(i);
              setPicked(true);
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              i === active ? "border-primary/40 bg-success-soft text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {splitter.label}
          </button>
        ))}
      </div>

      <ul key={active} className="flex flex-col divide-y">
        {QUESTIONS.map((question, i) => {
          const status = STATUS[run.results[i] ?? "split"];
          return (
            <li key={question} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="min-w-0 text-pretty">{question}</span>
              <span
                style={{ animationDelay: `${i * STAGGER_MS}ms` }}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                  "animate-in fill-mode-both fade-in zoom-in-95 duration-300 motion-reduce:animate-none",
                  status.className,
                )}
              >
                <status.icon className="size-3" />
                {status.label}
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="grid grid-cols-3 divide-x border-t bg-muted/40 text-center">
        <Figure value={`${answered} of ${QUESTIONS.length}`} label={`answered in the top ${TOP_K}`} />
        <Figure value={run.chunks.toLocaleString("en")} label="chunks" />
        <Figure value={`${Math.round(run.cutBadly * 100)}%`} label="cut badly" />
      </dl>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-3">
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dt className="text-xs text-muted-foreground">{label}</dt>
    </div>
  );
}
