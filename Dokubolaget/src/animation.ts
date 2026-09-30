import { Platform } from "react-native";

// The native animated driver doesn't exist on web; react-native-web falls
// back to JS but logs a warning each time. Use it only where it exists.
export const USE_NATIVE_DRIVER = Platform.OS !== "web";

// Small seeded PRNG so particle layouts are stable across re-renders.
export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let temp = Math.imul(value ^ (value >>> 15), 1 | value);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), 61 | temp);
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}
