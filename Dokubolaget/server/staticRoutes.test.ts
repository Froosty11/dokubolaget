import { beforeEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveStaticFile } from "./staticRoutes";

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), "dist-"));
  for (const file of ["index.html", "stamps.html", "scan/[code].html", "_expo/app.js"]) {
    mkdirSync(join(dist, file, ".."), { recursive: true });
    writeFileSync(join(dist, file), file);
  }
});

test("files and .html pages are served as they are", () => {
  expect(resolveStaticFile(dist, "/_expo/app.js")).toBe(join(dist, "_expo/app.js"));
  expect(resolveStaticFile(dist, "/stamps")).toBe(join(dist, "stamps.html"));
  expect(resolveStaticFile(dist, "/")).toBe(join(dist, "index.html"));
});

test("a scan link gets the scan page, not Home", () => {
  expect(resolveStaticFile(dist, "/scan/7KQ4-M2XR-9T")).toBe(join(dist, "scan/[code].html"));
});

test("unknown routes fall back to the shell, and escapes are refused", () => {
  expect(resolveStaticFile(dist, "/nope/deeper")).toBe(join(dist, "index.html"));
  expect(resolveStaticFile(dist, "/../etc/passwd")).not.toContain("passwd");
  expect(resolveStaticFile(dist, "/%E0%A4%A")).toBeNull();
});
