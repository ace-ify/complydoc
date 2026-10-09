import { NotInRun } from "@/components/NotInRun";
import { Section, SectionStack } from "@/components/Section";
import { useEvals } from "@/hooks/useEvals";
import { factsToShow } from "@/report/evals";
import { fileName, plural } from "@/report/format";
import type { Report } from "@/report/types";
import { AddFact } from "./AddFact";
import { FactList } from "./FactList";
import { Scoreboard } from "./Scoreboard";

/**
 * Evals on your own documents: the passages a reading of this folder must contain, and how
 * each reading did. An audit scores its own reader; a loader comparison scores every loader
 * side by side. The passages are kept in a file beside the documents, which `complydoc ui`
 * can add to. A prototype.
 */
export function EvalsPage({ report, source }: { report: Report; source?: string }) {
  const state = useEvals(source);
  const evals = report.evals ?? null;
  const facts = factsToShow(state.facts, evals);
  const scored = (evals?.checks.length ?? 0) > 0;

  if (!scored && !state.editable && facts.length === 0) return <NotInRun report={report} content="evals" />;

  return (
    <SectionStack>
      {scored && evals && (
        <Section
          title="Scoreboard"
          aside={`${plural(evals.checks.length, "fact")} · ${plural(evals.readers.length, "reading")}`}
        >
          <Scoreboard evals={evals} />
        </Section>
      )}
      <Section
        title="Expected facts"
        aside={(state.file ?? evals?.file) ? fileName(state.file ?? evals?.file ?? "") : "No evals file yet"}
      >
        {facts.length > 0 ? (
          <FactList
            facts={facts}
            evals={evals}
            {...(state.editable ? { onRemove: (fact) => void state.remove(fact) } : {})}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing is expected yet. Add a passage one of these documents must come out with, then run the audit or the
            loader comparison again to see which readings keep it.
          </p>
        )}
        {state.editable && (
          <AddFact documents={report.documents.map((d) => d.relative_path)} error={state.error} onAdd={state.add} />
        )}
      </Section>
    </SectionStack>
  );
}
