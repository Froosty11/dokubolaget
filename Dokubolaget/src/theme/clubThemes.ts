// Club themes on the device: cached files, turned into normal themes and
// registered, so every screen keeps using useTheme() unchanged.
import { FONT_KIT_FONTS } from "./fontKits";
import { CLUB_THEME_ID, validatePack, type ClubThemeId, type PackSummary, type ThemePack } from "./packSchema";
import type { Theme, ThemeId } from "./types";

export const PACKS_KEY = "dokubolaget.themePacks";
export const SUMMARIES_KEY = "dokubolaget.clubThemeSummaries";

export function packToTheme(pack: ThemePack): Theme {
  return {
    id: pack.id,
    dark: pack.dark,
    colors: pack.colors,
    fonts: FONT_KIT_FONTS[pack.fontKit],
    radii: pack.radii,
    typeScale: pack.typeScale,
    borders: pack.borders,
    glow: pack.glow,
    flags: pack.flags,
    confetti: pack.confetti,
    unlock: { kind: "scan" },
    haptics: pack.haptics,
    decoration: pack.decoration,
    copy: pack.copy,
    dossier: pack.dossier,
  };
}

type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Api = { themes(): Promise<{ themes: PackSummary[] }>; theme(id: string): Promise<unknown> };

function parseJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function createClubThemes(deps: { storage: Storage; api: Api; register: (theme: Theme) => void }) {
  const packs = new Map<string, ThemePack>();
  let summaries: PackSummary[] = [];

  function keep(pack: ThemePack) {
    packs.set(pack.id, pack);
    deps.register(packToTheme(pack));
  }

  async function save() {
    await deps.storage.setItem(PACKS_KEY, JSON.stringify(Object.fromEntries(packs))).catch((error) =>
      console.warn("Saving club themes failed:", error),
    );
  }

  // Downloads a club theme. True when it can be worn.
  async function download(id: string): Promise<boolean> {
    try {
      const result = validatePack(await deps.api.theme(id));
      if (result.ok === false) {
        console.warn(`Club theme ${id} was rejected:`, result.errors);
        return packs.has(id);
      }
      if (result.pack.id !== id) {
        console.warn(`Club theme ${id} was rejected: the server sent ${result.pack.id}`);
        return packs.has(id);
      }
      keep(result.pack);
      await save();
      return true;
    } catch (error: any) {
      console.warn(`Club theme ${id} couldn't be downloaded:`, error?.message ?? error);
      return packs.has(id);
    }
  }

  return {
    get: (id: string) => packs.get(id),
    summaries: () => summaries,

    // Cached files are checked again: a bad one is dropped, never worn.
    async loadCache() {
      const cached = parseJson<Record<string, unknown>>(await deps.storage.getItem(PACKS_KEY).catch(() => null), {});
      for (const [id, raw] of Object.entries(cached)) {
        const result = validatePack(raw);
        if (result.ok && result.pack.id === id) keep(result.pack);
        else console.warn(`Dropped the cached club theme ${id}`);
      }
      summaries = parseJson<PackSummary[]>(await deps.storage.getItem(SUMMARIES_KEY).catch(() => null), []);
    },

    async ensure(id: ClubThemeId): Promise<boolean> {
      return packs.has(id) || download(id);
    },

    // Fetches the club list and updates unlocked themes the server has a
    // newer version of. Offline, the saved list stays.
    async refresh(unlocked: readonly ThemeId[]): Promise<PackSummary[]> {
      try {
        summaries = (await deps.api.themes()).themes;
        await deps.storage.setItem(SUMMARIES_KEY, JSON.stringify(summaries)).catch(() => {});
      } catch (error: any) {
        console.warn("Couldn't fetch the club theme list:", error?.message ?? error);
        return summaries;
      }
      const latest = new Map(summaries.map((s) => [s.id, s.version]));
      for (const id of unlocked) {
        if (!CLUB_THEME_ID.test(id)) continue;
        const cached = packs.get(id);
        const version = latest.get(id as ClubThemeId);
        if (!cached || (version !== undefined && version > cached.version)) await download(id);
      }
      return summaries;
    },
  };
}
