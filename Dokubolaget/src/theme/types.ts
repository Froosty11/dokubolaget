export const THEME_IDS = ["prislista", "midsommar", "cyberwave", "speakeasy", "modern"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export type Lang = "sv" | "en";

export type ThemeColors = {
  page: string; surface: string; surfaceAlt: string;
  ink: string; inkStrong: string; inkMuted: string; inkFaint: string;
  accent: string; accentInk: string; highlight: string;
  cellFill: string; cellBorder: string; cellShimmer: string;
  headerCol: string; headerRow: string; headerLabelBg: string; icon: string; pulse: string;
  correct: string; correctBg: string; nearMiss: string; nearMissBg: string; miss: string; missBg: string;
  hint: string; divider: string; overlay: string; celebrationOverlay: string;
  dialogSurface: string; dialogInk: string; dialogButton: string; dialogButtonInk: string;
  // Tint behind the age gate (drawn at 40% opacity).
  gateOverlay: string;
};

// Font family names as registered with expo-font.
export type ThemeFonts = { logo: string; display: string; body: string; bodyStrong: string; condensed: string; mono: string };

export type ConfettiShape = "dots" | "petals" | "sparks" | "flecks" | "priceTags";

export type UnlockRule =
  | { kind: "always" }
  | { kind: "firstBoard" }
  | { kind: "perfectBoard" }
  | { kind: "streak"; days: number };

export type ThemeCopy = {
  name: string; description: string; unlockHint: string;
  correctTitles: string[]; nearMissTitle: string; completeTitle: string; searchTitle: string;
  tabHome: string; tabPlay: string; tabLeaderboard: string;
  // The product info sheet ("case file"): its header, subject line, notes
  // heading and the stamp while hidden / once revealed.
  dossierTitle: string; dossierSubject: string; dossierNotes: string;
  stampHidden: string; stampRevealed: string;
};

// How the product info sheet looks in a theme. The redaction mechanic is the
// same everywhere; only the paper, ink and ornament change.
export type DossierLook = {
  paper: string; ink: string; label: string; bar: string; rule: string;
  border: string; borderStyle: "solid" | "dashed" | "double"; radius: number; tilt: string;
  // Red margin line of an index card, when set.
  marginRule: string | null;
  // Horizontal ruled lines, like an index card.
  ruledLines: boolean;
  stampHidden: string; stampRevealed: string;
  // null = the platform's typewriter font (Courier).
  font: string | null;
  glow: boolean;
};

export type Theme = {
  id: ThemeId;
  dark: boolean;
  colors: ThemeColors;
  fonts: ThemeFonts;
  radii: { card: number; cell: number; button: number; pill: number };
  // Wide display fonts need smaller board header labels to avoid breaking words.
  typeScale: { headerLabel: number };
  borders: { cell: number; header: number; card: number };
  glow: { color: string; radius: number } | null;
  flags: {
    ruledTable: boolean; productNumberCells: boolean; dottedLeaderPrices: boolean;
    greyscaleFlags: boolean; groupResultsByType: boolean;
    feedbackPlacement: "overlay" | "slip"; celebrationLayout: "card" | "receipt";
  };
  confetti: { shape: ConfettiShape; colors: string[] };
  unlock: UnlockRule;
  copy: Record<Lang, ThemeCopy>;
  dossier: DossierLook;
};
