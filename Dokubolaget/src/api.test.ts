import { expect, test } from "bun:test";
import { ApiRequestError, api, errorMessage } from "./api";

test("every server error code has friendly text", () => {
  for (const code of [
    "email_taken", "nickname_taken", "weak_password", "bad_nickname", "bad_email", "bad_credentials",
    "unauthorized", "forbidden_origin", "rate_limited", "not_found", "too_large", "bad_request", "invalid_token",
  ]) {
    const message = errorMessage(code);
    expect(message.length).toBeGreaterThan(5);
    expect(message).not.toContain("_");
  }
});

test("unknown codes and network failures fall back to a generic message", () => {
  expect(errorMessage("whatever")).toBe(errorMessage(undefined));
  expect(errorMessage(undefined)).toContain("try again");
});

test("play errors have friendly text", () => {
  for (const code of ["no_player", "day_over", "not_finished", "catalog_unavailable"]) {
    expect(errorMessage(code)).not.toBe(errorMessage(undefined));
  }
});

test("requests can time out (a hung call is retried, not stuck)", async () => {
  const realFetch = globalThis.fetch;
  let signal: AbortSignal | undefined;
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  }) as any;
  try {
    const error = await api.playToday().catch((e) => e);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
