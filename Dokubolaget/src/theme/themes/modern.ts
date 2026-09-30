import type { Theme } from "../types";

// Today's look. Two greys were darkened to meet WCAG AA: #999 → #707070 and
// the search hint #8a7a55 → #6f6242.
export const modern: Theme = {
  id: "modern",
  dark: false,
  colors: {
    page: "#f3f3f1", surface: "#ffffff", surfaceAlt: "#fafafa",
    ink: "#262626", inkStrong: "#111111", inkMuted: "#555555", inkFaint: "#707070",
    accent: "#007a33", accentInk: "#ffffff", highlight: "#ffd400",
    cellFill: "#ffffff", cellBorder: "#e0e0e0", cellShimmer: "#dcefe3",
    headerCol: "#e0e0e0", headerRow: "#e0e0e0", headerLabelBg: "#ffffff", icon: "#262626", pulse: "#1e9e55",
    correct: "#155724", correctBg: "#d4edda", nearMiss: "#7a5a00", nearMissBg: "#fff1c2", miss: "#721c24", missBg: "#f8d7da",
    hint: "#6f6242", divider: "#dddddd", overlay: "rgba(0, 0, 0, 0.35)", celebrationOverlay: "rgba(0, 40, 18, 0.55)",
    dialogSurface: "#ffffff", dialogInk: "#262626", dialogButton: "#c7e5ce", dialogButtonInk: "#0a6149",
  },
  fonts: {
    logo: "Monopol", display: "Monopol", body: "InterVariable", bodyStrong: "InterVariable",
    condensed: "BolagetMediumCondensed", mono: "InterVariable",
  },
  radii: { card: 18, cell: 3, button: 24, pill: 10 },
  borders: { cell: 1, header: 1, card: 4 },
  glow: null,
  flags: {
    ruledTable: false, productNumberCells: false, dottedLeaderPrices: false,
    greyscaleFlags: false, groupResultsByType: false, feedbackPlacement: "overlay", celebrationLayout: "card",
  },
  confetti: { shape: "dots", colors: ["#007a33", "#ffd400", "#ff5a5f", "#2d9cdb", "#ff9f1c", "#9b5de5"] },
  // Modern ships Systembolaget's own fonts, so it is the hardest reward.
  unlock: { kind: "streak", days: 7 },
  copy: {
    en: {
      name: "Modern", description: "Clean and bright. The classic look.", unlockHint: "Unlocks at a 7-day streak.",
      correctTitles: ["Skål!", "Spot on!", "Nice pick!", "Great!", "Nailed it!"],
      nearMissTitle: "So close!", completeTitle: "Board complete!", searchTitle: "Make your guess",
      tabHome: "Home", tabPlay: "Play!", tabLeaderboard: "Leaderboard",
    },
    sv: {
      name: "Modern", description: "Rent och ljust. Det klassiska utseendet.", unlockHint: "Låses upp vid 7 dagar i rad.",
      correctTitles: ["Skål!", "Mitt i prick!", "Snyggt!", "Bra!", "Klockrent!"],
      nearMissTitle: "Så nära!", completeTitle: "Brädet klart!", searchTitle: "Gör din gissning",
      tabHome: "Hem", tabPlay: "Spela!", tabLeaderboard: "Topplista",
    },
  },
};
