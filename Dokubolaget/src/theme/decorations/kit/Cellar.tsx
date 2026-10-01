import { useId } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from "react-native-svg";
import type { KitDecorationProps } from "../registry";

// A cellar pub: brick courses on the wall and a lamp hanging over the title.
export function Cellar({ colors }: KitDecorationProps) {
  const { width, height } = useWindowDimensions();
  const [mortar, lamp = mortar] = colors;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const course = 28;
  const brick = 56;
  const lines = [];
  for (let row = 0; row * course < height; row++) {
    const y = row * course;
    lines.push(<Line key={`h${row}`} x1={0} y1={y} x2={width} y2={y} stroke={mortar} strokeWidth={2} />);
    for (let x = row % 2 ? brick / 2 : 0; x < width; x += brick) {
      lines.push(<Line key={`v${row}-${x}`} x1={x} y1={y} x2={x} y2={y + course} stroke={mortar} strokeWidth={2} />);
    }
  }
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`lamp${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={lamp} stopOpacity={0.45} />
            <Stop offset="1" stopColor={lamp} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <G opacity={0.16}>{lines}</G>
        <Circle cx={width / 2} cy={92} r={150} fill={`url(#lamp${uid})`} />
        <Line x1={width / 2} y1={0} x2={width / 2} y2={52} stroke="#1a0c08" strokeWidth={2} />
        <Path d={`M${width / 2 - 18} 70 Q${width / 2} 44 ${width / 2 + 18} 70 Z`} fill="#1a0c08" />
      </Svg>
    </View>
  );
}
