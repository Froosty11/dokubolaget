import { useEffect, useRef } from "react";
import { Animated, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { KitDecorationProps } from "../registry";

// Copper traces in the corners of a circuit board, with a pulse running
// along the top one.
export function Circuit({ colors, reducedMotion }: KitDecorationProps) {
  const { width, height } = useWindowDimensions();
  const [trace, pulse = trace] = colors;
  const run = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(Animated.timing(run, { toValue: 1, duration: 2600, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [reducedMotion]);
  const top = 70;
  const bottom = height - 120;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} opacity={0.4}>
        <Path d={`M0 ${top} H70 L95 ${top + 25} H${width * 0.42}`} stroke={trace} strokeWidth={2} fill="none" />
        <Circle cx={width * 0.42} cy={top + 25} r={4} fill={trace} />
        <Path d={`M${width} ${top - 20} H${width - 70} L${width - 90} ${top} H${width - 140}`} stroke={trace} strokeWidth={2} fill="none" />
        <Circle cx={width - 140} cy={top} r={4} fill={trace} />
        <Path d={`M0 ${bottom} H40 L60 ${bottom - 20} H120`} stroke={trace} strokeWidth={2} fill="none" />
        <Circle cx={120} cy={bottom - 20} r={4} fill={trace} />
        <Path d={`M${width} ${bottom + 20} H${width - 60} L${width - 80} ${bottom} H${width - 110}`} stroke={trace} strokeWidth={2} fill="none" />
        <Circle cx={width - 110} cy={bottom} r={4} fill={trace} />
      </Svg>
      {reducedMotion ? null : (
        <Animated.View
          style={{
            position: "absolute",
            top: top + 25 - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: pulse,
            left: run.interpolate({ inputRange: [0, 1], outputRange: [95, width * 0.42 - 4] }),
          }}
        />
      )}
    </View>
  );
}
