// Screenshots every screen in one theme, for eyeballing theme work.
//
//   node tools/themeScreens.mjs --theme prislista --out /tmp/shots/prislista [--only board,search]
//   node tools/themeScreens.mjs --compare /tmp/shots/before /tmp/shots/after --out /tmp/shots/compare.html
//
// Needs the web dev server (npx expo start --web --port 8081) and the dev
// proxy (bun run proxy). States that fill the board use the dev-only
// window.__doku handle to the reactive model.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
function flag(name, fallback = null) {
  const index = argv.indexOf(`--${name}`);
  return index === -1 ? fallback : argv[index + 1];
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (argv.includes("--compare")) {
  const index = argv.indexOf("--compare");
  const [a, b] = [argv[index + 1], argv[index + 2]];
  const out = flag("out", "/tmp/shots/compare.html");
  const names = fs.readdirSync(a).filter((f) => f.endsWith(".png")).sort();
  const rows = names.map(
    (n) =>
      `<tr><td>${n}</td><td><img src="file://${path.resolve(a, n)}"></td><td><img src="file://${path.resolve(b, n)}"></td></tr>`,
  );
  fs.writeFileSync(out, `<style>img{width:420px;border:1px solid #ccc}td{vertical-align:top;font:12px monospace}</style><table>${rows.join("")}</table>`);
  console.log(out);
  process.exit(0);
}

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// "safari" is an iPhone screen minus Mobile Safari's bars.
const VIEWPORTS = { phone: { w: 390, h: 844, mobile: true }, safari: { w: 402, h: 690, mobile: true }, laptop: { w: 1440, h: 640, mobile: false } };
const ALL_THEMES = ["prislista", "midsommar", "cyberwave", "speakeasy", "modern"];
const base = flag("base", "http://localhost:8081");
const theme = flag("theme", "modern");
const out = flag("out", `/tmp/shots/${theme}`);
const only = flag("only") ? flag("only").split(",") : null;
const viewportsWanted = flag("viewports") ? flag("viewports").split(",") : Object.keys(VIEWPORTS);
fs.mkdirSync(out, { recursive: true });

async function launch(vp, port) {
  const dir = fs.mkdtempSync("/tmp/theme-shots-");
  const chrome = spawn(
    CHROME,
    ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--window-size=${vp.w},${vp.h}`, `--user-data-dir=${dir}`, "about:blank"],
    { stdio: "ignore" },
  );
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
  const events = [];
  ws.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data.result ?? data.error);
      pending.delete(data.id);
    } else if (data.method) events.push(data);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 2, mobile: vp.mobile });
  const evaluate = async (expression) =>
    (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }))?.result?.value;
  return {
    events,
    evaluate,
    async goto(url, wait = 3500) {
      await send("Page.navigate", { url });
      await sleep(wait);
    },
    async key(key, code, keyCode) {
      for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode });
    },
    async type(text) {
      await send("Input.insertText", { text });
    },
    async clickText(text) {
      const box = await evaluate(
        `(() => { const e=[...document.querySelectorAll('body *')].find(e=>e.children.length===0&&e.textContent.trim()===${JSON.stringify(text)}&&e.getBoundingClientRect().width>0); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
      );
      if (!box) return false;
      for (const type of ["mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      return true;
    },
    async hover(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    },
    async hoverText(text) {
      const box = await evaluate(
        `(() => { const e=[...document.querySelectorAll('body *')].find(e=>e.children.length===0&&e.textContent.trim()===${JSON.stringify(text)}&&e.getBoundingClientRect().width>0); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
      );
      if (!box) return false;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
      return true;
    },
    async shot(file) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    },
    close() {
      ws.close();
      chrome.kill();
    },
  };
}

const today = new Date().toISOString().slice(0, 10);
function seed(extra = {}) {
  const values = {
    verified: "true",
    "dokubolaget.theme": theme,
    // Club themes (club-…) download from the dev API on first load.
    "dokubolaget.unlockedThemes": JSON.stringify(theme.startsWith("club-") ? [...ALL_THEMES, theme] : ALL_THEMES),
    "dokubolaget.lastHeaderReveal": today,
    ...extra,
  };
  const sets = Object.entries(values)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
    .join("");
  return `(() => { localStorage.clear(); ${sets} })()`;
}

function fakeProduct(n) {
  return {
    id: `p${n}`,
    name: `Testvin Reserva ${n}`,
    image: null,
    raw: {
      productNumber: String(7400 + n), productNameBold: `Testvin ${n}`, productNameThin: "Reserva", price: 99 + n * 10,
      categoryLevel2: "Rött vin", country: "Spanien", volumeText: "750 ml", alcoholPercentage: 13,
    },
  };
}
// Also seeds cellInfo (score, share, unicorn) for each filled cell so the
// score badges have something to show — the model only fills cellInfo via a
// real guess round-trip, which this dev-only state-seeding skips. The second
// cell gets the unicorn flag so that badge is exercised too.
function fill(cells, misses = {}) {
  return `(() => { const make = ${fakeProduct.toString()}; const m = window.__doku; const sel = {}; const info = {}; const scores = [8, 64, 100]; const cells = ${JSON.stringify(cells)}; cells.forEach((c, i) => { sel[c] = make(c); info[c] = { score: scores[i % scores.length], share: 0.12 + i * 0.1, unicorn: i === 1 }; }); m.missesByCell = ${JSON.stringify(misses)}; m.selectedProductsByCell = sel; m.cellInfo = info; })()`;
}

const STATES = {
  "age-gate": async (p) => {
    await p.evaluate(seed({ verified: null }));
    await p.goto(`${base}/`);
  },
  home: async (p) => {
    await p.evaluate(seed());
    await p.goto(`${base}/`);
  },
  login: async (p) => {
    await STATES.home(p);
    await p.clickText("Login / Sign up");
    await sleep(900);
  },
  tutorial: async (p) => {
    await p.evaluate(seed());
    await p.goto(`${base}/gameplay?board=9`, 5000);
  },
  board: async (p) => {
    await STATES.tutorial(p);
    await p.key("Escape", "Escape", 27);
    await sleep(800);
  },
  "board-filled": async (p) => {
    await STATES.board(p);
    await p.evaluate(fill([1, 5, 6], { 5: 1 }));
    await p.evaluate(
      `window.__doku.lastFeedback = { kind: "near", isCorrect: false, message: "Spain, but not Red wine.", cell: 2 }`,
    );
    await sleep(500);
  },
  search: async (p) => {
    await p.evaluate(seed());
    await p.goto(`${base}/search?cell=1`, 4000);
    await p.type("rioja");
    await sleep(5000);
  },
  complete: async (p) => {
    await STATES.board(p);
    await p.evaluate(fill([1, 2, 3, 4, 5, 6, 7, 8], { 3: 1 }));
    await sleep(300);
    await p.evaluate(fill([1, 2, 3, 4, 5, 6, 7, 8, 9], { 3: 1 }));
    await sleep(2800);
  },
  // Tap a solved cell: the revealed info sheet.
  dossier: async (p) => {
    await STATES.board(p);
    await p.evaluate(fill([1, 5, 6], {}));
    await sleep(600);
    await p.clickText("Testvin Reserva 1");
    await sleep(1200);
  },
  // Hover a search result (laptop): the classified info sheet beside the panel.
  "dossier-hidden": async (p) => {
    await STATES.search(p);
    await p.evaluate(
      `(() => { const e=[...document.querySelectorAll('[role=button]')].find(e=>/vol\.|%/.test(e.innerText)); if(!e) return; const r=e.getBoundingClientRect(); window.__hover={x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
    );
    const at = await p.evaluate("window.__hover");
    if (at) await p.hover(at.x, at.y);
    await sleep(1200);
  },
  leaderboard: async (p) => {
    await p.evaluate(seed());
    await p.goto(`${base}/leaderboard`, 6000);
  },
  themes: async (p) => {
    await p.evaluate(seed());
    await p.goto(`${base}/themes`, 3500);
  },
};

let port = 9800 + Math.floor(Math.random() * 100);
for (const vpName of viewportsWanted) {
  const vp = VIEWPORTS[vpName];
  for (const [state, run] of Object.entries(STATES)) {
    if (only && !only.includes(state)) continue;
    const page = await launch(vp, port++);
    try {
      await page.goto(`${base}/`, 2500); // the origin must be loaded before localStorage is writable
      await run(page);
      await page.shot(path.join(out, `${state}-${vpName}.png`));
      const errors = page.events
        .filter((e) => e.method === "Runtime.exceptionThrown")
        .map((e) => e.params.exceptionDetails?.exception?.description?.split("\n")[0]);
      console.log(`${state}-${vpName}${errors.length ? `  (${errors.length} exceptions: ${errors[0]})` : ""}`);
    } catch (error) {
      console.log(`${state}-${vpName} FAILED: ${error.message}`);
    } finally {
      page.close();
    }
  }
}
