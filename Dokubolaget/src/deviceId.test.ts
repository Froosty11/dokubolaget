import { expect, test } from "bun:test";
import { createDeviceId } from "./deviceId";

function memory() {
  const data = new Map<string, string>();
  return { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
}

test("creates a UUID v4 once and keeps it", async () => {
  const storage = memory();
  const getId = createDeviceId(storage);
  const first = await getId();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(await getId()).toBe(first);
  expect(await createDeviceId(storage)()).toBe(first);
});
