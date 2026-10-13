// The recordings on the landing page, one scene each.
//   node scenes.mjs <contracts viewer url> <documents viewer url> <out dir> <scene> <light|dark>
import { around, camera, centre, film, sleep } from "./film.mjs";
const [A, D, out, scene, theme] = process.argv.slice(2);
const TRACE = encodeURIComponent("trace/contracts-ingest-20261013-230504.json");
const SPLITTER = "chunk_size 400";
// A short label on the page, by where it is: the lowest one, or the leftmost.
const label = (text, pick) => `(() => { const all = [...document.querySelectorAll("body *")].filter((e) => { if (e.closest("#__cursor")) return false; const t = (e.innerText || "").trim(); return t.startsWith(${JSON.stringify(text)}) && t.length < 60 && e.getClientRects().length; }); if (!all.length) return null; const box = (e) => e.getBoundingClientRect(); all.sort((x, y) => ${pick === "lowest" ? "box(y).y - box(x).y" : "box(x).x - box(y).x"} || box(x).width * box(x).height - box(y).width * box(y).height); const r = box(all[0]); return [r.x, r.y, r.width, r.height]; })()`;
const tab = async (f, name) => { const t = await f.eval(`(() => { const e = [...document.querySelectorAll("button,[role=tab]")].find((x) => x.innerText.trim() === ${JSON.stringify(name)}); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`); return t; };

const scenes = {
  /** Find a value: typed, searched, then the run that stopped it and the run that sent it. */
  async find(f) {
    await f.goto(`${A}?run=complydoc.json&theme=${theme}#find`);
    await f.snap(); f.hold(16);
    const input = await f.css("main input");
    const top = camera([input[0] - 10, input[1] - 30, 820, 470], 0);
    await f.glide([input[0] + 80, input[1] + input[3] / 2], 22, top);
    await f.click(2);
    await f.type("GB82 WEST 1234 5698 7654 32");
    f.hold(6);
    const button = await f.css("main form button") ?? (await f.rect("Find", "button"));
    await f.glide(centre(button), 12);
    await f.click(26, 110);
    f.hold(22);
    const stopped = await f.rect("Stopped after");
    const sent = await f.eval(label("Sent to localhost", "leftmost"));
    const left = input[0] - 10;
    f.pan(camera([left, stopped[1] - 34, 800, 280], 0), 26); f.hold(64);
    f.pan(camera([sent[0] + sent[2] - 790, sent[1] - 34, 800, 250], 0), 30); f.hold(64);
    f.pan(f.full, 26); f.hold(14);
  },
  /** The trace: a run opened from the list, the scan that loaded no text, the call that sent identifiers. */
  async trace(f) {
    await f.goto(`${A}?run=${TRACE}&theme=${theme}#pipeline`);
    await f.snap(); f.hold(20);
    const row = await f.eval(`(() => { const rows = [...document.querySelectorAll("main tbody tr")]; const r = (rows.find((x) => x.lastElementChild && x.lastElementChild.innerText.trim() === "19") || rows[0]).getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);
    await f.glide([row[0] + 260, row[1] + row[3] / 2], 22);
    await f.click(18, 90);
    f.hold(18);
    const search = await f.rect("Search calls");
    const head = await f.rect("Tokens embedded");
    const x0 = Math.min(search?.[0] ?? 560, head?.[0] ?? 560) - 40, y0 = (head?.[1] ?? 100) - 50;
    const panel = camera([x0, y0, 1440 - x0, 900 - y0], 0);
    f.pan(panel, 30); f.hold(20);
    const scan = await f.eval(label("invoice-scan", "leftmost"));
    if (scan) { await f.glide([scan[0] + 40, scan[1] + scan[3] / 2], 18); await f.click(10, 80); f.hold(56); }
    const embed = await f.eval(label("OpenAIEmbeddings", "lowest"));
    if (embed) { await f.glide([embed[0] + 40, embed[1] + embed[3] / 2], 18); await f.click(10, 80); f.hold(64); }
    f.pan(f.full, 28); f.hold(14);
  },
  /** Compare: the diff of two readers, and the one line where they part. */
  async diff(f) {
    await f.goto(`${D}?run=complydoc.json&theme=${theme}#documents/1`);
    await f.snap(); f.hold(20);
    const table = await f.css("table.diff-table");
    const word = await f.eval(label("upational", "lowest")) ?? table;
    await f.glide([table[0] + table[2] * 0.72, table[1] + table[3] * 0.62], 26, camera(table, 16));
    f.hold(76);
    f.pan(camera([table[0] + table[2] / 2 - 40, table[1] + table[3] * 0.35, 640, 300], 0), 24); f.hold(60);
    f.pan(f.full, 26); f.hold(14);
  },
  /** Read: a document's text, then a splitter's chunks drawn over it. */
  async read(f) {
    await f.goto(`${A}?run=complydoc.json&theme=${theme}#documents/0`);
    await f.snap(); f.hold(12);
    const text = await tab(f, "Text");
    if (text) { await f.glide(centre(text), 16); await f.click(8, 80); }
    const reading = await f.css('[data-testid="page-reading"]');
    const zoom = camera([reading[0] - 10, reading[1] - 50, 700, 430], 0);
    const chunks = await f.rect("No chunks", "button");
    if (chunks) {
      await f.glide(centre(chunks), 18); await f.click(8, 70);
      const option = await f.eval(`(() => { const e = [...document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"]')].find((x) => x.innerText.includes(${JSON.stringify(SPLITTER)})); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);
      if (option) { await f.glide(centre(option), 12); f.hold(6); await f.click(12, 80); }
      else console.log("no chunk option found");
    }
    await f.glide([reading[0] + 330, reading[1] + 250], 26, zoom);
    f.hold(40);
    await f.glide([reading[0] + 250, reading[1] + 330], 20);
    f.hold(50);
    f.pan(f.full, 26); f.hold(14);
  },
  /** Protect: what was found, by severity, by kind and by document. */
  async protect(f) {
    await f.goto(`${D}?run=complydoc.json&theme=${theme}#security`);
    await f.snap(); f.hold(20);
    const found = await f.rect("High severity", "section");
    const kind = await f.rect("By kind", '[class*="rounded-xl"]') ?? (await f.rect("By kind", "div"));
    const where = await f.rect("By document", '[class*="rounded-xl"]');
    await f.glide([found[0] + 120, found[1] + 90], 24, camera(found, 30));
    f.hold(50);
    await f.glide([kind[0] + kind[2] * 0.6, kind[1] + 90], 24, camera(kind, 20));
    f.hold(60);
    if (where) { await f.glide([where[0] + where[2] * 0.5, where[1] + 90], 24, camera(where, 20)); f.hold(56); }
    f.pan(f.full, 26); f.hold(14);
  },
};
const f = await film([A, D], out, theme);
try { await scenes[scene](f); console.log(scene, theme, JSON.stringify(f.finish())); } catch (error) { f.close(); throw error; }
