import type { Catalog } from "../translate";

// Gameplay screen, board and feedback strings. Keys namespaced "gameplay.*".
export const gameplay: Catalog = {
  en: {
    "gameplay.loadingBoard": "Fetching today's board…",

    // Board cell accessibility labels.
    "gameplay.cellAccessibility": "{side} and {top}, {detail}",
    "gameplay.cellEmpty": "empty. Opens search.",
    "gameplay.cellFilled": "filled with {name}, {score} points. Opens its info sheet.",
    "gameplay.cellFilledUnicorn": "filled with {name}, {score} points, unicorn. Opens its info sheet.",
    "gameplay.scorePending": "score pending",

    // Rollover / practice notices.
    "gameplay.rolloverNotice": "New board! Yesterday's ended at {score} points.",
    "gameplay.practiceOffline": "Practice (offline) · scores need a connection",
    "gameplay.practiceArchive": "Practice · {day} · doesn't count",

    // How-to-play dialog.
    "gameplay.howToPlayA11y": "How to play",
    "gameplay.howToPlayTitle": "How to play!",
    "gameplay.howToFillTitle": "Fill the grid.",
    "gameplay.howToFillBody": " Find a bottle that matches both its row and its column. Only bottles from Systembolaget's regular, local and seasonal ranges count.",
    "gameplay.howToRarerTitle": "Rarer scores more.",
    "gameplay.howToRarerBody": " The fewer players who picked your bottle, the more it's worth (up to 100 a cell). Each miss costs 5 points, at most 20 per cell.",
    "gameplay.howToNewBoard": "A new board every day at 04:00.",
    "gameplay.howToPlayAction": "Ok, let's play!",
  },
  sv: {
    "gameplay.loadingBoard": "Hämtar dagens bräde…",

    // Board cell accessibility labels.
    "gameplay.cellAccessibility": "{side} och {top}, {detail}",
    "gameplay.cellEmpty": "tom. Öppnar sök.",
    "gameplay.cellFilled": "fylld med {name}, {score} poäng. Öppnar infobladet.",
    "gameplay.cellFilledUnicorn": "fylld med {name}, {score} poäng, enhörning. Öppnar infobladet.",
    "gameplay.scorePending": "poäng väntar",

    // Rollover / practice notices.
    "gameplay.rolloverNotice": "Nytt bräde! Gårdagens slutade på {score} poäng.",
    "gameplay.practiceOffline": "Övning (offline) · poäng kräver anslutning",
    "gameplay.practiceArchive": "Övning · {day} · räknas inte",

    // How-to-play dialog.
    "gameplay.howToPlayA11y": "Hur man spelar",
    "gameplay.howToPlayTitle": "Hur man spelar!",
    "gameplay.howToFillTitle": "Fyll rutnätet.",
    "gameplay.howToFillBody": " Hitta en flaska som matchar både sin rad och sin kolumn. Bara flaskor ur Systembolagets ordinarie, lokala och säsongssortiment räknas.",
    "gameplay.howToRarerTitle": "Ovanligare ger mer.",
    "gameplay.howToRarerBody": " Ju färre spelare som valde din flaska, desto mer är den värd (upp till 100 per ruta). Varje miss kostar 5 poäng, högst 20 per ruta.",
    "gameplay.howToNewBoard": "Ett nytt bräde varje dag klockan 04:00.",
    "gameplay.howToPlayAction": "Nu kör vi!",
  },
};
