import type { HapticPatternId } from "./packSchema";

// Every theme buzzes its own way. Screens play events; the active theme's
// pattern decides what each event feels like. One switch turns it all off.
export const HAPTIC_EVENTS = ["tap", "correct", "nearMiss", "miss", "complete", "unlock"] as const;
export type HapticEvent = (typeof HAPTIC_EVENTS)[number];

export type Impact = "light" | "medium" | "heavy";
export type Notify = "success" | "warning" | "error";
type Step = { kind: "impact"; style: Impact } | { kind: "notify"; type: Notify } | { kind: "wait"; ms: number };

const L: Step = { kind: "impact", style: "light" };
const M: Step = { kind: "impact", style: "medium" };
const H: Step = { kind: "impact", style: "heavy" };
const OK: Step = { kind: "notify", type: "success" };
const WARN: Step = { kind: "notify", type: "warning" };
const ERR: Step = { kind: "notify", type: "error" };
const w = (ms: number): Step => ({ kind: "wait", ms });
const repeat = (step: Step, times: number, gap: number): Step[] =>
  Array.from({ length: times }, (_, i) => (i === 0 ? [step] : [w(gap), step])).flat();

export const HAPTIC_PATTERNS: Record<HapticPatternId, Record<HapticEvent, Step[]>> = {
  classic: { tap: [M], correct: [OK], nearMiss: [WARN], miss: [ERR], complete: [OK], unlock: [OK, H] },
  receipt: {
    tap: [L], correct: repeat(L, 3, 60), nearMiss: [L, w(120), L], miss: [M],
    complete: [...repeat(L, 5, 50), OK], unlock: [OK, w(80), ...repeat(L, 3, 60)],
  },
  neon: {
    tap: [L], correct: [L, w(70), L], nearMiss: [L, w(70), M], miss: [M, w(70), M],
    complete: [L, w(60), L, w(60), OK], unlock: [H, w(90), L, w(60), L],
  },
  bass: {
    tap: [M], correct: [H], nearMiss: [M, w(90), M], miss: [H, w(120), H],
    complete: [H, w(250), H, w(80), H], unlock: [H, w(120), H, w(120), OK],
  },
  arcade: {
    tap: [L], correct: repeat(L, 3, 50), nearMiss: [L, w(50), M], miss: [ERR],
    complete: [...repeat(L, 4, 40), w(40), H], unlock: [OK, w(60), ...repeat(L, 4, 40)],
  },
  toast: {
    tap: [M], correct: [M, w(140), L], nearMiss: [L, w(140), L], miss: [WARN],
    complete: [M, w(140), L, w(140), OK], unlock: [OK, w(140), L, w(140), L],
  },
};

export type HapticDriver = {
  isWeb: boolean;
  impact(style: Impact): void;
  notify(type: Notify): void;
  vibrate(pattern: number[]): void;
  wait(ms: number): Promise<void>;
};

const WEB_IMPACT: Record<Impact, number> = { light: 10, medium: 20, heavy: 35 };
const WEB_NOTIFY: Record<Notify, number[]> = { success: [15, 40, 15], warning: [25, 60, 25], error: [40, 40, 40] };
const WEB_GAP = 30;

// navigator.vibrate takes alternating on/off durations, starting with on.
function webPattern(steps: Step[]): number[] {
  const out: number[] = [];
  const on = (ms: number) => {
    if (out.length % 2 === 1) out.push(WEB_GAP);
    out.push(ms);
  };
  const off = (ms: number) => {
    if (out.length === 0) out.push(0);
    if (out.length % 2 === 1) out.push(ms);
    else out[out.length - 1] += ms;
  };
  for (const step of steps) {
    if (step.kind === "wait") off(step.ms);
    else if (step.kind === "impact") on(WEB_IMPACT[step.style]);
    else WEB_NOTIFY[step.type].forEach((ms, i) => (i % 2 === 0 ? on(ms) : off(ms)));
  }
  return out;
}

export function createHaptics(driver: HapticDriver, getPattern: () => HapticPatternId) {
  let enabled = true;
  async function run(steps: Step[]) {
    if (!enabled) return;
    if (driver.isWeb) {
      driver.vibrate(webPattern(steps));
      return;
    }
    for (const step of steps) {
      if (step.kind === "wait") await driver.wait(step.ms);
      else if (step.kind === "impact") driver.impact(step.style);
      else driver.notify(step.type);
    }
  }
  return {
    play: (event: HapticEvent) => run(HAPTIC_PATTERNS[getPattern()][event]),
    playPattern: (pattern: HapticPatternId, event: HapticEvent) => run(HAPTIC_PATTERNS[pattern][event]),
    setEnabled(on: boolean) {
      enabled = on;
    },
    get enabled() {
      return enabled;
    },
  };
}
