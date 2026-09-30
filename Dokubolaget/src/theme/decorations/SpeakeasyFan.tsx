import { useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";
import type { DecorationProps } from "./registry";

// Art deco sunburst behind the logo, over a faint gold pinstripe.
export function SpeakeasyFan({ screen }: DecorationProps) {
  const { width, height } = useWindowDimensions();
  const baseY = (screen === "board" ? 8 : 40) + 150;
  const cx = width / 2;
  const rays = Array.from({ length: 9 }, (_, i) => ((-70 + i * 17.5) * Math.PI) / 180);
  const stripes = Array.from({ length: Math.ceil(width / 26) }, (_, i) => i * 26);
  return (
    <Svg width={width} height={height}>
      {stripes.map((x) => (
        <Line key={`s${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#d4af37" strokeWidth={1.5} opacity={0.035} />
      ))}
      {rays.map((angle, i) => (
        <Line
          key={`r${i}`}
          x1={cx}
          y1={baseY}
          x2={cx + Math.sin(angle) * 170}
          y2={baseY - Math.cos(angle) * 170}
          stroke="#d4af37"
          strokeWidth={1.5}
          opacity={0.3}
        />
      ))}
    </Svg>
  );
}
