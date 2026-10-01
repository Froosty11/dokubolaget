import { beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runAdmin } from "../scripts/admin";
import { redeemCode } from "./codes";
import { openDb } from "./db";
import { ApiError } from "./auth";

const CLUB_DIR = join(import.meta.dir, "fixtures", "club-themes");
let db: ReturnType<typeof openDb>;
let lines: string[];
let qrDir: string;

const run = (...argv: string[]) => runAdmin(argv, { db, out: (line) => lines.push(line), clubDir: CLUB_DIR, qrDir, publicUrl: "https://dokubolaget.se" });
const output = () => lines.join("\n");

beforeEach(() => {
  db = openDb(":memory:");
  lines = [];
  qrDir = mkdtempSync(join(tmpdir(), "qr-"));
});

describe("admin", () => {
  test("themes check passes on the sample folder", async () => {
    expect(await run("themes", "check")).toBe(0);
    expect(output()).toContain("club-sample");
  });

  test("codes create prints a working link and writes a QR image", async () => {
    await run("themes", "load");
    expect(await run("codes", "create", "club-sample", "--label", "Bar poster")).toBe(0);
    const link = output().match(/https:\/\/dokubolaget\.se\/scan\/([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2})/);
    expect(link).not.toBeNull();
    expect(redeemCode(db, link![1], null).themeId).toBe("club-sample");
    const svg = readdirSync(qrDir).find((name) => name.endsWith(".svg"))!;
    expect(readFileSync(join(qrDir, svg), "utf8").startsWith("<svg")).toBe(true);
  });

  test("codes list leaves the code out, and revoke stops it working", async () => {
    await run("themes", "load");
    await run("codes", "create", "club-sample", "--label", "Poster", "--max-uses", "5", "--expires", "2099-01-01T00:00:00Z");
    const code = output().match(/\/scan\/(\S+)/)![1];
    lines = [];
    expect(await run("codes", "list")).toBe(0);
    expect(output()).toContain("Poster");
    expect(output()).not.toContain(code);
    expect(await run("codes", "revoke", "1")).toBe(0);
    expect(() => redeemCode(db, code, null)).toThrow(ApiError);
  });

  test("themes hide and show", async () => {
    await run("themes", "load");
    expect(await run("themes", "hide", "club-sample")).toBe(0);
    lines = [];
    await run("themes", "list");
    expect(output()).toContain("hidden");
    expect(await run("themes", "show", "club-sample")).toBe(0);
  });

  test("refuses to make codes without a public address", async () => {
    await run("themes", "load");
    const code = await runAdmin(["codes", "create", "club-sample", "--label", "x"], { db, out: (l) => lines.push(l), clubDir: CLUB_DIR, qrDir, publicUrl: null });
    expect(code).toBe(1);
    expect(output()).toContain("PUBLIC_URL");
  });

  test("an unknown command prints usage", async () => {
    expect(await run("nope")).toBe(2);
    expect(output()).toContain("Usage");
  });
});
