import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Canonical public URL for absolute Open Graph tags (link previews need
// absolute image/url). The API and proxy stay relative/domain-agnostic; only
// the social meta needs the real origin, so it's baked at build time and
// defaults to production.
const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL || "https://dokubolaget.se").replace(/\/+$/, "");
const OG_DESCRIPTION = "Dagens 3×3-utmaning: hitta Systembolagsprodukter som matchar två kategorier.";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

// Root HTML for the static web export. Runs only at build time on web.
// Adds the bits that make the site installable as a home-screen app on
// iOS and Android: manifest, theme colour, Apple touch icon and a
// no-op service worker (see public/sw.js).
export default function Root({ children }: PropsWithChildren) {
  return (
    // t_light on <html>: Tamagui's light-theme CSS is keyed to :root.t_light.
    // Without it, an OS in dark mode turns portal-rendered dialogs dark while
    // the rest of the (light-only) app stays light.
    <html lang="sv" className="t_light">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Dokubolaget</title>
        <meta name="description" content={OG_DESCRIPTION} />

        {/* Open Graph / Twitter: the card shown when the link is pasted into
            Discord, iMessage, Slack, etc. Image and URL must be absolute. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Dokubolaget" />
        <meta property="og:title" content="Dokubolaget" />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Dokubolaget" />
        <meta property="og:locale" content="sv_SE" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Dokubolaget" />
        <meta name="twitter:description" content={OG_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#f1e9d2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Dokubolaget" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body { background-color: #f1e9d2; }`;

const registerServiceWorker = `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
// Capture the install prompt before React mounts so the post-board nudge can
// trigger it later (the event only fires once, early). Cleared once installed.
window.addEventListener("beforeinstallprompt", function (e) {
  e.preventDefault();
  window.__bip = e;
});
window.addEventListener("appinstalled", function () {
  window.__bip = null;
});`;
