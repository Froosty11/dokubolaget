// Client for the container's /api. Same origin in builds; during development
// the Expo dev server (port 8081) talks to `bun run api` on port 8090.

import type { PackSummary, ThemePack } from "./theme/packSchema";
import type {
  CellAnswers,
  Period,
  GuessRequest,
  GuessResponse,
  BoardResult,
  Leaderboard,
  ArchiveDay,
  ArchiveDetail,
  UserStats,
} from "./play/types";

declare const __DEV__: boolean | undefined;

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (typeof __DEV__ !== "undefined" && __DEV__ ? "http://localhost:8090" : "");

export type Account = { id: string; email: string; nickname: string };
export type ServerPrefs = { theme: string | null; unlockedThemes: string[] };
export type ServerProgress = { date: string; boardKey: string; data: any } | null;
export type Me = { user: Account | null; prefs: ServerPrefs | null; progress: ServerProgress; stats: UserStats | null };

const MESSAGES: Record<string, string> = {
  email_taken: "There's already an account with that email. Try logging in.",
  nickname_taken: "That nickname is taken. Pick another one.",
  weak_password: "Use a password of at least 8 characters.",
  bad_nickname: "Pick a nickname of 2 to 24 characters, without @.",
  bad_email: "That doesn't look like an email address.",
  bad_credentials: "Wrong email or password.",
  unauthorized: "You're logged out. Log in again.",
  forbidden_origin: "That request was blocked. Reload the page and try again.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  not_found: "That couldn't be found.",
  too_large: "That was too much data to save.",
  bad_request: "Something was off with that request. Reload and try again.",
  invalid_token: "That reset link has expired or was already used. Ask for a new one.",
  invalid_code: "That code doesn't exist. Check the poster or scan again.",
  code_expired: "This code has expired.",
  code_used_up: "This code has been used up.",
  no_player: "Couldn't identify this device. Restart the app and try again.",
  day_over: "That board has ended. A new one started at 04:00.",
  not_finished: "Finish the board to see today's answers.",
  catalog_unavailable: "Couldn't check that bottle right now. It'll be checked when the connection is back.",
};

export function errorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong. Check your connection and try again.";
}

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string | undefined) {
    super(errorMessage(code));
  }
}

let deviceIdProvider: (() => Promise<string | null>) | null = null;
// Set once at startup (mobxReactiveModel.ts); keeps this module free of storage.
export function setDeviceIdProvider(fn: () => Promise<string | null>) {
  deviceIdProvider = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const deviceId = deviceIdProvider ? await deviceIdProvider().catch(() => null) : null;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (deviceId) headers["X-Doku-Device"] = deviceId;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, undefined);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiRequestError(response.status, data?.error);
  return data as T;
}

export const api = {
  me: () => request<Me>("GET", "/api/me"),
  signup: (email: string, password: string, nickname: string) =>
    request<{ user: Account }>("POST", "/api/auth/signup", { email, password, nickname }),
  login: (email: string, password: string) => request<{ user: Account }>("POST", "/api/auth/login", { email, password }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout", {}),
  requestReset: (email: string) => request<{ ok: true }>("POST", "/api/auth/reset-request", { email }),
  resetPassword: (token: string, password: string) => request<{ ok: true }>("POST", "/api/auth/reset", { token, password }),
  deleteAccount: (email: string, password: string) =>
    request<{ ok: true }>("POST", "/api/auth/delete-account", { email, password }),
  setNickname: (nickname: string) => request<{ user: Account }>("PATCH", "/api/me", { nickname }),
  putPrefs: (prefs: { theme: string; unlockedThemes: string[] }) =>
    request<{ prefs: ServerPrefs }>("PUT", "/api/me/prefs", prefs),
  board: async (date: string) => {
    try {
      return await request<{ rows: any[]; cols: any[]; counts?: number[]; score?: number }>("GET", `/api/boards/${date}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  },
  sbKey: () => request<{ key: string }>("GET", "/api/sb-key"),
  config: () => request<{ supportUrl: string | null; contactEmail: string | null }>("GET", "/api/config"),
  scan: (code: string) => request<{ themeId: string; summary: PackSummary | null }>("POST", "/api/scan", { code }),
  themes: () => request<{ themes: PackSummary[] }>("GET", "/api/themes"),
  theme: (id: string) => request<ThemePack>("GET", `/api/themes/${encodeURIComponent(id)}`),
  // Logo paths from the server are relative; in development the API runs on
  // another port.
  logoUrl: (summary: { logoUrl: string | null }) => (summary.logoUrl ? `${API_BASE}${summary.logoUrl}` : null),
  guess: (g: GuessRequest) => request<GuessResponse>("POST", "/api/play/guess", g),
  playToday: () => request<BoardResult>("GET", "/api/play/today"),
  answers: (day: string) => request<{ answers: CellAnswers[] }>("GET", `/api/play/answers?day=${encodeURIComponent(day)}`),
  claim: () => request<{ board: BoardResult; newUnlocks: string[] }>("POST", "/api/play/claim", {}),
  leaderboard: (period: Period) => request<Leaderboard>("GET", `/api/leaderboard?period=${period}`),
  archiveMonth: (month: string) => request<{ days: ArchiveDay[] }>("GET", `/api/archive?month=${encodeURIComponent(month)}`),
  archiveDay: (day: string) => request<ArchiveDetail>("GET", `/api/archive/${encodeURIComponent(day)}`),
};
