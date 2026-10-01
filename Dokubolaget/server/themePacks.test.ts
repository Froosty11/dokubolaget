import { beforeEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { openDb } from "./db";
import { makePng } from "./fixtures/png";
import { imageInfo } from "./imageInfo";
import { checkThemeFolder, getLogo, getPack, knownClubIds, listPacks, loadThemePacks, setHidden } from "./themePacks";

const FIXTURES = join(import.meta.dir, "fixtures", "club-themes");
let db: ReturnType<typeof openDb>;
let dir: string;
const quiet = () => {};

function editTheme(mutate: (theme: any) => void) {
  const path = join(dir, "sample", "theme.json");
  const theme = JSON.parse(readFileSync(path, "utf8"));
  mutate(theme);
  writeFileSync(path, JSON.stringify(theme));
}

beforeEach(() => {
  db = openDb(":memory:");
  dir = mkdtempSync(join(tmpdir(), "club-themes-"));
  cpSync(FIXTURES, dir, { recursive: true });
});

describe("imageInfo", () => {
  test("reads PNG size", () => expect(imageInfo(makePng(64, 32))).toEqual({ type: "image/png", width: 64, height: 32 }));
  test("refuses SVG and junk", () => {
    expect(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(imageInfo(Buffer.from([1, 2, 3]))).toBeNull();
  });
  test("reads a lossless WebP header", () => {
    // RIFF....WEBPVP8L + size + signature 0x2f + 14-bit (w-1), 14-bit (h-1)
    const w = 300, h = 120;
    const bits = (w - 1) | ((h - 1) << 14);
    const buf = Buffer.alloc(30);
    buf.write("RIFF", 0); buf.write("WEBP", 8); buf.write("VP8L", 12);
    buf[20] = 0x2f;
    buf.writeUInt32LE(bits >>> 0, 21);
    expect(imageInfo(buf)).toEqual({ type: "image/webp", width: w, height: h });
  });
});

describe("loadThemePacks", () => {
  test("stores a valid club theme with its logo", () => {
    const result = loadThemePacks(db, dir, quiet);
    expect(result.loaded).toEqual(["club-sample"]);
    expect(getPack(db, "club-sample")?.club.venue).toBe("Testpuben");
    expect(getLogo(db, "club-sample")?.type).toBe("image/png");
  });

  test("leaves the same version alone and replaces it with a newer one", () => {
    loadThemePacks(db, dir, quiet);
    expect(loadThemePacks(db, dir, quiet).skipped).toEqual(["club-sample"]);
    editTheme((t) => {
      t.version = 2;
      t.club.venue = "Nya puben";
    });
    expect(loadThemePacks(db, dir, quiet).loaded).toEqual(["club-sample"]);
    expect(getPack(db, "club-sample")?.club.venue).toBe("Nya puben");
  });

  test("a broken file is reported and the stored version stays", () => {
    loadThemePacks(db, dir, quiet);
    editTheme((t) => {
      t.version = 2;
      t.fontKit = "comic";
    });
    const result = loadThemePacks(db, dir, quiet);
    expect(result.errors["sample"].join()).toContain("fontKit");
    expect(getPack(db, "club-sample")?.version).toBe(1);
  });

  test.each([
    ["too wide", () => makePng(2000, 10), "over 1024 px"],
    ["too heavy", () => makePng(400, 400, true), "300 KB"],
    ["an SVG", () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "PNG or WebP"],
  ])("rejects a logo file that is %s", (_name, make, message) => {
    writeFileSync(join(dir, "sample", "logo.png"), make());
    expect(checkThemeFolder(join(dir, "sample")).errors.join("\n")).toContain(message);
  });

  test("the logo size in theme.json must match the file", () => {
    editTheme((t) => (t.logo = { width: 32, height: 64 }));
    expect(checkThemeFolder(join(dir, "sample")).errors.join("\n")).toContain("logo");
  });

  test("a theme without a logo file needs logo: null", () => {
    rmSync(join(dir, "sample", "logo.png"));
    expect(checkThemeFolder(join(dir, "sample")).errors.join("\n")).toContain("logo");
    editTheme((t) => (t.logo = null));
    expect(checkThemeFolder(join(dir, "sample")).errors).toEqual([]);
  });

  test("the folder name must match the id", () => {
    renameSync(join(dir, "sample"), join(dir, "other"));
    expect(loadThemePacks(db, dir, quiet).errors["other"].join()).toContain("folder");
  });

  test("hidden themes leave the list but can still be fetched", () => {
    loadThemePacks(db, dir, quiet);
    expect(listPacks(db).map((p) => p.id)).toEqual(["club-sample"]);
    expect(listPacks(db)[0].logoUrl).toBe("/api/themes/club-sample/logo?v=1");
    setHidden(db, "club-sample", true);
    expect(listPacks(db)).toEqual([]);
    expect(getPack(db, "club-sample")).not.toBeNull();
    expect(knownClubIds(db).has("club-sample")).toBe(true);
  });

  test("a missing folder loads nothing without throwing", () => {
    expect(loadThemePacks(db, join(dir, "nope"), quiet).loaded).toEqual([]);
  });
});

describe("the club themes in club-themes/", () => {
  const CLUB_DIR = join(import.meta.dir, "..", "..", "club-themes");
  const folders = readdirSync(CLUB_DIR).filter((name) => statSync(join(CLUB_DIR, name)).isDirectory());
  test("there are club themes to check", () => expect(folders.length).toBeGreaterThan(0));
  test.each(folders)("%s passes every check", (folder) => {
    expect(checkThemeFolder(join(CLUB_DIR, folder)).errors).toEqual([]);
  });
});
