import { useEffect, useRef } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { USE_NATIVE_DRIVER } from "../../../animation";
import type { KitDecorationProps } from "../registry";

// One wave band: a sine-ish path two screens wide, so sliding it left by one
// screen loops seamlessly.
function wavePath(width: number, height: number, amplitude: number, waves: number) {
  const span = width * 2;
  const step = width / waves;
  let d = `M0 ${amplitude}`;
  for (let x = 0; x < span; x += step) {
    d += ` Q${x + step / 4} 0 ${x + step / 2} ${amplitude} T${x + step} ${amplitude}`;
  }
  return `${d} V${height} H0 Z`;
}

// Night sea: stars, a pirate ship crossing the horizon and rolling waves in
// the theme's colours along the bottom.
export function Seas({ colors, reducedMotion }: KitDecorationProps) {
  const { width, height } = useWindowDimensions();
  const [sea, foam = sea, sky = foam] = colors;
  const roll = useRef(new Animated.Value(0)).current;
  const sail = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const waves = Animated.loop(Animated.timing(roll, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }));
    const ship = Animated.loop(Animated.timing(sail, { toValue: 1, duration: 60000, easing: Easing.linear, useNativeDriver: USE_NATIVE_DRIVER }));
    waves.start();
    ship.start();
    return () => {
      waves.stop();
      ship.stop();
    };
  }, [reducedMotion]);

  const seaTop = height * 0.84;
  const bandHeight = height - seaTop;
  const stars = Array.from({ length: 22 }, (_, i) => ({ x: ((i * 97) % 100) / 100, y: ((i * 53) % 100) / 100 }));
  const band = (offset: number, opacity: number, amplitude: number, speed: number, color: string) => (
    <Animated.View
      style={{
        position: "absolute", left: 0, top: seaTop + offset, opacity,
        transform: [{ translateX: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -width * speed] }) }],
      }}
    >
      <Svg width={width * 2} height={bandHeight}>
        <Path d={wavePath(width, bandHeight, amplitude, 3)} fill={color} />
      </Svg>
    </Animated.View>
  );

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={seaTop} style={{ position: "absolute" }}>
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x * width} cy={s.y * seaTop * 0.7} r={i % 4 === 0 ? 1.6 : 1} fill={sky} opacity={0.55} />
        ))}
      </Svg>
      <Animated.View
        style={{
          position: "absolute", top: seaTop - 34, left: 0,
          transform: [{ translateX: sail.interpolate({ inputRange: [0, 1], outputRange: [-70, width + 10] }) }],
        }}
      >
        <Svg width={60} height={44} opacity={0.75}>
          <Path d="M6 32 H54 L46 42 H14 Z" fill={foam} />
          <Path d="M29 4 V32" stroke={foam} strokeWidth={2} />
          <Path d="M31 6 L48 18 L31 26 Z" fill={foam} />
          <Path d="M27 10 L14 22 L27 28 Z" fill={foam} />
          <Path d="M29 4 L36 6 L29 8 Z" fill={sky} />
        </Svg>
      </Animated.View>
      {band(0, 0.35, 10, 0.5, sea)}
      {band(14, 0.55, 12, 1, sea)}
      {band(30, 0.8, 9, 0.75, foam)}
    </View>
  );
}
