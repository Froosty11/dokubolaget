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
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return () => {
    if (!pending) {
      pending = (async () => {
        try {
          const stored = await storage.getItem(KEY);
          if (stored && uuidV4Regex.test(stored)) return stored;
          const id = uuidV4(random);
          await storage.setItem(KEY, id);
          return id;
        } catch (error) {
          pending = null;
          throw error;
        }
      })();
    }
    return pending;
  };
}
