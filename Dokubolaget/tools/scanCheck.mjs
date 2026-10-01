// End-to-end check of scanning a club theme code in headless Chrome.
// Needs the web dev server (port 8081) and the dev API (`bun run api`, port
// 8090) with the sample club theme loaded:
//   CLUB_THEMES_DIR=server/fixtures/club-themes bun run api
//   node tools/scanCheck.mjs
import { execFileSync, spawn } from "node:child_process";

const BASE = process.env.APP_URL || "http://localhost:8081";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function browser(port) {
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/scancheck-${port}-${Date.now()}`, "about:blank",
  ], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
    } catch {}
    if (!target) await sleep(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const send = (method, params = {}) => new Promise((resolve) => {
    const callId = ++id;
    const onMessage = (m) => {
      const data = JSON.parse(m.data);
      if (data.id === callId) {
        ws.removeEventListener("message", onMessage);
        resolve(data.result);
      }
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id: callId, method, params }));
  });
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
  const click = async (text) => {
    const box = await ev(`(() => { const e=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0&&e.textContent.trim()===${JSON.stringify(text)}&&e.getBoundingClientRect().width>0).pop(); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    if (!box) return false;
    for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
    return true;
  };
  const text = () => ev("document.body.innerText");
  const waitFor = async (needle, ms = 15000) => {
    for (let t = 0; t < ms; t += 250) {
      if ((await text())?.toLowerCase().includes(needle.toLowerCase())) return true;
      await sleep(250);
    }
    return false;
  };
  return { send, ev, click, text, waitFor, close: () => chrome.kill(), goto: (url) => send("Page.navigate", { url }) };
}

const created = execFileSync("bun", ["scripts/admin.ts", "codes", "create", "club-sample", "--label", "scanCheck"], {
  env: { ...process.env, PUBLIC_URL: BASE }, encoding: "utf8",
});
const link = created.match(/link: (\S+)/)?.[1];
check("admin script made a link", Boolean(link), link);

const A = await browser(9661);
await A.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
// A brand new visitor: the first page they ever load is the scan link.
await A.goto(link);
check("the ID check comes first", await A.waitFor("can we ask for ID"));
await A.click("I have turned 20");
check("the unlock moment shows", await A.waitFor("Stamp collected"));
// Before touching anything: the unlock is already saved on the device.
const saved = await A.ev(`localStorage.getItem("dokubolaget.unlockedThemes")`);
check("the unlock is saved before any tap", String(saved).includes("club-sample"), saved);
await A.click("Wear it now");
await sleep(1500);
await A.goto(`${BASE}/`);
await sleep(6000);
check("the club theme is active after a reload", (await A.ev("window.__doku.activeThemeId")) === "club-sample");
await A.goto(`${BASE}/scan/AAAA-AAAA-AA`);
check("a made-up code is refused", await A.waitFor("That code doesn't exist"));
A.close();
console.log(failures ? `${failures} failed` : "all passed");
process.exit(failures ? 1 : 0);
