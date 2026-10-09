import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { servedReadOnly } from "@/hooks/useLocalReports";
import { toast } from "@/lib/toast";
import type { ExpectedFact } from "@/report/evals";

export interface EvalsState {
  /** Whether facts can be added here: served by `complydoc ui`, with the folder on this machine. */
  editable: boolean;
  file: string | null;
  /** What the file holds now; null when it cannot be read from here. */
  facts: ExpectedFact[] | null;
  error: string | null;
  add: (fact: ExpectedFact) => Promise<boolean>;
  remove: (fact: ExpectedFact) => Promise<boolean>;
}

interface Listing {
  file: string;
  facts: ExpectedFact[];
}

const READ_ONLY: EvalsState = {
  editable: false,
  file: null,
  facts: null,
  error: null,
  add: async () => false,
  remove: async () => false,
};

/** The run's evals file, shared by the Evals page and the document view that adds to it. */
export const EvalsContext = createContext<EvalsState>(READ_ONLY);

export function useEvalsState(): EvalsState {
  return useContext(EvalsContext);
}

/**
 * The evals file beside the documents a report read. With `source`, the report came from
 * `complydoc ui`, which reads and writes the file; without it, the facts are the ones the
 * run checked, read only.
 */
export function useEvals(source?: string): EvalsState {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = source ? `${source}/evals` : null;

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    fetch(url, { signal: abort.signal })
      .then(async (response) => (response.ok ? setListing((await response.json()) as Listing) : setListing(null)))
      .catch(() => undefined);
    return () => abort.abort();
  }, [url]);

  const write = useCallback(
    async (method: "POST" | "DELETE", fact: ExpectedFact) => {
      if (!url) return false;
      try {
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: fact.text, document: fact.document ?? null }),
        });
        if (!response.ok) {
          setError(await response.text());
          return false;
        }
        setListing((await response.json()) as Listing);
        setError(null);
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "complydoc ui could not be reached.");
        return false;
      }
    },
    [url],
  );

  return {
    editable: listing !== null && !servedReadOnly(),
    file: listing?.file ?? null,
    facts: listing?.facts ?? null,
    error,
    add: async (fact) => {
      const done = await write("POST", fact);
      if (done) toast("Expected: the next run checks it");
      return done;
    },
    remove: async (fact) => {
      const done = await write("DELETE", fact);
      if (done) toast("No longer expected");
      return done;
    },
  };
}
