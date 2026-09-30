import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { seededRandom } from "../../animation";
import type { DecorationProps } from "./registry";

// Faint ink specks so the page reads as newsprint rather than flat beige.
export function PaperGrain(_: DecorationProps) {
  const { width, height } = useWindowDimensions();
  const specks = useMemo(() => {
    const random = seededRandom(1986);
    const count = Math.round((width * height) / 380);
    return Array.from({ length: Math.min(count, 1400) }, () => ({
      x: random() * width,
      y: random() * height,
      r: 0.4 + random() * 0.9,
      o: 0.05 + random() * 0.09,
    }));
  }, [width, height]);
  return (
    <Svg width={width} height={height}>
      {specks.map((speck, index) => (
        <Circle key={index} cx={speck.x} cy={speck.y} r={speck.r} fill="#3a3122" opacity={speck.o} />
      ))}
    </Svg>
  );
}
