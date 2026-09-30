import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { USE_NATIVE_DRIVER } from "../animation";
import { Confetti } from "../components/Confetti";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { ThemeCelebrationArt } from "../theme/decorations/ThemeBackdrop";

type BoardCompleteViewProps = {
  filledCount: number;
  shareGrid: string[];
  shareStatus: "idle" | "shared" | "copied" | "failed";
  // "A1 7412 Marqués de Vargas" per solved cell, for the receipt layout.
  receiptLines: string[];
  onShare: () => void;
  onClose: () => void;
};

export function BoardCompleteView(props: Readonly<BoardCompleteViewProps>) {
  const { width, height } = useWindowDimensions();
  const { theme, copy } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const card = useRef(new Animated.Value(0)).current;
  const count = useRef(new Animated.Value(0)).current;
  const [shownCount, setShownCount] = useState(0);
  const [confettiSeed] = useState(() => Math.floor(Math.random() * 1e9));

  useEffect(() => {
    Animated.spring(card, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
    const id = count.addListener(({ value }) => setShownCount(Math.round(value)));
    Animated.timing(count, {
      toValue: props.filledCount,
      duration: 1100,
      delay: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => count.removeListener(id);
  }, []);

  const shareLabel =
    props.shareStatus === "copied"
      ? "Copied!"
      : props.shareStatus === "shared"
        ? "Shared!"
        : props.shareStatus === "failed"
          ? "Couldn't share"
          : "Share result";

  return (
    <View style={styles.backdrop}>
      <Confetti
        mode="rain"
        width={width}
        height={height}
        seed={confettiSeed}
        shape={theme.confetti.shape}
        colors={theme.confetti.colors}
      />
      <ThemeCelebrationArt />
      <Animated.View
        style={[
          styles.card,
          {
            opacity: card,
            transform: [
              { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              { rotate: card.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "0deg"] }) },
            ],
          },
        ]}
      >
        <Text style={styles.kicker}>DAGENS BRÄDE</Text>
        <Text style={styles.title}>{copy.completeTitle}</Text>
        <Text style={styles.count}>
          {shownCount}
          <Text style={styles.countOf}>/9</Text>
        </Text>
        <Text style={styles.subtitle}>cells filled</Text>
        <View style={styles.grid}>
          {props.shareGrid.map((line, index) => (
            <Text key={index} style={styles.gridLine}>
              {line}
            </Text>
          ))}
        </View>
        <Pressable style={styles.shareButton} onPress={props.onShare}>
          <MaterialCommunityIcons name="share-variant" size={18} color={theme.colors.accentInk} />
          <Text style={styles.shareText}>{shareLabel}</Text>
        </Pressable>
        <Pressable onPress={props.onClose} hitSlop={10}>
          <Text style={styles.close}>Back to the board</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const makeStyles = (theme: Theme) => ({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.celebrationOverlay,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: "100%" as const,
    maxWidth: 360,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: theme.borders.card,
    borderColor: theme.colors.highlight,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center" as const,
    gap: 6,
    shadowColor: theme.glow?.color ?? "#000",
    shadowOpacity: theme.glow ? 0.9 : 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: theme.glow ? 0 : 10 },
    elevation: 12,
  },
  kicker: {
    fontFamily: theme.fonts.condensed,
    fontSize: 14,
    letterSpacing: 2,
    color: theme.colors.accent,
  },
  title: { fontFamily: theme.fonts.display, fontSize: 30, color: theme.colors.inkStrong, textAlign: "center" as const },
  count: { fontFamily: theme.fonts.display, fontSize: 64, color: theme.colors.accent, lineHeight: 70 },
  countOf: { fontSize: 28, color: theme.colors.inkMuted },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.inkMuted, marginTop: -4 },
  grid: { marginVertical: 10, alignItems: "center" as const },
  gridLine: { fontSize: 26, lineHeight: 30, letterSpacing: 2 },
  shareButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: theme.colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: theme.radii.button,
    marginTop: 4,
  },
  shareText: { fontFamily: theme.fonts.bodyStrong, fontSize: 16, fontWeight: "600" as const, color: theme.colors.accentInk },
  close: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    color: theme.colors.inkMuted,
    textDecorationLine: "underline" as const,
    marginTop: 8,
  },
});
