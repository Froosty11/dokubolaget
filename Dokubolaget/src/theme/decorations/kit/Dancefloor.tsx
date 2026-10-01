import { useEffect, useId, useState } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Defs, LinearGradient, Polygon, Stop } from "react-native-svg";
import type { KitDecorationProps } from "../registry";

const ROWS = 6;
const COLS = 8;

// A lit dance floor in perspective along the bottom, its tiles cycling
// through the theme's colours, with two light beams from above.
export function Dancefloor({ colors, reducedMotion }: KitDecorationProps) {
  const { width, height } = useWindowDimensions();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reducedMotion) return;
    const timer = setInterval(() => setStep((s) => s + 1), 1200);
    return () => clearInterval(timer);
  }, [reducedMotion]);

  // Low enough to stay clear of the text above it.
  const top = height * 0.8;
  const bottom = height;
  const rowY = (r: number) => top + (bottom - top) * (r / ROWS) ** 1.6;
  // The floor widens towards the viewer.
  const xAt = (c: number, y: number) => {
    const t = (y - top) / (bottom - top);
    const left = width * (0.12 - 0.4 * t);
    const right = width * (0.88 + 0.4 * t);
    return left + ((right - left) * c) / COLS;
  };

  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const y0 = rowY(r);
      const y1 = rowY(r + 1);
      const points = `${xAt(c, y0) + 1},${y0 + 1} ${xAt(c + 1, y0) - 1},${y0 + 1} ${xAt(c + 1, y1) - 1},${y1 - 1} ${xAt(c, y1) + 1},${y1 - 1}`;
      const color = colors[(r * 3 + c * 5 + step) % colors.length];
      tiles.push(<Polygon key={`${r}-${c}`} points={points} fill={color} opacity={0.4} />);
    }
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`beam${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors[0]} stopOpacity={0.35} />
            <Stop offset="1" stopColor={colors[0]} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Polygon points={`${width * 0.05},0 ${width * 0.2},0 ${width * 0.55},${top} ${width * 0.25},${top}`} fill={`url(#beam${uid})`} />
        <Polygon points={`${width * 0.8},0 ${width * 0.95},0 ${width * 0.75},${top} ${width * 0.45},${top}`} fill={`url(#beam${uid})`} />
        {tiles}
      </Svg>
    </View>
  );
}
