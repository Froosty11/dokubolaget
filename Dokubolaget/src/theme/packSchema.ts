// The club theme file format, shared by the server (which loads and serves
// the files) and the app (which caches them). Pure TypeScript: the server
// imports this file, so it must never pull in React Native.
import { CONTRAST_PAIRS, contrastProblems, dossierContrastProblems } from "./contrast";
import type { ConfettiShape, DossierLook, Lang, Theme, ThemeColors, ThemeCopy } from "./types";

export const CLUB_THEME_ID = /^club-[a-z0-9-]{2,32}$/;
export type ClubThemeId = `club-${string}`;

export const FONT_KIT_IDS = ["prislista", "midsommar", "cyberwave", "speakeasy", "poppins", "archivo", "pixel", "broadcast", "grotesk", "slab"] as const;
export type FontKitId = (typeof FONT_KIT_IDS)[number];

export const DECORATION_KINDS = ["none", "dancefloor", "arcade", "colorbars", "circuit", "candlelight", "cellar"] as const;
export type DecorationKind = (typeof DECORATION_KINDS)[number];

export const HAPTIC_PATTERN_IDS = ["classic", "receipt", "neon", "bass", "arcade", "toast"] as const;
export type HapticPatternId = (typeof HAPTIC_PATTERN_IDS)[number];

export type ClubInfo = { name: string; fullName: string; section: string; campus: string; venue: string; pubNight: string; website: string };

export type ThemePack = {
  id: ClubThemeId;
  version: number;
  club: ClubInfo;
  dark: boolean;
  colors: ThemeColors;
  fontKit: FontKitId;
  radii: Theme["radii"];
  borders: Theme["borders"];
  typeScale: Theme["typeScale"];
  glow: Theme["glow"];
  flags: Theme["flags"];
  confetti: Theme["confetti"];
  decoration: { kind: DecorationKind; colors: string[] };
  haptics: HapticPatternId;
  copy: Record<Lang, ThemeCopy>;
  dossier: DossierLook;
  logo: { width: number; height: number } | null;
};

// What /api/themes lists; used by the server and the app.
export type PackSummary = {
  id: ClubThemeId;
  version: number;
  name: string;
  club: ClubInfo;
  swatch: [string, string, string];
  logoUrl: string | null;
};

const COLOR_KEYS: Array<keyof ThemeColors> = [
  "page", "surface", "surfaceAlt", "ink", "inkStrong", "inkMuted", "inkFaint", "accent", "accentInk", "highlight",
  "cellFill", "cellBorder", "cellShimmer", "headerCol", "headerRow", "headerLabelBg", "icon", "pulse",
  "correct", "correctBg", "nearMiss", "nearMissBg", "miss", "missBg", "hint", "divider", "overlay", "celebrationOverlay",
  "dialogSurface", "dialogInk", "dialogButton", "dialogButtonInk", "gateOverlay",
];
const COPY_STRING_KEYS: Array<Exclude<keyof ThemeCopy, "correctTitles">> = [
  "name", "description", "unlockHint", "nearMissTitle", "completeTitle", "searchTitle", "tabHome", "tabPlay", "tabLeaderboard",
  "dossierTitle", "dossierSubject", "dossierNotes", "stampHidden", "stampRevealed",
];
const CLUB_KEYS: Array<keyof ClubInfo> = ["name", "fullName", "section", "campus", "venue", "pubNight", "website"];
const CONFETTI_SHAPES: ConfettiShape[] = ["dots", "petals", "sparks", "flecks", "priceTags"];
const HEX = /^#[0-9a-f]{6}$/i;
const RGBA = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

type Errors = string[];
const isObject = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);

function text(errors: Errors, field: string, v: unknown, max = 200): string {
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) errors.push(`${field}: expected text (1–${max} characters)`);
  return typeof v === "string" ? v : "";
}
function num(errors: Errors, field: string, v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) errors.push(`${field}: expected a number ${min}–${max}`);
  return typeof v === "number" ? v : min;
}
function bool(errors: Errors, field: string, v: unknown): boolean {
  if (typeof v !== "boolean") errors.push(`${field}: expected true or false`);
  return v === true;
}
function oneOf<T extends string>(errors: Errors, field: string, v: unknown, allowed: readonly T[]): T {
  if (!allowed.includes(v as T)) errors.push(`${field}: expected one of ${allowed.join(", ")}`);
  return v as T;
}
function hex(errors: Errors, field: string, v: unknown): string {
  if (typeof v !== "string" || !HEX.test(v)) errors.push(`${field}: expected a #rrggbb colour`);
  return String(v);
}
function obj(errors: Errors, field: string, v: unknown): Record<string, any> {
  if (!isObject(v)) {
    errors.push(`${field}: expected an object`);
    return {};
  }
  return v;
}

// Colours that text sits on (or that are text) must be plain hex.
const CONTRAST_KEYS = new Set(CONTRAST_PAIRS.flat());

function colors(errors: Errors, raw: unknown): ThemeColors {
  const src = obj(errors, "colors", raw);
  const out = {} as ThemeColors;
  for (const key of COLOR_KEYS) {
    const v = src[key];
    if (CONTRAST_KEYS.has(key)) {
      out[key] = hex(errors, `colors.${key}`, v);
      continue;
    }
    // Overlays may be translucent; everything text sits on must be plain hex
    // so contrast can be measured.
    if (typeof v !== "string" || !(HEX.test(v) || RGBA.test(v))) errors.push(`colors.${key}: expected a #rrggbb or rgba() colour`);
    out[key] = String(v);
  }
  return out;
}

function copy(errors: Errors, lang: Lang, raw: unknown): ThemeCopy {
  const src = obj(errors, `copy.${lang}`, raw);
  const out = {} as ThemeCopy;
  for (const key of COPY_STRING_KEYS) out[key] = text(errors, `copy.${lang}.${key}`, src[key]);
  const titles = src.correctTitles;
  if (!Array.isArray(titles) || titles.length === 0 || titles.some((t) => typeof t !== "string" || !t.trim())) {
    errors.push(`copy.${lang}.correctTitles: expected a non-empty list of text`);
  }
  out.correctTitles = Array.isArray(titles) ? titles.map(String) : [];
  return out;
}

function dossier(errors: Errors, raw: unknown): DossierLook {
  const d = obj(errors, "dossier", raw);
  return {
    paper: hex(errors, "dossier.paper", d.paper),
    ink: hex(errors, "dossier.ink", d.ink),
    label: hex(errors, "dossier.label", d.label),
    bar: hex(errors, "dossier.bar", d.bar),
    rule: hex(errors, "dossier.rule", d.rule),
    border: hex(errors, "dossier.border", d.border),
    borderStyle: oneOf(errors, "dossier.borderStyle", d.borderStyle, ["solid", "dashed", "double"] as const),
    radius: num(errors, "dossier.radius", d.radius, 0, 40),
    tilt: typeof d.tilt === "string" && /^-?\d+(\.\d+)?deg$/.test(d.tilt) ? d.tilt : (errors.push("dossier.tilt: expected e.g. \"-1deg\""), "0deg"),
    marginRule: d.marginRule === null ? null : hex(errors, "dossier.marginRule", d.marginRule),
    ruledLines: bool(errors, "dossier.ruledLines", d.ruledLines),
    stampHidden: hex(errors, "dossier.stampHidden", d.stampHidden),
    stampRevealed: hex(errors, "dossier.stampRevealed", d.stampRevealed),
    font: d.font === null ? null : text(errors, "dossier.font", d.font, 80),
    glow: bool(errors, "dossier.glow", d.glow),
  };
}

// Checks a club theme file field by field and returns every problem, or the
// theme with only the known keys.
export function validatePack(raw: unknown): { ok: true; pack: ThemePack } | { ok: false; errors: string[] } {
  if (!isObject(raw)) return { ok: false, errors: ["theme: expected a JSON object"] };
  const errors: Errors = [];

  if (typeof raw.id !== "string" || !CLUB_THEME_ID.test(raw.id)) errors.push("id: expected club-<a-z, 0-9, ->, 2–32 characters after club-");
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 1) errors.push("version: expected a whole number from 1");

  const clubSrc = obj(errors, "club", raw.club);
  const club = {} as ClubInfo;
  for (const key of CLUB_KEYS) club[key] = text(errors, `club.${key}`, clubSrc[key]);

  const themeColors = colors(errors, raw.colors);
  const radiiSrc = obj(errors, "radii", raw.radii);
  const bordersSrc = obj(errors, "borders", raw.borders);
  const typeSrc = obj(errors, "typeScale", raw.typeScale);
  const flagsSrc = obj(errors, "flags", raw.flags);
  const confettiSrc = obj(errors, "confetti", raw.confetti);
  const decorationSrc = obj(errors, "decoration", raw.decoration);

  let glow: Theme["glow"] = null;
  if (raw.glow !== null) {
    const g = obj(errors, "glow", raw.glow);
    glow = { color: hex(errors, "glow.color", g.color), radius: num(errors, "glow.radius", g.radius, 0, 40) };
  }

  const confettiColors = Array.isArray(confettiSrc.colors) ? confettiSrc.colors : [];
  if (confettiColors.length === 0) errors.push("confetti.colors: expected at least one colour");
  const decorationColors = Array.isArray(decorationSrc.colors) ? decorationSrc.colors : (errors.push("decoration.colors: expected a list"), []);

  let logo: ThemePack["logo"] = null;
  if (raw.logo !== null) {
    const l = obj(errors, "logo", raw.logo);
    logo = { width: num(errors, "logo.width", l.width, 1, 1024), height: num(errors, "logo.height", l.height, 1, 1024) };
  }

  const pack: ThemePack = {
    id: raw.id,
    version: raw.version,
    club,
    dark: bool(errors, "dark", raw.dark),
    colors: themeColors,
    fontKit: oneOf(errors, "fontKit", raw.fontKit, FONT_KIT_IDS),
    radii: {
      card: num(errors, "radii.card", radiiSrc.card, 0, 60), cell: num(errors, "radii.cell", radiiSrc.cell, 0, 60),
      button: num(errors, "radii.button", radiiSrc.button, 0, 60), pill: num(errors, "radii.pill", radiiSrc.pill, 0, 60),
    },
    typeScale: { headerLabel: num(errors, "typeScale.headerLabel", typeSrc.headerLabel, 0.6, 1.4) },
    borders: {
      cell: num(errors, "borders.cell", bordersSrc.cell, 0, 6), header: num(errors, "borders.header", bordersSrc.header, 0, 6),
      card: num(errors, "borders.card", bordersSrc.card, 0, 6),
    },
    glow,
    flags: {
      ruledTable: bool(errors, "flags.ruledTable", flagsSrc.ruledTable),
      productNumberCells: bool(errors, "flags.productNumberCells", flagsSrc.productNumberCells),
      dottedLeaderPrices: bool(errors, "flags.dottedLeaderPrices", flagsSrc.dottedLeaderPrices),
      greyscaleFlags: bool(errors, "flags.greyscaleFlags", flagsSrc.greyscaleFlags),
      groupResultsByType: bool(errors, "flags.groupResultsByType", flagsSrc.groupResultsByType),
      feedbackPlacement: oneOf(errors, "flags.feedbackPlacement", flagsSrc.feedbackPlacement, ["overlay", "slip"] as const),
      celebrationLayout: oneOf(errors, "flags.celebrationLayout", flagsSrc.celebrationLayout, ["card", "receipt"] as const),
    },
    confetti: {
      shape: oneOf(errors, "confetti.shape", confettiSrc.shape, CONFETTI_SHAPES),
      colors: confettiColors.map((c: unknown, i: number) => hex(errors, `confetti.colors[${i}]`, c)),
    },
    decoration: {
      kind: oneOf(errors, "decoration.kind", decorationSrc.kind, DECORATION_KINDS),
      colors: decorationColors.map((c: unknown, i: number) => hex(errors, `decoration.colors[${i}]`, c)),
    },
    haptics: oneOf(errors, "haptics", raw.haptics, HAPTIC_PATTERN_IDS),
    copy: { en: copy(errors, "en", obj(errors, "copy", raw.copy).en), sv: copy(errors, "sv", isObject(raw.copy) ? raw.copy.sv : undefined) },
    dossier: dossier(errors, raw.dossier),
    logo,
  };

  // Contrast is only measurable once every colour parsed.
  if (errors.length === 0) {
    for (const line of contrastProblems(pack.colors)) errors.push(`contrast: ${line}`);
    for (const line of dossierContrastProblems(pack.dossier)) errors.push(`contrast: ${line}`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, pack };
}
