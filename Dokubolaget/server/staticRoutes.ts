import { existsSync, readdirSync, statSync } from "fs";
import { dirname, join, normalize, sep } from "path";

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

// Maps a URL path to a file in the static web export. Pages are exported as
// name.html; dynamic routes as [param].html (e.g. scan/[code].html for
// /scan/<code>). Anything else gets the shell page, where expo-router takes
// over. Null for paths that try to leave the export folder.
export function resolveStaticFile(distDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const base = join(distDir, normalize(decoded));
  if (base !== distDir && !base.startsWith(distDir + sep)) return null;

  for (const candidate of [base, `${base}.html`, join(base, "index.html")]) {
    if (isFile(candidate)) return candidate;
  }

  // A dynamic route in the same folder, e.g. scan/[code].html.
  const parent = dirname(base);
  if (parent.startsWith(distDir) && existsSync(parent) && statSync(parent).isDirectory()) {
    const dynamic = readdirSync(parent).find((name) => /^\[[^\]]+\]\.html$/.test(name));
    if (dynamic) return join(parent, dynamic);
  }

  const fallback = join(distDir, "index.html");
  return existsSync(fallback) ? fallback : null;
}
