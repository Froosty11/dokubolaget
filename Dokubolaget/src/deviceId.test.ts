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

test("a stored malformed value of 36 dashes is replaced by a valid v4 id", async () => {
  const storage = memory();
  await storage.setItem("dokubolaget.deviceId", "------------------------------------");
  const getId = createDeviceId(storage);
  const id = await getId();
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  // Verify it was stored
  expect(await storage.getItem("dokubolaget.deviceId")).toBe(id);
});

test("a storage whose getItem rejects once then works: first getId() rejects, second resolves to a valid id", async () => {
  let callCount = 0;
  const storage = {
    getItem: async (k: string) => {
      callCount++;
      if (callCount === 1) throw new Error("Storage error");
      return null;
    },
    setItem: async (k: string, v: string) => {},
  };
  const getId = createDeviceId(storage);
  try {
    await getId();
    expect.unreachable();
  } catch (e) {
    expect((e as Error).message).toBe("Storage error");
  }
  // Second call should retry
  const id = await getId();
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
