import { useEffect, useId, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Rect, Stop } from "react-native-svg";
import { USE_NATIVE_DRIVER } from "../../animation";
import type { DecorationProps } from "./registry";

// Bands cut out of the lower half of the sun, as fractions of its diameter.
const SUN_GAPS: Array<[number, number]> = [[0.52, 0.55], [0.63, 0.67], [0.74, 0.79], [0.85, 0.91]];

// Outrun sky: striped sunset sun on the horizon, a neon perspective grid
// below it and a scan line sweeping towards the viewer.
export function CyberwaveBackdrop({ screen, reducedMotion }: DecorationProps) {
  const { width, height } = useWindowDimensions();
  // SVG ids are global on web; Home and Play are both mounted, so each
  // instance needs its own or one screen's clip path leaks into the other.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { sky: `cwSky${uid}`, sun: `cwSun${uid}`, bands: `cwSunBands${uid}` };
  const horizon = height * (screen === "board" ? 0.26 : 0.4);
  const radius = Math.min(width, horizon) * 0.32;
  const cx = width / 2;
  const top = horizon - radius * 2;

  // Solid rows of the sun between the gaps.
  const bands: Array<[number, number]> = [];
  let start = 0;
  for (const [a, b] of SUN_GAPS) {
    bands.push([start, a]);
    start = b;
  }
  bands.push([start, 1]);

  const verticals = Array.from({ length: 11 }, (_, i) => i - 5);
  const horizontals = Array.from({ length: 9 }, (_, k) => horizon + (height - horizon) * ((k + 1) / 9) ** 2);

  const scan = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.timing(scan, { toValue: 1, duration: 3200, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={ids.sky} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0b0221" />
            <Stop offset="0.6" stopColor="#1d0442" />
            <Stop offset="1" stopColor="#43095e" />
          </LinearGradient>
          <LinearGradient id={ids.sun} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ffe45e" />
            <Stop offset="0.45" stopColor="#ff8a3d" />
            <Stop offset="1" stopColor="#ff2e88" />
          </LinearGradient>
          <ClipPath id={ids.bands}>
            {bands.map(([a, b], i) => (
              <Rect key={i} x={cx - radius} y={top + a * radius * 2} width={radius * 2} height={(b - a) * radius * 2} />
            ))}
          </ClipPath>
        </Defs>
        <Rect x={0} y={0} width={width} height={horizon} fill={`url(#${ids.sky})`} />
        <G clipPath={`url(#${ids.bands})`}>
          <Circle cx={cx} cy={top + radius} r={radius} fill={`url(#${ids.sun})`} />
        </G>
        {verticals.map((i) => (
          <Line key={`v${i}`} x1={cx + i * width * 0.12} y1={horizon} x2={cx + i * width * 0.55} y2={height} stroke="#ff2ec4" strokeWidth={1} opacity={0.45} />
        ))}
        {horizontals.map((y, k) => (
          <Line key={`h${k}`} x1={0} y1={y} x2={width} y2={y} stroke="#ff2ec4" strokeWidth={1} opacity={0.45} />
        ))}
        <Line x1={0} y1={horizon} x2={width} y2={horizon} stroke="#ff5fd2" strokeWidth={2} />
      </Svg>
      {reducedMotion ? null : (
        <Animated.View
          style={{
            position: "absolute", left: 0, right: 0, height: 2, top: 0,
            backgroundColor: "#ff2ec4", opacity: 0.7,
            shadowColor: "#ff2ec4", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
            transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [horizon, height] }) }],
          }}
        />
      )}
    </View>
  );
}
