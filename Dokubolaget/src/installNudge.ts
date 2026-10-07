// Decides whether to nudge a web visitor to add the app to their home screen.
// Shown once, after they finish a board. Native builds are already apps and
// never nudge. Kept free of react-native imports so it stays unit-testable; the
// component passes in isWeb (from Platform) and the DOM-derived signals below.

export type InstallEnv = {
  isWeb: boolean;
  standalone: boolean; // already installed / running full-screen
  isIOS: boolean; // iOS Safari has no install prompt event; needs manual Share steps
  canPrompt: boolean; // a beforeinstallprompt event was captured (Android/desktop Chrome)
  dismissed: boolean; // the visitor already dismissed or installed
};

export type InstallNudge = "prompt" | "ios" | "none";

export const INSTALL_NUDGE_KEY = "dokubolaget.installNudgeDismissed";

export function chooseInstallNudge(env: InstallEnv): InstallNudge {
  if (!env.isWeb || env.standalone || env.dismissed) return "none";
  if (env.canPrompt) return "prompt";
  if (env.isIOS) return "ios";
  return "none";
}

// Whether the page is already running as an installed app.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  // navigator.standalone is the iOS-specific signal.
  return Boolean(mql?.matches) || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports as Mac; the touch-point check catches it.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
