// Renders transparent overlay PNG sequences for each scene from the REAL Clef-omni results.
// usage: node render.mjs [sceneId] [--preview t]
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { buildCaption, NEED_LABELS, VOCAL_LABELS } from "../web/captions.js";

const FPS = 30;
const load = (id) => JSON.parse(fs.readFileSync(`results/${id}.json`, "utf8"));
const PRICE = 0.15 / 1e6;

function clip(id, { name = "", seed, headline, hook, hookUntil, heard, saw, credit, dur }) {
  const r = load(id);
  const a = r.answers;
  const cap = buildCaption(a, { name, seed });
  const bars = Object.entries(a.need.probabilities)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 3)
    .map(([k, p]) => ({ label: NEED_LABELS[k], p }));
  return {
    id, type: "clip", dur, headline, hook, hookUntil, bars, credit,
    speaker: cap.speaker, caption: cap.text,
    heard: heard(a), saw: saw(a),
    tokens: r.usage.input_tokens,
    cost: `$${(r.usage.input_tokens * PRICE).toFixed(4)}`,
  };
}
const pct = (p) => `${Math.round(p * 100)}%`;
const vocal = (a) => [VOCAL_LABELS[a.vocalization.choice], pct(a.vocalization.probabilities[a.vocalization.choice])];

export const SCENES = [
  clip("ball", {
    seed: 15, dur: 8,
    hook: "I built an AI that<br/>translates your <em>pet</em>.", hookUntil: 3.4,
    headline: "What is this dog <em>saying</em>?",
    heard: vocal, saw: (a) => ["Toy in sight", pct(a.toy_visible.noul)],
    credit: "Video: Koka show (CC BY)",
  }),
  clip("fitz", {
    name: "Fitz", seed: 3, dur: 8,
    headline: "Fitz, while she's <em>reading</em>:",
    heard: (a) => ["No barking", pct(a.vocalization.probabilities.silent)],
    saw: (a) => ["Drama", a.drama.legend[String(Math.round(a.drama.score))]],
    credit: "Video: AMomWithDogs (CC BY)",
  }),
  clip("cat", {
    seed: 1, dur: 8,
    headline: "And the <em>cat</em>?",
    heard: vocal, saw: (a) => ["Window in sight", pct(a.door_or_leash_visible.noul)],
    credit: "Video: Axéra (CC BY)",
  }),
  {
    id: "outro", type: "outro", dur: 5,
    ui: "ui/04-result.png",
    credits: "Clips (CC BY) from YouTube: Koka show · AMomWithDogs · Axéra. Real model outputs, captions picked from our line bank.",
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : null;
  const previewIdx = process.argv.indexOf("--preview");
  const preview = previewIdx > -1 ? process.argv.slice(previewIdx + 1).map(Number) : null;

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.resolve("overlay.html")}`);
  fs.writeFileSync("scenes.json", JSON.stringify(SCENES, null, 2));

  for (const s of SCENES) {
    if (only && s.id !== only) continue;
    const dir = preview ? "preview" : `frames/${s.id}`;
    fs.mkdirSync(dir, { recursive: true });
    const times = preview ?? Array.from({ length: Math.round(s.dur * FPS) }, (_, i) => i / FPS);
    for (let i = 0; i < times.length; i++) {
      await page.evaluate(([scene, t]) => window.renderFrame(scene, t), [s, times[i]]);
      if (i === 0) await page.evaluate(() => Promise.all([...document.images].map((im) => im.decode().catch(() => {}))));
      const file = preview ? `${dir}/${s.id}-${times[i]}.png` : `${dir}/${String(i).padStart(4, "0")}.png`;
      await page.screenshot({ path: file, omitBackground: true });
    }
    console.log(`${s.id}: ${times.length} frames -> ${dir}`);
  }
  await browser.close();
}
