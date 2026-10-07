import type { Catalog } from "../translate";

// Shared strings used across screens. Area-specific strings live in their own
// catalog file (home.ts, gameplay.ts, …). Keys are namespaced "area.name" and
// must never collide across files (the completeness test guards this).
export const common: Catalog = {
  en: {
    "settings.language": "Language",
    "lang.en": "English",
    "lang.sv": "Svenska",
    "common.back": "Back",
    "common.close": "Close",
    "common.cancel": "Cancel",
    "common.ok": "OK",
  },
  sv: {
    "settings.language": "Språk",
    "lang.en": "English",
    "lang.sv": "Svenska",
    "common.back": "Tillbaka",
    "common.close": "Stäng",
    "common.cancel": "Avbryt",
    "common.ok": "OK",
  },
};
