import type { Lang } from "../theme/types";
import type { Catalog } from "./translate";
import { common } from "./catalogs/common";
import { home } from "./catalogs/home";
import { gameplay } from "./catalogs/gameplay";
import { search } from "./catalogs/search";
import { leaderboard } from "./catalogs/leaderboard";
import { boardComplete } from "./catalogs/boardComplete";
import { dialogs } from "./catalogs/dialogs";
import { misc } from "./catalogs/misc";

// Every per-area catalog. New areas: add the file and list it here.
export const AREAS: Catalog[] = [common, home, gameplay, search, leaderboard, boardComplete, dialogs, misc];

function merge(lang: Lang): Record<string, string> {
  return Object.assign({}, ...AREAS.map((area) => area[lang]));
}

// All strings, flattened across areas, per language. Consumed by the theme
// context's t(); the completeness test guards key parity and collisions.
export const translations: Catalog = { en: merge("en"), sv: merge("sv") };

export { translate, type Catalog, type Dict, type TParams } from "./translate";
export { detectLang, detectDeviceLang } from "./detectLang";
