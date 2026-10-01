import { useId } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";
import { useTheme } from "../../ThemeProvider";
import type { KitDecorationProps } from "../registry";

// An eight-point compass rose at (cx, cy).
function Compass({ cx, cy, r, ink, accent }: { cx: number; cy: number; r: number; ink: string; accent: string }) {
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const len = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.62 : r * 0.34;
    return `${cx + Math.cos(angle) * len},${cy + Math.sin(angle) * len}`;
  });
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r * 0.78} stroke={ink} strokeWidth={1} fill="none" opacity={0.6} />
      <Circle cx={cx} cy={cy} r={r * 0.7} stroke={ink} strokeWidth={0.6} fill="none" opacity={0.5} />
      <Path d={`M${points.join(" L")} Z`} fill={accent} opacity={0.85} />
      <Path d={`M${cx},${cy - r} L${cx + r * 0.12},${cy} L${cx},${cy + r} L${cx - r * 0.12},${cy} Z`} fill={ink} opacity={0.8} />
      <SvgText x={cx} y={cy - r - 4} fontSize={11} fill={ink} textAnchor="middle" fontWeight="bold">N</SvgText>
    </G>
  );
}

// "A map of the liquor sea": an old sea chart on aged paper. Rhumb lines
// from a compass rose, islands named after drinks, a dotted course to an X.
export function SeaChart({ colors }: KitDecorationProps) {
  const { width, height } = useWindowDimensions();
  const { theme } = useTheme();
  const [accent, ink = theme.colors.inkMuted] = colors;
  const font = theme.fonts.display;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const compass = { x: width * 0.84, y: 108 };
  // Just above the tab bar: the only band that stays clear of the screen's
  // text on short screens (Mobile Safari's bars take ~150 px).
  const floor = height - 80;

  const rhumbs = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8;
    const reach = Math.hypot(width, height);
    return (
      <Line key={i} x1={compass.x} y1={compass.y} x2={compass.x + Math.cos(angle) * reach} y2={compass.y + Math.sin(angle) * reach}
        stroke={accent} strokeWidth={0.6} opacity={0.18} />
    );
  });

  // Hatching along a coast: short strokes just outside the shoreline.
  const hatch = (cx: number, cy: number, rx: number, ry: number) =>
    Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      return <Line key={i} x1={x} y1={y} x2={x + Math.cos(a) * 7} y2={y + Math.sin(a) * 5} stroke={ink} strokeWidth={0.8} opacity={0.45} />;
    });

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`age${uid}`} cx="50%" cy="45%" r="75%">
            <Stop offset="0.55" stopColor={ink} stopOpacity={0} />
            <Stop offset="1" stopColor={ink} stopOpacity={0.28} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#age${uid})`} />
        {rhumbs}
        <Compass cx={compass.x} cy={compass.y} r={34} ink={ink} accent={accent} />

        {/* Glöggholmen, top left */}
        <Path d={`M14 ${118} q18 -26 44 -10 q22 14 6 34 q-22 18 -44 4 q-14 -10 -6 -28 Z`} fill={ink} opacity={0.12} stroke={ink} strokeWidth={1.2} />
        {hatch(40, 128, 34, 24)}
        <SvgText x={40} y={176} fontSize={11} fill={ink} textAnchor="middle" fontFamily={font} opacity={0.75}>Glöggholmen</SvgText>

        {/* Vinön, bottom left, and Kap Punsch, bottom right, just above the tab bar */}
        <Path d={`M-10 ${floor - 34} q40 -26 92 -10 q36 14 20 44 l-112 6 Z`} fill={ink} opacity={0.12} stroke={ink} strokeWidth={1.2} />
        {hatch(36, floor - 8, 58, 26)}
        <SvgText x={42} y={floor - 10} fontSize={12} fill={ink} textAnchor="middle" fontFamily={font} opacity={0.8}>Vinön</SvgText>
        <Path d={`M${width + 10} ${floor - 40} q-52 -4 -64 26 q-6 18 10 30 l54 2 Z`} fill={ink} opacity={0.12} stroke={ink} strokeWidth={1.2} />
        {hatch(width - 22, floor - 10, 42, 26)}
        <SvgText x={width - 36} y={floor - 14} fontSize={11} fill={ink} textAnchor="middle" fontFamily={font} opacity={0.8}>Kap Punsch</SvgText>

        {/* The course, a low arc from Vinön to the X */}
        <Path d={`M96 ${floor - 16} Q ${width / 2} ${floor - 46}, ${width - 112} ${floor - 18}`}
          stroke={accent} strokeWidth={2} strokeDasharray="6 6" fill="none" opacity={0.9} />
        <G opacity={0.95}>
          <Line x1={width - 112} y1={floor - 26} x2={width - 96} y2={floor - 10} stroke={accent} strokeWidth={3} />
          <Line x1={width - 96} y1={floor - 26} x2={width - 112} y2={floor - 10} stroke={accent} strokeWidth={3} />
        </G>

        {/* The sea's name, set sideways along the left edge like a chart label */}
        <SvgText
          x={0} y={0} fontSize={13} fill={ink} textAnchor="middle" fontFamily={font} letterSpacing={7} opacity={0.5}
          transform={`translate(11 ${height * 0.5}) rotate(-90)`}
        >
          SPRITSJÖN
        </SvgText>
      </Svg>
    </View>
  );
}
