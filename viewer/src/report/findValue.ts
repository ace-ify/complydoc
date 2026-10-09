/** Where a value went, as `complydoc ui` answers it: every run that held it. A prototype. */
export interface Trail {
  found: boolean;
  /** What kind of identifier it was found as, such as "IBAN". */
  label: string | null;
  /** The value as reports show it. */
  masked: string | null;
  runs: RunSighting[];
  reports_searched: number;
}

export interface RunSighting {
  report: string;
  /** The pipeline's name, or the folder audited. */
  name: string;
  kind: "pipeline" | "audit";
  started_at: string;
  commit: string | null;
  documents: { path: string; pages: number[]; occurrences: number }[];
  stages: StageSighting[];
  /** Every host a step holding the value sent its input to. */
  sent_to: string[];
}

export interface StageSighting {
  step: number;
  kind: string;
  component: string;
  occurrences: number;
  hosts: string[];
}

/**
 * Ask the server that served this page where `value` went. The value goes to that
 * server only, which hashes it and searches the reports for the hash; it is not kept.
 */
export async function findValue(value: string): Promise<Trail> {
  const response = await fetch("api/find", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!response.ok) throw new Error((await response.text()) || `${response.status} ${response.statusText}`);
  return (await response.json()) as Trail;
}

/** The steps a value passed through, each component once, in order. */
export function path(stages: StageSighting[]): StageSighting[] {
  const seen = new Set<string>();
  return stages.filter((stage) => (seen.has(stage.component) ? false : (seen.add(stage.component), true)));
}
