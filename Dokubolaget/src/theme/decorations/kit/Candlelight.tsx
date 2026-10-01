import { useEffect, useId, useRef } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { USE_NATIVE_DRIVER } from "../../../animation";
import type { KitDecorationProps } from "../registry";

function Candle({ left, top, height, glow, reducedMotion }: { left: number; top: number; height: number; glow: string; reducedMotion: boolean }) {
  const flicker = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 0.7, duration: 380 + Math.random() * 200, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(flicker, { toValue: 1, duration: 420 + Math.random() * 200, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion]);
  return (
    <View style={{ position: "absolute", left, top }}>
      <Animated.View style={{ width: 14, height: 18, marginLeft: -2, borderRadius: 7, backgroundColor: glow, opacity: flicker, transform: [{ scaleY: flicker }] }} />
      <View style={{ width: 10, height, borderRadius: 3, backgroundColor: "#f6eedb" }} />
    </View>
  );
}

// Gasque table: two candles with warm glows at the top of the screen.
export function Candlelight({ colors, reducedMotion }: KitDecorationProps) {
  const { width } = useWindowDimensions();
  const glow = colors[0] ?? "#f2c46d";
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View style={{ width, height: 260 }}>
      <Svg width={width} height={260}>
        <Defs>
          <RadialGradient id={`glow${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.3} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={34} cy={110} r={120} fill={`url(#glow${uid})`} />
        <Circle cx={width - 34} cy={120} r={120} fill={`url(#glow${uid})`} />
      </Svg>
      <Candle left={26} top={86} height={46} glow={glow} reducedMotion={reducedMotion} />
      <Candle left={width - 40} top={92} height={38} glow={glow} reducedMotion={reducedMotion} />
    </View>
  );
}
