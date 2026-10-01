import { beforeEach, describe, expect, test } from "bun:test";
import { join } from "path";
import { openDb } from "./db";
import { ApiError } from "./auth";
import { createCode, formatCode, listCodes, normalizeCode, redeemCode, revokeCode } from "./codes";
import { loadThemePacks } from "./themePacks";

let db: ReturnType<typeof openDb>;
const NOW = new Date("2026-10-01T20:00:00Z");

beforeEach(() => {
  db = openDb(":memory:");
  loadThemePacks(db, join(import.meta.dir, "fixtures", "club-themes"), () => {});
  db.run("INSERT INTO users (id, email, nickname, password_hash, created_at) VALUES ('u1', 'a@b.se', 'Anna', 'x', '2026-01-01')");
});

function errorCode(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ApiError ? `${error.status} ${error.code}` : String(error);
  }
}

describe("normalizeCode", () => {
  test("accepts the printed form, lower case and spaces alike", () => {
    const expected = normalizeCode("7KQ4-M2XR-9T");
    expect(expected).toBe("7KQ4M2XR9T");
    expect(normalizeCode("7kq4-m2xr-9t")).toBe(expected);
    expect(normalizeCode(" 7KQ4 M2XR 9T ")).toBe(expected);
  });
  test("reads O as 0 and I or L as 1", () => {
    expect(normalizeCode("OOOO-IIII-LL")).toBe("0000111111");
  });
  test("refuses letters outside the alphabet and wrong lengths", () => {
    expect(normalizeCode("UUUU-UUUU-UU")).toBeNull();
    expect(normalizeCode("7KQ4-M2XR")).toBeNull();
    expect(normalizeCode(42)).toBeNull();
  });
  test("formatCode groups 4-4-2", () => expect(formatCode("7KQ4M2XR9T")).toBe("7KQ4-M2XR-9T"));
});

describe("codes", () => {
  test("a new code unlocks its theme, and only its hash is stored", () => {
    const { code } = createCode(db, { themeId: "club-sample", label: "Poster" }, NOW);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(redeemCode(db, formatCode(code).toLowerCase(), null, NOW).themeId).toBe("club-sample");
    const dump = JSON.stringify(db.query("SELECT * FROM unlock_codes").all());
    expect(dump).not.toContain(code);
  });

  test("codes for unknown themes are refused", () => {
    expect(errorCode(() => createCode(db, { themeId: "club-ghost", label: "x" }, NOW))).toBe("400 bad_request");
  });

  test("unknown, revoked and expired codes fail with their own errors", () => {
    expect(errorCode(() => redeemCode(db, "AAAA-AAAA-AA", null, NOW))).toBe("404 invalid_code");
    const revoked = createCode(db, { themeId: "club-sample", label: "x" }, NOW);
    revokeCode(db, revoked.id, NOW);
    expect(errorCode(() => redeemCode(db, revoked.code, null, NOW))).toBe("404 invalid_code");
    const expired = createCode(db, { themeId: "club-sample", label: "x", expiresAt: "2026-10-01T19:00:00.000Z" }, NOW);
    expect(errorCode(() => redeemCode(db, expired.code, null, NOW))).toBe("410 code_expired");
  });

  test("a use limit counts logged-out scans and each logged-in player once", () => {
    const { code } = createCode(db, { themeId: "club-sample", label: "Gasque", maxUses: 2 }, NOW);
    redeemCode(db, code, "u1", NOW);
    redeemCode(db, code, "u1", NOW);
    redeemCode(db, code, null, NOW);
    expect(errorCode(() => redeemCode(db, code, null, NOW))).toBe("410 code_used_up");
    // A player who already redeemed it can still scan it again.
    expect(redeemCode(db, code, "u1", NOW).themeId).toBe("club-sample");
    expect(listCodes(db)[0].uses).toBe(2);
  });

  test("the list never shows the codes themselves", () => {
    const { code } = createCode(db, { themeId: "club-sample", label: "Poster" }, NOW);
    const listed = listCodes(db, "club-sample");
    expect(listed).toHaveLength(1);
    expect(JSON.stringify(listed)).not.toContain(code);
    expect(listed[0]).toMatchObject({ themeId: "club-sample", label: "Poster", uses: 0, revokedAt: null });
  });
});
