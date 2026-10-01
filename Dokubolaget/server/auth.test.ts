import { describe, expect, test } from "bun:test";
import { openDb } from "./db";
import {
  ApiError, RateLimiter, createResetToken, login, logout, resetPassword, sessionUser, setNickname, signup,
} from "./auth";

const fresh = () => openDb(":memory:");
const good = { email: "Anna@Example.se", password: "hemligt123", nickname: "Anna" };

async function code(fn: () => Promise<unknown> | unknown) {
  try {
    await fn();
  } catch (error) {
    return error instanceof ApiError ? error.code : String(error);
  }
  return "no error";
}

describe("signup", () => {
  test("creates a user and a session", async () => {
    const db = fresh();
    const { userId, token } = await signup(db, good);
    expect(userId).toBeTruthy();
    expect(sessionUser(db, token)?.nickname).toBe("Anna");
    expect(sessionUser(db, token)?.email).toBe("anna@example.se");
  });
  test("rejects a duplicate email in any case", async () => {
    const db = fresh();
    await signup(db, good);
    expect(await code(() => signup(db, { ...good, email: "ANNA@example.SE", nickname: "Other" }))).toBe("email_taken");
  });
  test("rejects a duplicate nickname in any case", async () => {
    const db = fresh();
    await signup(db, good);
    expect(await code(() => signup(db, { ...good, email: "b@x.se", nickname: "anna" }))).toBe("nickname_taken");
  });
  test("validates input", async () => {
    const db = fresh();
    expect(await code(() => signup(db, { ...good, password: "short" }))).toBe("weak_password");
    expect(await code(() => signup(db, { ...good, nickname: "a@b" }))).toBe("bad_nickname");
    expect(await code(() => signup(db, { ...good, nickname: "x" }))).toBe("bad_nickname");
    expect(await code(() => signup(db, { ...good, email: "not-an-email" }))).toBe("bad_email");
  });
  test("never stores the password or the raw token", async () => {
    const db = fresh();
    const { token } = await signup(db, good);
    const user = db.query("SELECT password_hash FROM users").get() as any;
    expect(user.password_hash).not.toContain("hemligt123");
    expect((db.query("SELECT token_hash FROM sessions").get() as any).token_hash).not.toBe(token);
  });
});

describe("login and sessions", () => {
  test("logs in with any email case", async () => {
    const db = fresh();
    await signup(db, good);
    const { token } = await login(db, { email: "anna@EXAMPLE.se", password: "hemligt123" });
    expect(sessionUser(db, token)?.nickname).toBe("Anna");
  });
  test("wrong password and unknown email look the same", async () => {
    const db = fresh();
    await signup(db, good);
    expect(await code(() => login(db, { email: good.email, password: "wrongwrong" }))).toBe("bad_credentials");
    expect(await code(() => login(db, { email: "nobody@x.se", password: "wrongwrong" }))).toBe("bad_credentials");
  });
  test("expired sessions are rejected and removed", async () => {
    const db = fresh();
    const { token } = await signup(db, good);
    db.run("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'");
    expect(sessionUser(db, token)).toBeNull();
    expect((db.query("SELECT COUNT(*) AS c FROM sessions").get() as any).c).toBe(0);
  });
  test("logout ends the session", async () => {
    const db = fresh();
    const { token } = await signup(db, good);
    logout(db, token);
    expect(sessionUser(db, token)).toBeNull();
  });
  test("unknown tokens are null", () => {
    expect(sessionUser(fresh(), "nope")).toBeNull();
  });
});

describe("password reset", () => {
  test("works once and ends other sessions", async () => {
    const db = fresh();
    const { token: oldSession } = await signup(db, good);
    const reset = createResetToken(db, "ANNA@example.se");
    expect(reset).not.toBeNull();
    await resetPassword(db, reset!.token, "nyttlosen456");
    expect(sessionUser(db, oldSession)).toBeNull();
    expect(await code(() => resetPassword(db, reset!.token, "annatlosen789"))).toBe("invalid_token");
    const { token } = await login(db, { email: good.email, password: "nyttlosen456" });
    expect(sessionUser(db, token)).not.toBeNull();
  });
  test("unknown email gives no token", () => {
    expect(createResetToken(fresh(), "nobody@x.se")).toBeNull();
  });
  test("expired tokens are rejected", async () => {
    const db = fresh();
    await signup(db, good);
    const reset = createResetToken(db, good.email)!;
    db.run("UPDATE password_resets SET expires_at = '2000-01-01T00:00:00.000Z'");
    expect(await code(() => resetPassword(db, reset.token, "nyttlosen456"))).toBe("invalid_token");
  });
  test("new password must be strong", async () => {
    const db = fresh();
    await signup(db, good);
    const reset = createResetToken(db, good.email)!;
    expect(await code(() => resetPassword(db, reset.token, "short"))).toBe("weak_password");
  });
});

describe("nickname changes", () => {
  test("validated and unique", async () => {
    const db = fresh();
    const a = await signup(db, good);
    await signup(db, { email: "b@x.se", password: "hemligt123", nickname: "Bertil" });
    expect(await code(() => setNickname(db, a.userId, "BERTIL"))).toBe("nickname_taken");
    expect(await code(() => setNickname(db, a.userId, "me@mail"))).toBe("bad_nickname");
    setNickname(db, a.userId, "Annika");
    expect(sessionUser(db, a.token)?.nickname).toBe("Annika");
  });
});

describe("RateLimiter", () => {
  test("allows up to the limit inside the window", () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < 3; i++) expect(limiter.hit("k", 3, 1000)).toBe(true);
    expect(limiter.hit("k", 3, 1000)).toBe(false);
    now = 1001;
    expect(limiter.hit("k", 3, 1000)).toBe(true);
  });
});
