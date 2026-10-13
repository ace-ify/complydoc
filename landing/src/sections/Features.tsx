import { FileCogIcon } from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";
import { FeatureRow } from "@/components/FeatureRow";
import { RetrievalDemo } from "@/components/RetrievalDemo";
import { Section } from "@/components/Section";
import { TeamDiagram } from "@/components/TeamDiagram";
import { links } from "@/links";

/** A policy as `complydoc check` reads it, from the policy guide. */
const POLICY = `version: 1
rules:
  no_hidden:
    severity: medium
  no_identifiers_sent:
    severity: high
  no_network: true
  no_regressions:
    baseline: baseline.json`;

export function Features() {
  return (
    <Section
      id="features"
      eyebrow="What it does"
      title="Measure the pipeline before your users do."
      lead="Each check runs on your own documents, on your machine, and gives a result you can read in the viewer or fail a build on."
    >
      <div className="flex flex-col gap-6">
        <FeatureRow
          title="Ask your chunks the questions your users will."
          more={{ label: "The retrieval check", href: links.retrieval }}
          visual={<RetrievalDemo />}
        >
          Write the questions and the passage that answers each. complydoc splits your documents with every splitter you
          are choosing between, and shows which ones cut an answer in two before a retriever ever sees it.
        </FeatureRow>
        <FeatureRow
          title="One place where the whole team reads the same runs."
          more={{ label: "Run it for your team", href: links.team }}
          visual={<TeamDiagram />}
        >
          Runs from every machine and CI job land in one folder, each with the commit it came from. The viewer serves
          them read-only from a container, behind the sign-in you already have. Nothing leaves your infrastructure.
        </FeatureRow>
        <FeatureRow
          title="Fail the build when ingestion gets worse."
          more={{ label: "Policy files", href: links.policy }}
          visual={
            <CodeBlock
              title="complydoc check ./documents --policy policy.yaml"
              icon={<FileCogIcon className="size-3.5" />}
              lang="yaml"
              code={POLICY}
            />
          }
        >
          A policy file holds a folder or a recorded pipeline to rules: no hidden instructions, no identifier sent to a
          hosted model, nothing worse than the last run. One command checks them all and exits non-zero.
        </FeatureRow>
      </div>
    </Section>
  );
}
