import { describe, expect, test } from "bun:test";
import { HAPTIC_PATTERN_IDS, type HapticPatternId } from "./packSchema";
import { HAPTIC_EVENTS, HAPTIC_PATTERNS, createHaptics, type HapticDriver } from "./hapticPatterns";

function fakeDriver(isWeb = false) {
  const calls: string[] = [];
  const driver: HapticDriver = {
    isWeb,
    impact: (style) => void calls.push(`impact:${style}`),
    notify: (type) => void calls.push(`notify:${type}`),
    vibrate: (pattern) => void calls.push(`vibrate:${pattern.join(",")}`),
    wait: async (ms) => void calls.push(`wait:${ms}`),
  };
  return { driver, calls };
}

describe("haptics", () => {
  test("classic plays what the app played before", async () => {
    const { driver, calls } = fakeDriver();
    const haptics = createHaptics(driver, () => "classic");
    for (const event of ["tap", "correct", "nearMiss", "miss"] as const) await haptics.play(event);
    expect(calls).toEqual(["impact:medium", "notify:success", "notify:warning", "notify:error"]);
  });

  test("the active theme's pattern is used, with waits between steps", async () => {
    const { driver, calls } = fakeDriver();
    let pattern: HapticPatternId = "classic";
    const haptics = createHaptics(driver, () => pattern);
    pattern = "bass";
    await haptics.play("complete");
    expect(calls).toEqual(["impact:heavy", "wait:250", "impact:heavy", "wait:80", "impact:heavy"]);
  });

  test("switched off, nothing plays", async () => {
    const { driver, calls } = fakeDriver();
    const haptics = createHaptics(driver, () => "bass");
    haptics.setEnabled(false);
    await haptics.play("complete");
    await haptics.playPattern("neon", "unlock");
    expect(calls).toEqual([]);
    expect(haptics.enabled).toBe(false);
  });

  test("on the web a pattern becomes one vibrate call", async () => {
    const { driver, calls } = fakeDriver(true);
    await createHaptics(driver, () => "bass").play("complete");
    expect(calls).toEqual(["vibrate:35,250,35,80,35"]);
  });

  test("on the web, notifications and back-to-back taps keep a gap", async () => {
    const { driver, calls } = fakeDriver(true);
    const haptics = createHaptics(driver, () => "classic");
    await haptics.play("correct");
    await haptics.playPattern("receipt", "complete");
    expect(calls[0]).toBe("vibrate:15,40,15");
    expect(calls[1]).toBe("vibrate:10,50,10,50,10,50,10,50,10,30,15,40,15");
  });

  test("every pattern has every event", () => {
    for (const id of HAPTIC_PATTERN_IDS) {
      for (const event of HAPTIC_EVENTS) expect(HAPTIC_PATTERNS[id][event].length).toBeGreaterThan(0);
    }
  });
});
