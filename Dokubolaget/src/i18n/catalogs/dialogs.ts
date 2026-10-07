import type { Catalog } from "../translate";

// Dialogs: tutorial, login/auth, age gate, reset/delete account.
// Keys namespaced "dialogs.*".
export const dialogs: Catalog = {
  en: {
    // Shared
    "dialogs.goHome": "Go to Home",

    // Auth dialog (login / sign up / forgot password)
    "dialogs.auth.title.login": "Login",
    "dialogs.auth.title.signup": "Sign Up",
    "dialogs.auth.title.forgot": "Forgot password",
    "dialogs.auth.action.login": "Login",
    "dialogs.auth.action.signup": "Sign Up",
    "dialogs.auth.action.forgot": "Send reset link",
    "dialogs.auth.loading": "Loading...",
    "dialogs.auth.nicknamePlaceholder": "Nickname (shown on the leaderboard)",
    "dialogs.auth.emailPlaceholder": "Email",
    "dialogs.auth.passwordPlaceholder": "Password",
    "dialogs.auth.resetNotice": "If there's an account for that email, a reset link is on its way. It works for one hour.",
    "dialogs.auth.forgotLink": "Forgot password?",
    "dialogs.auth.switchToLogin": "Already have an account? Login",
    "dialogs.auth.backToLogin": "Back to login",
    "dialogs.auth.switchToSignup": "Need an account? Sign Up",
    "dialogs.auth.close": "Close",

    // Reset password page
    "dialogs.reset.title": "New password",
    "dialogs.reset.done": "Your password is changed. Log in with it from Home.",
    "dialogs.reset.placeholder": "At least 8 characters",
    "dialogs.reset.saving": "Saving...",
    "dialogs.reset.submit": "Set new password",
    "dialogs.reset.missingToken": "This link is missing its code. Ask for a new reset email.",

    // Delete account page
    "dialogs.delete.title": "Delete account",
    "dialogs.delete.done": "Your account is deleted, along with your nickname, saved progress and themes. You can keep playing logged out.",
    "dialogs.delete.intro": "This deletes your Dokubolaget account for good: your email, nickname, password, unlocked themes and saved progress. It's removed right away, and from our backups within 7 days.",
    "dialogs.delete.emailPlaceholder": "Email",
    "dialogs.delete.passwordPlaceholder": "Password",
    "dialogs.delete.emailLabel": "Email",
    "dialogs.delete.passwordLabel": "Password",
    "dialogs.delete.confirmWarning": "This can't be undone. Press again to delete your account.",
    "dialogs.delete.deleting": "Deleting...",
    "dialogs.delete.confirmButton": "Yes, delete my account",
    "dialogs.delete.button": "Delete my account",
    "dialogs.delete.forgotHint": 'Forgot your password? Use "Forgot password?" in the login box first, then come back here.',
    "dialogs.delete.cancel": "Cancel",

    // Age gate (ID check)
    "dialogs.ageGate.title": "Hello, can we ask for ID?",
    "dialogs.ageGate.body":
      "In the eyes of many, we are very age-obsessed. And we can only agree. Asking for ID is part of our work to protect young people from alcohol.\n\nThis website contains information about alcohol. To visit it or shop, you must be 20 years of age or older.",
    "dialogs.ageGate.under20": "I am under 20",
    "dialogs.ageGate.over20": "I have turned 20",
  },
  sv: {
    // Shared
    "dialogs.goHome": "Till startsidan",

    // Auth dialog (login / sign up / forgot password)
    "dialogs.auth.title.login": "Logga in",
    "dialogs.auth.title.signup": "Skapa konto",
    "dialogs.auth.title.forgot": "Glömt lösenord",
    "dialogs.auth.action.login": "Logga in",
    "dialogs.auth.action.signup": "Skapa konto",
    "dialogs.auth.action.forgot": "Skicka återställningslänk",
    "dialogs.auth.loading": "Laddar...",
    "dialogs.auth.nicknamePlaceholder": "Smeknamn (visas på topplistan)",
    "dialogs.auth.emailPlaceholder": "E-post",
    "dialogs.auth.passwordPlaceholder": "Lösenord",
    "dialogs.auth.resetNotice": "Om det finns ett konto för den e-postadressen är en återställningslänk på väg. Den gäller i en timme.",
    "dialogs.auth.forgotLink": "Glömt lösenord?",
    "dialogs.auth.switchToLogin": "Har du redan ett konto? Logga in",
    "dialogs.auth.backToLogin": "Tillbaka till inloggning",
    "dialogs.auth.switchToSignup": "Behöver du ett konto? Skapa konto",
    "dialogs.auth.close": "Stäng",

    // Reset password page
    "dialogs.reset.title": "Nytt lösenord",
    "dialogs.reset.done": "Ditt lösenord är ändrat. Logga in med det från startsidan.",
    "dialogs.reset.placeholder": "Minst 8 tecken",
    "dialogs.reset.saving": "Sparar...",
    "dialogs.reset.submit": "Spara nytt lösenord",
    "dialogs.reset.missingToken": "Den här länken saknar sin kod. Begär ett nytt återställningsmejl.",

    // Delete account page
    "dialogs.delete.title": "Radera konto",
    "dialogs.delete.done": "Ditt konto är raderat, tillsammans med ditt smeknamn, sparade framsteg och teman. Du kan fortsätta spela utloggad.",
    "dialogs.delete.intro": "Det här raderar ditt Dokubolaget-konto för gott: din e-post, ditt smeknamn, lösenord, upplåsta teman och sparade framsteg. Det tas bort direkt, och från våra säkerhetskopior inom 7 dagar.",
    "dialogs.delete.emailPlaceholder": "E-post",
    "dialogs.delete.passwordPlaceholder": "Lösenord",
    "dialogs.delete.emailLabel": "E-post",
    "dialogs.delete.passwordLabel": "Lösenord",
    "dialogs.delete.confirmWarning": "Det här kan inte ångras. Tryck igen för att radera ditt konto.",
    "dialogs.delete.deleting": "Raderar...",
    "dialogs.delete.confirmButton": "Ja, radera mitt konto",
    "dialogs.delete.button": "Radera mitt konto",
    "dialogs.delete.forgotHint": 'Glömt ditt lösenord? Använd "Glömt lösenord?" i inloggningsrutan först, och kom sedan tillbaka hit.',
    "dialogs.delete.cancel": "Avbryt",

    // Age gate (ID check)
    "dialogs.ageGate.title": "Hej, får vi fråga om leg?",
    "dialogs.ageGate.body":
      "I mångas ögon är vi väldigt åldersfixerade. Och det kan vi bara hålla med om. Att fråga efter leg är en del av vårt arbete för att skydda unga från alkohol.\n\nDen här webbplatsen innehåller information om alkohol. För att besöka den eller handla måste du ha fyllt 20 år.",
    "dialogs.ageGate.under20": "Jag är under 20",
    "dialogs.ageGate.over20": "Jag har fyllt 20",
  },
};
