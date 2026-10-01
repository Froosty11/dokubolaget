import { useEffect, useRef } from "react";
import { Animated, Text, useWindowDimensions, View } from "react-native";
import { USE_NATIVE_DRIVER } from "../../../animation";
import type { KitDecorationProps } from "../registry";

const BARS = ["#c0c0c0", "#c0c000", "#00c0c0", "#00c000", "#c000c0", "#c00000", "#0000c0"];

// A TV test card strip across the top and a blinking ON AIR light.
export function ColorBars({ colors, reducedMotion }: KitDecorationProps) {
  const { width } = useWindowDimensions();
  const light = colors[0] ?? "#d9261c";
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.55, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(blink, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion]);
  return (
    <View style={{ width }}>
      <View style={{ flexDirection: "row", height: 10 }}>
        {BARS.map((color) => (
          <View key={color} style={{ flex: 1, backgroundColor: color }} />
        ))}
      </View>
      <Animated.View
        style={{ position: "absolute", top: 24, right: 18, opacity: blink, backgroundColor: light, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 3 }}
      >
        <Text style={{ color: "#ffffff", fontFamily: "Oswald_700Bold", fontSize: 12, letterSpacing: 1.6 }}>● ON AIR</Text>
      </Animated.View>
    </View>
  );
}
