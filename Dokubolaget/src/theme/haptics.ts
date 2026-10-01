import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { createHaptics, type HapticDriver, type Impact, type Notify } from "./hapticPatterns";
import type { HapticPatternId } from "./packSchema";

export type { HapticEvent } from "./hapticPatterns";

const IMPACT_STYLE: Record<Impact, Haptics.ImpactFeedbackStyle> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
};
const NOTIFY_TYPE: Record<Notify, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  warning: Haptics.NotificationFeedbackType.Warning,
  error: Haptics.NotificationFeedbackType.Error,
};

const realDriver: HapticDriver = {
  isWeb: Platform.OS === "web",
  impact: (style) => void Haptics.impactAsync(IMPACT_STYLE[style]).catch(() => {}),
  notify: (type) => void Haptics.notificationAsync(NOTIFY_TYPE[type]).catch(() => {}),
  // Android browsers vibrate; iPhone browsers have no vibration API.
  vibrate: (pattern) => {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (nav && typeof nav.vibrate === "function") nav.vibrate(pattern);
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Set by ThemeProvider whenever the active theme changes.
let activePattern: HapticPatternId = "classic";
export function setActiveHapticPattern(pattern: HapticPatternId) {
  activePattern = pattern;
}

export const haptics = createHaptics(realDriver, () => activePattern);

const HAPTICS_KEY = "dokubolaget.haptics";

export async function loadHapticsSetting(): Promise<boolean> {
  if (Platform.OS === "web" && typeof window === "undefined") return haptics.enabled;
  try {
    haptics.setEnabled((await AsyncStorage.getItem(HAPTICS_KEY)) !== "off");
  } catch {}
  return haptics.enabled;
}

export function saveHapticsSetting(on: boolean) {
  haptics.setEnabled(on);
  AsyncStorage.setItem(HAPTICS_KEY, on ? "on" : "off").catch((error) => console.warn("Vibration setting write failed:", error));
}
