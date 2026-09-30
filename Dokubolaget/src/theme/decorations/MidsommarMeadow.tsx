import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { DecorationProps } from "./registry";

// Summer sky, sun and rolling meadow across the top of the screen.
export function MidsommarMeadow({ screen }: DecorationProps) {
  const { width, height } = useWindowDimensions();
  const skyHeight = height * (screen === "board" ? 0.2 : 0.3);
  const hillHeight = Math.max(60, height * 0.09);
  return (
    <View style={{ width, height: skyHeight + hillHeight }}>
      <Svg width={width} height={skyHeight}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#bfe0f5" />
            <Stop offset="1" stopColor="#e3f1f9" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={skyHeight} fill="url(#sky)" />
        <Circle cx={width - 64} cy={Math.min(90, skyHeight * 0.45)} r={42} fill="#ffd23f" opacity={0.15} />
        <Circle cx={width - 64} cy={Math.min(90, skyHeight * 0.45)} r={34} fill="#ffd23f" opacity={0.35} />
        <Circle cx={width - 64} cy={Math.min(90, skyHeight * 0.45)} r={26} fill="#ffd23f" />
      </Svg>
      <Svg width={width} height={hillHeight} viewBox="0 0 390 80" preserveAspectRatio="none" style={{ marginTop: -1 }}>
        <Rect x={0} y={0} width={390} height={80} fill="#e3f1f9" />
        <Path d="M0 50 Q60 20 120 42 T250 38 T390 30 V80 H0Z" fill="#8cc59a" />
        <Path d="M0 62 Q90 40 180 58 T390 50 V80 H0Z" fill="#5ea56f" />
        <Rect x={0} y={78} width={390} height={2} fill="#fbf6e4" />
        {[
          [30, 66, "#c8102e"], [72, 60, "#c8102e"], [140, 68, "#c8102e"],
          [50, 70, "#ffd23f"], [210, 66, "#ffd23f"], [350, 62, "#ffd23f"],
        ].map(([x, y, color], index) => (
          <Circle key={index} cx={x as number} cy={y as number} r={3} fill={color as string} />
        ))}
      </Svg>
    </View>
  );
}
