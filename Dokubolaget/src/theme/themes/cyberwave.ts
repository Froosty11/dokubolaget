import type { Theme } from "../types";

// 80s outrun: violet night, neon magenta and cyan, a striped sunset sun.
export const cyberwave: Theme = {
  id: "cyberwave",
  dark: true,
  colors: {
    page: "#0b0221", surface: "#1a063a", surfaceAlt: "#24094d",
    ink: "#e9fbff", inkStrong: "#ffffff", inkMuted: "#c7b8ff", inkFaint: "#a597d9",
    accent: "#ff2ec4", accentInk: "#0b0221", highlight: "#ffe45e",
    cellFill: "#1a063a", cellBorder: "#5b3fa8", cellShimmer: "#2c0f5e",
    headerCol: "#00f0ff", headerRow: "#ff7de0", headerLabelBg: "#0b0221", icon: "#00f0ff", pulse: "#00f0ff",
    correct: "#00f0ff", correctBg: "#062a3a", nearMiss: "#ffb13d", nearMissBg: "#2a1a05", miss: "#ff6b8b", missBg: "#2a0718",
    hint: "#c7b8ff", divider: "#5b3fa8", overlay: "rgba(11, 2, 33, 0.7)", celebrationOverlay: "rgba(11, 2, 33, 0.75)",
    dialogSurface: "#1a063a", dialogInk: "#e9fbff", dialogButton: "#00f0ff", dialogButtonInk: "#0b0221", gateOverlay: "#0b0221",
  },
  fonts: {
    logo: "Monoton_400Regular", display: "Orbitron_700Bold", body: "ShareTechMono_400Regular",
    bodyStrong: "Orbitron_700Bold", condensed: "Orbitron_700Bold", mono: "ShareTechMono_400Regular",
  },
  radii: { card: 10, cell: 6, button: 8, pill: 6 },
  typeScale: { headerLabel: 0.72 },
  borders: { cell: 1, header: 1, card: 1.5 },
  glow: { color: "rgba(0, 240, 255, 0.8)", radius: 8 },
  flags: {
    ruledTable: false, productNumberCells: false, dottedLeaderPrices: false,
    greyscaleFlags: false, groupResultsByType: false, feedbackPlacement: "overlay", celebrationLayout: "card",
  },
  confetti: { shape: "sparks", colors: ["#00f0ff", "#ff2ec4", "#ffe45e", "#ff8a3d"] },
  unlock: { kind: "firstBoard" },
  haptics: "neon",
  copy: {
    en: {
      name: "Cyberwave", description: "80s outrun. Neon grid, sunset, chrome.", unlockHint: "Unlocks when you finish your first board.",
      correctTitles: ["RAD!", "MAXIMUM!", "TUBULAR!", "PERFECT HIT!"], nearMissTitle: "SO CLOSE //", completeTitle: "GRID CLEARED",
      searchTitle: "Make your guess", tabHome: "Home", tabPlay: "Play", tabLeaderboard: "Ranks",
      dossierTitle: "DATA FILE //", dossierSubject: "TARGET:", dossierNotes: "SIGNAL LOG", stampHidden: "ENCRYPTED", stampRevealed: "DECRYPTED",
    },
    sv: {
      name: "Cyberwave", description: "80-talets outrun. Neonrutnät, solnedgång, krom.", unlockHint: "Låses upp när du klarar ditt första bräde.",
      correctTitles: ["GRYMT!", "MAXIMALT!", "FULLTRÄFF!"], nearMissTitle: "NÄSTAN //", completeTitle: "RUTNÄT KLART",
      searchTitle: "Gör din gissning", tabHome: "Hem", tabPlay: "Spela", tabLeaderboard: "Topplista",
      dossierTitle: "DATAFIL //", dossierSubject: "MÅL:", dossierNotes: "SIGNALLOGG", stampHidden: "KRYPTERAD", stampRevealed: "DEKRYPTERAD",
    },
  },
  dossier: {
    paper: "#0f0428",
    ink: "#e9fbff",
    label: "#00f0ff",
    bar: "#ff2ec4",
    rule: "#5b3fa8",
    border: "#00f0ff",
    borderStyle: "solid",
    radius: 8,
    tilt: "0deg",
    marginRule: null,
    ruledLines: false,
    stampHidden: "#ff6b8b",
    stampRevealed: "#00f0ff",
    font: "ShareTechMono_400Regular",
    glow: true,
  },
};
