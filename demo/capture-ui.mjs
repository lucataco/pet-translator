// Drives the real app (cf dev on :5173) and screenshots the result screen.
import { chromium } from "playwright-core";

const want = process.argv[2] ?? "THROW IT";
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));

await page.goto("http://localhost:5173/");
await page.screenshot({ path: "ui/01-landing.png" });

await page.click('[data-tab="upload"]');
await page.setInputFiles("#file", "seg/ball.mp4");
await page.waitForFunction(() => !document.querySelector("#go").disabled);
await page.screenshot({ path: "ui/02-ready.png" });

await page.click("#go");
await page.waitForTimeout(300);
await page.screenshot({ path: "ui/03-loading.png" });
await page.waitForSelector("#result:not([hidden])", { timeout: 60000 });

for (let i = 0; i < 300; i++) {
  const t = await page.textContent("#subtitle");
  if (t.includes(want) && t.trim().endsWith("PROBABLY.")) break;
  await page.click("#reroll");
}
await page.evaluate(() => { const v = document.querySelector("#playback"); v.pause(); v.currentTime = 4.2; v.controls = false; });
await page.waitForTimeout(1500);
await page.evaluate(() => window.scrollTo(0, document.querySelector("#result").offsetTop - 8));
await page.waitForTimeout(400);
await page.screenshot({ path: "ui/04-result.png" });
await page.locator("#result").screenshot({ path: "ui/05-result-card.png" });
console.log("stats:", (await page.textContent("#stats")).replace(/\s+/g, " "));
console.log("subtitle:", await page.textContent("#subtitle"));
await browser.close();
