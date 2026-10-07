// Renders the 1200x630 social preview card to public/og-image.png, the image
// Discord/iMessage/Slack/etc. show when the site link is pasted. Uses headless
// Chrome via the DevTools Protocol (same approach as themeScreens.mjs) so no
// image library is needed. Re-run whenever the branding changes:
//
//   node tools/ogImage.mjs
//
// The app icon is inlined as a data URI, so the card has no external assets.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "og-image.png");
const W = 1200;
const H = 630;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const iconB64 = fs.readFileSync(path.join(root, "public", "icons", "icon-512.png")).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  .card {
    width: ${W}px; height: ${H}px; box-sizing: border-box;
    background: #f1e9d2; color: #0b3d1f;
    display: flex; align-items: center; gap: 70px; padding: 0 96px;
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    position: relative; overflow: hidden;
  }
  .icon { width: 300px; height: 300px; border-radius: 64px; box-shadow: 0 22px 55px rgba(0,0,0,.20); flex: none; }
  .title { font-size: 108px; font-weight: 800; letter-spacing: -3px; margin: 0; }
  .rule { width: 132px; height: 9px; background: #007a33; border-radius: 5px; margin: 26px 0; }
  .tag { font-size: 37px; line-height: 1.32; color: #2c3a30; margin: 0; max-width: 560px; }
  .grid { position: absolute; right: -70px; bottom: -70px; opacity: .06;
          display: grid; grid-template-columns: repeat(3, 128px); grid-auto-rows: 128px; gap: 12px; }
  .grid div { background: #007a33; border-radius: 14px; }
</style></head><body>
  <div class="card">
    <img class="icon" src="data:image/png;base64,${iconB64}" />
    <div>
      <h1 class="title">Dokubolaget</h1>
      <div class="rule"></div>
      <p class="tag">Dagens 3×3-utmaning — hitta produkter ur Systembolagets sortiment som matchar två kategorier.</p>
    </div>
    <div class="grid">${"<div></div>".repeat(9)}</div>
  </div>
</body></html>`;

const tmpHtml = path.join(fs.mkdtempSync("/tmp/og-"), "card.html");
fs.writeFileSync(tmpHtml, html);

const port = 9333;
const dir = fs.mkdtempSync("/tmp/og-chrome-");
const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--window-size=${W},${H}`, `--user-data-dir=${dir}`, "about:blank"],
  { stdio: "ignore" },
);

try {
  let targets = [];
  for (let i = 0; i < 80; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (targets.find((t) => t.type === "page")) break;
    } catch {}
    await sleep(250);
  }
  const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data.result ?? data.error);
      pending.delete(data.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `file://${tmpHtml}` });
  await sleep(1200);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  fs.writeFileSync(out, Buffer.from(shot.data, "base64"));
  ws.close();
  console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
} finally {
  chrome.kill();
}
