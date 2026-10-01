import { expect, test } from "bun:test";
import { clientAddress } from "./net";

test("behind a proxy, the address the proxy itself added (rightmost) is used", () => {
  expect(clientAddress({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }, "10.0.0.2", true)).toBe("1.2.3.4");
});
test("a client can't pick its key by sending X-Forwarded-For", () => {
  expect(clientAddress({ "x-forwarded-for": "6.6.6.6" }, "9.9.9.9", false)).toBe("9.9.9.9");
});
test("falls back to the socket address", () => {
  expect(clientAddress({}, "9.9.9.9", true)).toBe("9.9.9.9");
  expect(clientAddress({}, undefined, false)).toBe("unknown");
});
