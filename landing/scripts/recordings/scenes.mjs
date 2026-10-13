// The recordings on the landing page, one scene each.
//   node scenes.mjs <contracts viewer url> <documents viewer url> <out dir> <scene> <light|dark>
import { around, camera, centre, film, sleep } from "./film.mjs";
const [A, D, out, scene, theme] = process.argv.slice(2);
const TRACE = encodeURIComponent("trace/contracts-ingest-20261013-230504.json");
// A short label on the page, by where it is: the lowest one, or the leftmost.
const label = (text, pick) => `(() => { const all = [...document.querySelectorAll("body *")].filter((e) => { if (e.closest("#__cursor")) return false; const t = (e.innerText || "").trim(); return t.startsWith(${JSON.stringify(text)}) && t.length < 60 && e.getClientRects().length; }); if (!all.length) return null; const box = (e) => e.getBoundingClientRect(); all.sort((x, y) => ${pick === "lowest" ? "box(y).y - box(x).y" : "box(x).x - box(y).x"} || box(x).width * box(x).height - box(y).width * box(y).height); const r = box(all[0]); return [r.x, r.y, r.width, r.height]; })()`;

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
};
const f = await film([A, D], out, theme);
try { await scenes[scene](f); console.log(scene, theme, JSON.stringify(f.finish())); } catch (error) { f.close(); throw error; }
