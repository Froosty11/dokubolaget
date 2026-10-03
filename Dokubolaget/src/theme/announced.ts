// Earned themes are granted by the server; the device remembers which ones it
// has shown the "New theme unlocked" card for, so an unlock earned on another
// device (or lost when the app closed) is still announced, once.
const EARNED = ["cyberwave", "speakeasy", "modern"];

export function unannounced(unlocked: string[], announced: string[] | null) {
  if (announced === null) return { announce: [], remember: [...unlocked] };
  const announce = unlocked.filter((id) => EARNED.includes(id) && !announced.includes(id));
  return { announce, remember: [...new Set([...announced, ...unlocked])] };
}
