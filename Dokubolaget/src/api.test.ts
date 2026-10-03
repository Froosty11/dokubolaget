import { expect, test } from "bun:test";
import { errorMessage } from "./api";

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
