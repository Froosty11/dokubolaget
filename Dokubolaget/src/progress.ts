// Today's board progress, saved on the device so a reload or an app switch
// doesn't wipe the board. Tied to the date and the exact board, so a new day
// or a different board starts fresh.

export type BoardProgress = {
  selectedProductsByCell: Record<number, any>;
  missesByCell: Record<number, number>;
  rejectedByCell: Record<number, string[]>;
};

type BoardHeaders = { topCategories: Array<{ id: string }>; sideCategories: Array<{ id: string }> };

export function boardKey(board: BoardHeaders): string {
  return [...board.topCategories, ...board.sideCategories].map((tag) => tag?.id ?? "").join("|");
}

export function serializeProgress(date: string, board: string, progress: BoardProgress): string {
  return JSON.stringify({ date, board, ...progress });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function restoreProgress(raw: unknown, date: string, board: string): BoardProgress | null {
  if (typeof raw !== "string") return null;
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.date !== date || data.board !== board) return null;
  if (!isRecord(data.selectedProductsByCell) || !isRecord(data.missesByCell) || !isRecord(data.rejectedByCell)) return null;
  return {
    selectedProductsByCell: data.selectedProductsByCell as Record<number, any>,
    missesByCell: data.missesByCell as Record<number, number>,
    rejectedByCell: data.rejectedByCell as Record<number, string[]>,
  };
}
