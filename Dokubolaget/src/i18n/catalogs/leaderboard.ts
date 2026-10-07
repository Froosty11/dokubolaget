import type { Catalog } from "../translate";

// Leaderboard screen strings. Keys namespaced "leaderboard.*".
export const leaderboard: Catalog = {
  en: {
    // Screen chrome (leaderboardFormView)
    "leaderboard.heading": "Leaderboards",
    "leaderboard.tagline": "See how you rank",
    "leaderboard.fieldLabel": "Leaderboard",
    "leaderboard.selectPlaceholder": "Select leaderboard",

    // Shared row copy (leaderboardPresenter)
    "leaderboard.you": "You",
    "leaderboard.loading": "Loading…",
    "leaderboard.loadingDetail": "Fetching the leaderboard",
    "leaderboard.nobodyYet": "Nobody here yet",

    // Per-period copy. .title doubles as the period option/tab label.
    "leaderboard.today.title": "Today",
    "leaderboard.today.subtitle": "Ranked by today's score",
    "leaderboard.today.empty": "No scores yet today — be the first to finish the board.",
    "leaderboard.today.unit": "points today",
    "leaderboard.week.title": "This Week",
    "leaderboard.week.subtitle": "Ranked by this week's score",
    "leaderboard.week.empty": "No scores yet this week.",
    "leaderboard.week.unit": "points this week",
    "leaderboard.all.title": "All Time",
    "leaderboard.all.subtitle": "Ranked by total score",
    "leaderboard.all.empty": "No scores recorded yet.",
    "leaderboard.all.unit": "points in total",
    "leaderboard.streak.title": "Streak",
    "leaderboard.streak.subtitle": "Ranked by current streak",
    "leaderboard.streak.empty": "No streaks going yet.",
    "leaderboard.streak.unit": "days in a row",

    // The player's own stats card (leaderboardYouView)
    "leaderboard.you.lead": "Log in to see your rank, your streak and the unicorns you've found.",
    "leaderboard.you.login": "Log in / Sign up",
    "leaderboard.you.rankTile": "rank, {period}",
    "leaderboard.you.dayStreak": "day streak",
    "leaderboard.you.longestStreak": "longest streak",
    "leaderboard.you.boardsFinished": "boards finished",
    "leaderboard.you.unicorns": "unicorns 🦄",
  },
  sv: {
    // Screen chrome (leaderboardFormView)
    "leaderboard.heading": "Topplistor",
    "leaderboard.tagline": "Se hur du rankas",
    "leaderboard.fieldLabel": "Topplista",
    "leaderboard.selectPlaceholder": "Välj topplista",

    // Shared row copy (leaderboardPresenter)
    "leaderboard.you": "Du",
    "leaderboard.loading": "Laddar…",
    "leaderboard.loadingDetail": "Hämtar topplistan",
    "leaderboard.nobodyYet": "Ingen här än",

    // Per-period copy. .title doubles as the period option/tab label.
    "leaderboard.today.title": "Idag",
    "leaderboard.today.subtitle": "Rankad efter dagens poäng",
    "leaderboard.today.empty": "Inga poäng idag än — bli först med att klara brädet.",
    "leaderboard.today.unit": "poäng idag",
    "leaderboard.week.title": "Denna vecka",
    "leaderboard.week.subtitle": "Rankad efter veckans poäng",
    "leaderboard.week.empty": "Inga poäng denna vecka än.",
    "leaderboard.week.unit": "poäng denna vecka",
    "leaderboard.all.title": "Totalt",
    "leaderboard.all.subtitle": "Rankad efter total poäng",
    "leaderboard.all.empty": "Inga poäng registrerade än.",
    "leaderboard.all.unit": "poäng totalt",
    "leaderboard.streak.title": "Svit",
    "leaderboard.streak.subtitle": "Rankad efter nuvarande svit",
    "leaderboard.streak.empty": "Inga sviter igång än.",
    "leaderboard.streak.unit": "dagar i rad",

    // The player's own stats card (leaderboardYouView)
    "leaderboard.you.lead": "Logga in för att se din placering, din svit och enhörningarna du hittat.",
    "leaderboard.you.login": "Logga in / Registrera dig",
    "leaderboard.you.rankTile": "rang, {period}",
    "leaderboard.you.dayStreak": "dagars svit",
    "leaderboard.you.longestStreak": "längsta svit",
    "leaderboard.you.boardsFinished": "klarade bräden",
    "leaderboard.you.unicorns": "enhörningar 🦄",
  },
};
