/**
 * `complydoc chunks` on the sample documents with five questions, three chunk sizes and
 * `--top-k 3`, as its `complydoc-chunks.json` holds them. Run it again when a release
 * changes what it prints.
 */
export type RetrievalStatus = "retrieved" | "split";

export const TOP_K = 3;

export const QUESTIONS = [
  "When are invoices payable?",
  "Which law governs the agreement?",
  "Which accounts have no multi-factor authentication?",
  "How often are access reviews performed?",
  "When does title in the goods pass?",
];

export interface SplitterRun {
  /** The splitter's settings, as the viewer names it. */
  label: string;
  chunks: number;
  /** Share of chunks flagged as tiny, cut mid-sentence or ending on a heading. */
  cutBadly: number;
  /** One per question, in the order of `QUESTIONS`. */
  results: RetrievalStatus[];
}

export const SPLITTER_RUNS: SplitterRun[] = [
  { label: "chunk_size 60", chunks: 108, cutBadly: 0.91, results: ["split", "split", "split", "retrieved", "split"] },
  {
    label: "chunk_size 200",
    chunks: 30,
    cutBadly: 0.37,
    results: ["retrieved", "retrieved", "retrieved", "retrieved", "retrieved"],
  },
  {
    label: "chunk_size 800",
    chunks: 10,
    cutBadly: 0,
    results: ["retrieved", "retrieved", "retrieved", "retrieved", "retrieved"],
  },
];
