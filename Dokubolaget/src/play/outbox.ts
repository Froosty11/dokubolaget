// Guesses waiting to reach the server, saved on the device so a lost
// connection, a reload or a closed app doesn't lose them. Sent in order.
export type OutboxItem = { id: string; day: string; cell: number; productNumber: string; practice: boolean };
type Storage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isItem(value: any): value is OutboxItem {
  return value && typeof value.id === "string" && typeof value.day === "string" && Number.isInteger(value.cell)
    && typeof value.productNumber === "string" && typeof value.practice === "boolean";
}

export function createOutbox(storage: Storage, key = "dokubolaget.outbox") {
  let list: OutboxItem[] = [];
  const save = () => storage.setItem(key, JSON.stringify(list)).catch(() => {});

  return {
    async load() {
      try {
        const parsed = JSON.parse((await storage.getItem(key)) ?? "[]");
        list = Array.isArray(parsed) ? parsed.filter(isItem) : [];
      } catch {
        list = [];
      }
    },
    async add(item: Omit<OutboxItem, "id">) {
      const full = { ...item, id: newId() };
      list = [...list, full];
      await save();
      return full;
    },
    async remove(id: string) {
      list = list.filter((item) => item.id !== id);
      await save();
    },
    items: () => list,
    async dropEndedDays(today: string) {
      const before = list.length;
      list = list.filter((item) => item.practice || item.day === today);
      if (list.length !== before) await save();
      return before - list.length;
    },
    pendingFor: (day: string, cell: number, practice: boolean) =>
      list.some((item) => item.day === day && item.cell === cell && item.practice === practice),
  };
}

export type Outbox = ReturnType<typeof createOutbox>;

export async function flushOutbox(outbox: Outbox, send: (item: OutboxItem) => Promise<"done" | "retry" | "drop">) {
  for (const item of [...outbox.items()]) {
    const result = await send(item);
    if (result === "retry") return "stopped" as const;
    await outbox.remove(item.id);
  }
  return "empty" as const;
}
