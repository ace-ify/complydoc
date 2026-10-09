import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trail } from "@/report/findValue";
import { path } from "@/report/findValue";
import { required } from "@/test/sample";
import { FindValueDialog } from "./FindValueDialog";

const TRAIL: Trail = {
  found: true,
  label: "IBAN",
  masked: "GB29 •••• 68 19",
  reports_searched: 4,
  runs: [
    {
      report: "ingest-2.json",
      name: "contracts-ingest",
      kind: "pipeline",
      started_at: "2026-10-03T09:00:00",
      commit: null,
      documents: [],
      stages: [{ step: 1, kind: "load", component: "PyPDFLoader", occurrences: 1, hosts: [] }],
      sent_to: [],
    },
    {
      report: "ingest-1.json",
      name: "contracts-ingest",
      kind: "pipeline",
      started_at: "2026-10-02T09:00:00",
      commit: "a".repeat(40),
      documents: [{ path: "msa.pdf", pages: [3, 7], occurrences: 2 }],
      stages: [
        { step: 1, kind: "load", component: "PyPDFLoader", occurrences: 1, hosts: [] },
        { step: 2, kind: "load", component: "PyPDFLoader", occurrences: 1, hosts: [] },
        { step: 3, kind: "embed", component: "OpenAIEmbeddings", occurrences: 2, hosts: ["api.openai.com"] },
      ],
      sent_to: ["api.openai.com"],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("FindValueDialog", () => {
  it("names each component once along the path a value took", () => {
    expect(path(required(TRAIL.runs[1]).stages).map((stage) => stage.component)).toEqual([
      "PyPDFLoader",
      "OpenAIEmbeddings",
    ]);
  });

  it("asks the server and shows where the value went, and where it was stopped", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(TRAIL)));
    vi.stubGlobal("fetch", fetch);
    render(<FindValueDialog open onOpenChange={() => undefined} />);

    await userEvent.type(screen.getByLabelText("The value to find"), "GB29 NWBK 6016 1331 9268 19");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));

    expect(fetch).toHaveBeenCalledWith(
      "api/find",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ value: "GB29 NWBK 6016 1331 9268 19" }) }),
    );
    expect(await screen.findByText("GB29 •••• 68 19")).toBeInTheDocument();
    expect(screen.getByText(/in 2 runs of 4 reports/)).toBeInTheDocument();

    const [stopped, sent] = screen
      .getAllByRole("listitem")
      .filter((item) => within(item).queryByText("contracts-ingest"));
    expect(within(required(stopped)).getByText("Not sent anywhere")).toBeInTheDocument();
    expect(within(required(sent)).getByText("Sent to api.openai.com")).toBeInTheDocument();
    expect(within(required(sent)).getByText("msa.pdf")).toBeInTheDocument();
    expect(within(required(sent)).getByText("pages 3, 7")).toBeInTheDocument();
    expect(within(required(sent)).getByText("aaaaaaa")).toBeInTheDocument();
  });

  it("says so when no run found the value, or the server refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ...TRAIL, found: false, runs: [], label: null, masked: null }))),
    );
    render(<FindValueDialog open onOpenChange={() => undefined} />);
    await userEvent.type(screen.getByLabelText("The value to find"), "nothing");
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText(/Not found in 4 reports/)).toBeInTheDocument();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("only the viewer's own page can ask this", { status: 403 })),
    );
    await userEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(await screen.findByText("only the viewer's own page can ask this")).toBeInTheDocument();
  });
});
