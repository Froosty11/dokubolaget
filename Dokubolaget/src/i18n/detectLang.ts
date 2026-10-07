import type { Lang } from "../theme/types";

// sv for Swedish locales, en otherwise. Kept pure (no react-native import) so
// it stays unit-testable; detectDeviceLang() reads the platform locale.
export function detectLang(locale: string | undefined | null): Lang {
  return locale && locale.toLowerCase().startsWith("sv") ? "sv" : "en";
}

// Best-effort device/browser language, used as the first-run default before the
// player picks one. Works on web (navigator.language) and native (Intl locale),
// so no expo-localization dependency is needed.
export function detectDeviceLang(): Lang {
  try {
    if (typeof navigator !== "undefined" && navigator.language) return detectLang(navigator.language);
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    return detectLang(intlLocale);
  } catch {
    return "en";
  }
}
