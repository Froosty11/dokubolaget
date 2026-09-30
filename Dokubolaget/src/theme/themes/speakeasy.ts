import type { Theme } from "../types";

// 1920s Prohibition art deco: black, gold and a password.
export const speakeasy: Theme = {
  id: "speakeasy",
  dark: true,
  colors: {
    page: "#0e0d0b", surface: "#15120a", surfaceAlt: "#2a2210",
    ink: "#efe3c2", inkStrong: "#f5e7bf", inkMuted: "#bfa65a", inkFaint: "#9b8a5c",
    accent: "#d4af37", accentInk: "#0e0d0b", highlight: "#d4af37",
    cellFill: "#15130f", cellBorder: "#5c4c1c", cellShimmer: "#221c0e",
    headerCol: "#d4af37", headerRow: "#d4af37", headerLabelBg: "#0e0d0b", icon: "#d4af37", pulse: "#d4af37",
    correct: "#d4af37", correctBg: "#2a2210", nearMiss: "#e3a060", nearMissBg: "#28160a", miss: "#e07a6a", missBg: "#2a100c",
    hint: "#bfa65a", divider: "#5c4c1c", overlay: "rgba(0, 0, 0, 0.6)", celebrationOverlay: "rgba(0, 0, 0, 0.7)",
    dialogSurface: "#15120a", dialogInk: "#efe3c2", dialogButton: "#d4af37", dialogButtonInk: "#0e0d0b", gateOverlay: "#000000",
  },
  // Poiret One is thin, so only the large display role uses it.
  fonts: {
    logo: "Limelight_400Regular", display: "PoiretOne_400Regular", body: "JosefinSans_400Regular",
    bodyStrong: "JosefinSans_700Bold", condensed: "JosefinSans_700Bold", mono: "JosefinSans_400Regular",
  },
  radii: { card: 0, cell: 0, button: 0, pill: 0 },
  typeScale: { headerLabel: 0.85 },
  borders: { cell: 1, header: 1, card: 1 },
  glow: null,
  flags: {
    ruledTable: false, productNumberCells: false, dottedLeaderPrices: false,
    greyscaleFlags: false, groupResultsByType: true, feedbackPlacement: "overlay", celebrationLayout: "card",
  },
  confetti: { shape: "flecks", colors: ["#d4af37", "#f5e7bf", "#b8912a"] },
  unlock: { kind: "perfectBoard" },
  copy: {
    en: {
      name: "Speakeasy", description: "1920s art deco. Black, gold and a password.", unlockHint: "Unlocks with a perfect board: nine cells, no misses.",
      correctTitles: ["Cheers, old sport!", "The bee's knees!", "Swell pour!"], nearMissTitle: "ALMOST, OLD SPORT.", completeTitle: "Members only",
      searchTitle: "The Menu", tabHome: "Lobby", tabPlay: "Play", tabLeaderboard: "Ledger",
    },
    sv: {
      name: "Speakeasy", description: "1920-talets art deco. Svart, guld och ett lösenord.", unlockHint: "Låses upp med ett perfekt bräde: nio rutor, inga missar.",
      correctTitles: ["Skål, gamle gosse!", "Förstklassigt!", "Fin servering!"], nearMissTitle: "NÄSTAN, GAMLE GOSSE.", completeTitle: "Endast medlemmar",
      searchTitle: "Menyn", tabHome: "Lobby", tabPlay: "Spela", tabLeaderboard: "Liggaren",
    },
  },
};
