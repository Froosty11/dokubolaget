import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Root HTML for the static web export. Runs only at build time on web.
// Adds the bits that make the site installable as a home-screen app on
// iOS and Android: manifest, theme colour, Apple touch icon and a
// no-op service worker (see public/sw.js).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="sv">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Dokubolaget</title>
        <meta
          name="description"
          content="Dagens 3x3-utmaning: hitta Systembolagsprodukter som matchar två kategorier."
        />

        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#007a33" />
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
body { background-color: #f3f3f1; }`;

const registerServiceWorker = `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}`;
