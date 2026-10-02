// A game day runs from 04:00 to 04:00 Swedish time, so a night out counts as
// one day. Shared by the app and the server; pure (uses Intl only).
const ZONE = "Europe/Stockholm";
const ROLLOVER_HOUR = 4;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
});

function localParts(at: Date) {
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(at)) parts[part.type] = part.value;
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute, s: +parts.second };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

export function gameDay(now: Date = new Date()): string {
  const p = localParts(now);
  const local = `${p.y}-${pad(p.m)}-${pad(p.d)}`;
  return p.h < ROLLOVER_HOUR ? addDays(local, -1) : local;
}

// Minutes Stockholm is ahead of UTC at that instant (60 or 120).
function offsetMinutes(at: Date): number {
  const p = localParts(at);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - at.getTime()) / 60_000);
}

// The moment `day` ends: 04:00 Stockholm on the following date.
export function rolloverInstant(day: string): Date {
  const [y, m, d] = addDays(day, 1).split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, ROLLOVER_HOUR, 0, 0);
  let instant = naive - offsetMinutes(new Date(naive)) * 60_000;
  instant = naive - offsetMinutes(new Date(instant)) * 60_000;
  return new Date(instant);
}

export function nextRollover(now: Date = new Date()): Date {
  return rolloverInstant(gameDay(now));
}

export function weekStart(day: string): string {
  const weekday = (new Date(`${day}T00:00:00.000Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -weekday);
}

export function formatShortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
