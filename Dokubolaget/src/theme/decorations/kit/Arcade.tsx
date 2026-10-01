import { Text, useWindowDimensions, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import type { KitDecorationProps } from "../registry";

// An arcade cabinet screen: faint scanlines, a double pixel frame and a
// clock badge stuck at 17:17.
export function Arcade({ colors }: KitDecorationProps) {
  const { width, height } = useWindowDimensions();
  const [frame, badge = frame] = colors;
  const lines = Array.from({ length: Math.ceil(height / 4) }, (_, i) => (
    <Rect key={i} x={0} y={i * 4} width={width} height={2} fill="#ffffff" opacity={0.035} />
  ));
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {lines}
        <Rect x={8} y={8} width={width - 16} height={height - 16} fill="none" stroke={frame} strokeWidth={4} opacity={0.3} />
        <Rect x={16} y={16} width={width - 32} height={height - 32} fill="none" stroke={badge} strokeWidth={2} opacity={0.2} />
      </Svg>
      <View style={{ position: "absolute", top: 20, right: 22, borderWidth: 2, borderColor: badge, backgroundColor: "#000000", paddingHorizontal: 6, paddingVertical: 4 }}>
        <Text style={{ color: badge, fontFamily: "PressStart2P_400Regular", fontSize: 10 }}>17:17</Text>
      </View>
    </View>
  );
}
