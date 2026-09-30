import { useWindowDimensions } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import type { DecorationProps } from "./registry";

// Maypole with two wreaths, drawn above the Midsommar celebration card.
export function Maypole(_: DecorationProps) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 48, 360);
  return (
    <Svg width={w} height={(w * 170) / 390} viewBox="0 0 390 170">
      <Rect x={192} y={20} width={6} height={150} fill="#1f3a5f" />
      <Rect x={130} y={54} width={130} height={6} rx={3} fill="#1f3a5f" />
      <Rect x={149} y={57} width={2} height={5} fill="#1f3a5f" />
      <Rect x={239} y={57} width={2} height={5} fill="#1f3a5f" />
      <Circle cx={150} cy={82} r={20} fill="none" stroke="#2e6b3e" strokeWidth={7} strokeDasharray="5 3" />
      <Circle cx={240} cy={82} r={20} fill="none" stroke="#2e6b3e" strokeWidth={7} strokeDasharray="5 3" />
      <Circle cx={195} cy={16} r={6} fill="#c8102e" />
      <Circle cx={133} cy={74} r={4} fill="#c8102e" />
      <Circle cx={257} cy={90} r={4} fill="#c8102e" />
      <Circle cx={165} cy={98} r={4} fill="#ffd23f" />
      <Circle cx={225} cy={68} r={4} fill="#ffd23f" />
    </Svg>
  );
}
