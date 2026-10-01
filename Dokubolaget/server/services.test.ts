import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb } from "./db";
import { createSbKey, parseApiKey, parseBundlePaths } from "./sbKey";
import { backupDb } from "./backup";
import { createMailer } from "./mail";

describe("Systembolaget key", () => {
  const html = `<html><script src="/_next/static/chunks/a.js"></script><script src="/_next/static/chunks/b.js"></script></html>`;
  const fetchStub = (calls: string[]) => async (url: string) => {
    calls.push(url);
    if (url.endsWith("/")) return new Response(html);
    if (url.endsWith("b.js")) return new Response(`x={NEXT_PUBLIC_API_KEY_APIM:"8d39aaaaaaaaaaaaaaaaaaaaaaaaaaaa"}`);
    return new Response("nothing here");
  };

  test("parses bundle paths and the key", () => {
    expect(parseBundlePaths(html)).toEqual(["/_next/static/chunks/a.js", "/_next/static/chunks/b.js"]);
    expect(parseApiKey(`NEXT_PUBLIC_API_KEY_APIM: "k123"`)).toBe("k123");
    expect(parseApiKey("nope")).toBeNull();
  });
  test("scrapes once and serves from cache for 12 hours", async () => {
    const db = openDb(":memory:");
    const calls: string[] = [];
    let now = new Date("2026-10-01T00:00:00Z");
    const key = createSbKey(db, fetchStub(calls) as any, () => now);
    expect(await key.get()).toBe("8d39aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const scrapes = calls.length;
    expect(await key.get()).toBe("8d39aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(calls.length).toBe(scrapes);
    now = new Date("2026-10-01T13:00:00Z");
    await key.get();
    expect(calls.length).toBeGreaterThan(scrapes);
  });
});

describe("backups", () => {
  test("writes a dated copy and keeps the newest 7", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doku-backup-"));
    const file = path.join(dir, "db.sqlite");
    const db = openDb(file);
    for (let day = 1; day <= 9; day++) backupDb(db, path.join(dir, "backups"), `2026-10-0${day}`);
    const files = fs.readdirSync(path.join(dir, "backups")).sort();
    expect(files).toHaveLength(7);
    expect(files[0]).toBe("dokubolaget-2026-10-03.sqlite");
    const copy = openDb(path.join(dir, "backups", files[6]));
    expect((copy.query("SELECT COUNT(*) AS c FROM schema_version").get() as any).c).toBeGreaterThan(0);
  });
});

describe("mailer", () => {
  test("without SMTP the reset link goes to the log", async () => {
    const lines: string[] = [];
    const mailer = createMailer({}, (line) => lines.push(line));
    await mailer.sendReset("a@b.se", "https://x/reset-password?token=t");
    expect(lines.join("\n")).toContain("https://x/reset-password?token=t");
  });
});
