// Client for the container's /api. Same origin in builds; during development
// the Expo dev server (port 8081) talks to `bun run api` on port 8090.

declare const __DEV__: boolean | undefined;

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ??
  (typeof __DEV__ !== "undefined" && __DEV__ ? "http://localhost:8090" : "");

export type Account = { id: string; email: string; nickname: string };
export type ServerPrefs = { theme: string | null; unlockedThemes: string[] };
export type ServerProgress = { date: string; boardKey: string; data: any } | null;
export type Me = { user: Account | null; prefs: ServerPrefs | null; progress: ServerProgress };

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
};

export function errorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || "Something went wrong. Check your connection and try again.";
}

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string | undefined) {
    super(errorMessage(code));
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
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
  putProgress: (progress: { date: string; boardKey: string; data: unknown }) =>
    request<{ ok: true }>("PUT", "/api/me/progress", progress),
  board: async (date: string) => {
    try {
      return await request<{ rows: any[]; cols: any[]; counts?: number[]; score?: number }>("GET", `/api/boards/${date}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  },
  sbKey: () => request<{ key: string }>("GET", "/api/sb-key"),
  leaderboard: () => request<{ rows: Array<{ nickname: string; score: number }> }>("GET", "/api/leaderboard"),
};
