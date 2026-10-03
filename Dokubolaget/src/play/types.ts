// Shapes returned by the play, Hi-score and archive API (server/play.ts, server/stats.ts).
export type CellResult = {
  cell: number; productNumber: string | null; product: Record<string, any> | null;
  misses: number; score: number | null; share: number | null; unicorn: boolean;
};
export type BoardResult = {
  day: string; cells: CellResult[]; score: number; solved: number; misses: number;
  unicorns: number; finished: boolean; perfect: boolean;
};
export type GuessRequest = { id: string; day: string; cell: number; productNumber: string; practice: boolean };
export type GuessResponse = {
  verdict: "correct" | "near" | "miss" | "rejected"; reason?: "already_used" | "not_playable";
  usedInCell?: number; matchedTagId?: string; cell: CellResult; board: BoardResult; newUnlocks: string[];
};
export type CellAnswers = {
  cell: number; solvedShare: number;
  top: Array<{ productNumber: string; name: string; share: number }>;
  rarest: { productNumber: string; name: string; share: number } | null;
  mine: string | null;
};
export type Period = "today" | "yesterday" | "week" | "all" | "streak";
export type LeaderRow = { rank: number; nickname: string; value: number; longest?: number };
export type Leaderboard = { period: Period; provisional: boolean; rows: LeaderRow[]; me: LeaderRow | null };
export type UserStats = { currentStreak: number; longestStreak: number; finishedCount: number; unicorns: number };
export type ArchiveDay = { day: string; result: { score: number; solved: number; finished: boolean; perfect: boolean } | null };
export type ArchiveDetail = {
  day: string; board: { rows: any[]; cols: any[] }; mine: BoardResult; practice: BoardResult; answers: CellAnswers[];
};
