// A random ID for this install, so a player who isn't logged in still gets a
// score and their picks count toward rarity. It carries no personal data.
const KEY = "dokubolaget.deviceId";
type Storage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };

function uuidV4(random: () => number): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = "4";
  hex[16] = "89ab"[Math.floor(random() * 4)];
  const s = hex.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export function createDeviceId(storage: Storage, random: () => number = Math.random) {
  let pending: Promise<string> | null = null;
  return () =>
    (pending ??= storage.getItem(KEY).then(async (stored) => {
      if (stored && /^[0-9a-f-]{36}$/.test(stored)) return stored;
      const id = uuidV4(random);
      await storage.setItem(KEY, id);
      return id;
    }));
}
