import type { Theme } from "../types";

// Swedish summer folk art: meadow, Dala red, cross-stitch and a maypole.
export const midsommar: Theme = {
  id: "midsommar",
  dark: false,
  colors: {
    page: "#fbf6e4", surface: "#fffdf5", surfaceAlt: "#f3ead0",
    ink: "#1f3a5f", inkStrong: "#1f3a5f", inkMuted: "#4a5d78", inkFaint: "#56667c",
    accent: "#c8102e", accentInk: "#ffffff", highlight: "#ffd23f",
    cellFill: "#fffdf5", cellBorder: "#efe2bf", cellShimmer: "#fdf0c4",
    headerCol: "#c8102e", headerRow: "#2e6b3e", headerLabelBg: "#ffffff", icon: "#1f3a5f", pulse: "#2e6b3e",
    correct: "#2e6b3e", correctBg: "#e3f1e6", nearMiss: "#8a5200", nearMissBg: "#fff6e0", miss: "#a10d25", missBg: "#fbe3e6",
    hint: "#4a5d78", divider: "#efe2bf", overlay: "rgba(31, 58, 95, 0.35)", celebrationOverlay: "rgba(191, 224, 245, 0.85)",
    dialogSurface: "#fffdf5", dialogInk: "#1f3a5f", dialogButton: "#c8102e", dialogButtonInk: "#ffffff", gateOverlay: "#1f3a5f",
  },
  fonts: {
    logo: "Fraunces_900Black", display: "Fraunces_700Bold", body: "Nunito_600SemiBold",
    bodyStrong: "Nunito_800ExtraBold", condensed: "Nunito_800ExtraBold", mono: "Nunito_600SemiBold",
  },
  radii: { card: 22, cell: 14, button: 30, pill: 12 },
  typeScale: { headerLabel: 0.8 },
  borders: { cell: 2, header: 2, card: 2 },
  glow: null,
  flags: {
    ruledTable: false, productNumberCells: false, dottedLeaderPrices: false,
    greyscaleFlags: false, groupResultsByType: false, feedbackPlacement: "overlay", celebrationLayout: "card",
  },
  confetti: { shape: "petals", colors: ["#c8102e", "#ffd23f", "#ffffff", "#8cc59a", "#1f3a5f"] },
  unlock: { kind: "always" },
  haptics: "classic",
  copy: {
    en: {
      name: "Midsommar", description: "Swedish summer meadow. Flowers and a maypole.", unlockHint: "Always available.",
      correctTitles: ["Skål!", "Lovely!", "In full bloom!"], nearMissTitle: "Almost!", completeTitle: "Skål!",
      searchTitle: "Make your guess", tabHome: "Home", tabPlay: "Play", tabLeaderboard: "Leaderboard",
      dossierTitle: "Tasting note #", dossierSubject: "Bottle:", dossierNotes: "Notes", stampHidden: "SECRET", stampRevealed: "REVEALED",
    },
    sv: {
      name: "Midsommar", description: "Svensk sommaräng. Blommor och midsommarstång.", unlockHint: "Alltid tillgänglig.",
      correctTitles: ["Skål!", "Härligt!", "I full blom!"], nearMissTitle: "Nästan!", completeTitle: "Skål!",
      searchTitle: "Gör din gissning", tabHome: "Hem", tabPlay: "Spela", tabLeaderboard: "Topplista",
      dossierTitle: "Smakanteckning #", dossierSubject: "Flaska:", dossierNotes: "Anteckningar", stampHidden: "HEMLIS", stampRevealed: "AVSLÖJAT",
    },
  },
  dossier: {
    paper: "#fffdf5",
    ink: "#1f3a5f",
    label: "#4a5d78",
    bar: "#c8102e",
    rule: "#efe2bf",
    border: "#c8102e",
    borderStyle: "dashed",
    radius: 16,
    tilt: "1deg",
    marginRule: null,
    ruledLines: false,
    stampHidden: "#a10d25",
    stampRevealed: "#2e6b3e",
    font: "Nunito_600SemiBold",
    glow: false,
  },
};
