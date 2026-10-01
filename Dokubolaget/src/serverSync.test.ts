import { afterEach, expect, test } from "bun:test";
import { observable } from "mobx";
import { createThemeState } from "./theme/themeState";
import { boardKey } from "./progress";
import { connectToServer } from "./serverSync";

const tags = (prefix: string) => [{ id: `${prefix}1` }, { id: `${prefix}2` }, { id: `${prefix}3` }];
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function makeModel() {
  const base = {
    account: null as any,
    setAccount(account: any) {
      this.account = account;
    },
    practiceBoard: false,
    boardDate: "2026-10-01",
    boardSettled: false,
    topCategories: tags("bundledTop"),
    sideCategories: tags("bundledSide"),
    selectedProductsByCell: {} as Record<number, any>,
    missesByCell: {} as Record<number, number>,
    rejectedByCell: {} as Record<number, string[]>,
    get filledCellCount() {
      return Object.keys(this.selectedProductsByCell).length;
    },
    applyProgress(progress: any) {
      this.selectedProductsByCell = progress.selectedProductsByCell;
      this.missesByCell = progress.missesByCell;
      this.rejectedByCell = progress.rejectedByCell;
    },
  };
  return observable(Object.defineProperties(base, Object.getOwnPropertyDescriptors(createThemeState())) as any);
}

function stubServer(progressBoardKey: string) {
  const writes: any[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/api/me")) {
      return new Response(
        JSON.stringify({
          user: { id: "u", email: "a@b.se", nickname: "A" },
          prefs: { theme: null, unlockedThemes: [] },
          progress: {
            date: "2026-10-01",
            boardKey: progressBoardKey,
            data: { selectedProductsByCell: { 1: { id: "p1" }, 2: { id: "p2" } }, missesByCell: {}, rejectedByCell: {} },
          },
        }),
      );
    }
    writes.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ ok: true, prefs: { theme: "prislista", unlockedThemes: [] } }));
  }) as any;
  return writes;
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test("progress saved on another device is applied once the server's board arrives", async () => {
  const model = makeModel();
  const serverKey = boardKey({ topCategories: tags("dailyTop"), sideCategories: tags("dailySide") });
  stubServer(serverKey);
  const sync = connectToServer(model);
  await sync.refresh();
  expect(model.filledCellCount).toBe(0); // still on the bundled board
  model.topCategories = tags("dailyTop");
  model.sideCategories = tags("dailySide");
  model.boardSettled = true;
  await tick();
  expect(model.filledCellCount).toBe(2);
});

test("nothing is pushed for a board that isn't the settled daily board", async () => {
  const model = makeModel();
  const writes = stubServer("someOtherBoard");
  const sync = connectToServer(model);
  await sync.refresh();
  model.selectedProductsByCell = { 5: { id: "p5" } };
  await tick(900);
  const mine = () => writes.filter((w) => w.url.endsWith("/api/me/progress") && w.body?.data?.selectedProductsByCell?.["5"]);
  expect(mine()).toHaveLength(0);
  model.boardSettled = true;
  model.selectedProductsByCell = { 5: { id: "p5" }, 6: { id: "p6" } };
  await tick(900);
  expect(mine()).toHaveLength(1);
});
