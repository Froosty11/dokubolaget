import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { USE_NATIVE_DRIVER } from "../animation";
import { Confetti } from "../components/Confetti";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { ThemeCelebrationArt } from "../theme/decorations/ThemeBackdrop";
import { SupportLink } from "../components/SupportLink";
import { InstallNudge } from "../components/InstallNudge";

type BoardCompleteViewProps = {
  filledCount: number;
  shareGrid: string[];
  shareStatus: "idle" | "shared" | "copied" | "failed";
  // "A1 7412 Marqués de Vargas" per solved cell, for the receipt layout.
  receiptLines: string[];
  // Ko-fi page, or null when none is configured.
  supportUrl: string | null;
  onShare: () => void;
  onClose: () => void;
};

export function BoardCompleteView(props: Readonly<BoardCompleteViewProps>) {
  const { width, height } = useWindowDimensions();
  const { theme, copy, t } = useTheme();
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
      ? t("boardComplete.copied")
      : props.shareStatus === "shared"
        ? t("boardComplete.shared")
        : props.shareStatus === "failed"
          ? t("boardComplete.shareFailed")
          : t("boardComplete.shareResult");

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
        {theme.flags.celebrationLayout === "receipt" ? (
          <Receipt
            lines={props.receiptLines}
            count={shownCount}
            shareGrid={props.shareGrid}
            title={copy.completeTitle}
            shareLabel={shareLabel}
            onShare={props.onShare}
            onClose={props.onClose}
          />
        ) : (
          <>
          <Text style={styles.kicker}>{t("boardComplete.kicker")}</Text>
          <Text style={styles.title}>{copy.completeTitle}</Text>
          <Text style={styles.count}>
            {shownCount}
            <Text style={styles.countOf}>/9</Text>
          </Text>
          <Text style={styles.subtitle}>{t("boardComplete.cellsFilled")}</Text>
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
              <Text style={styles.close}>{t("boardComplete.back")}</Text>
            </Pressable>
          </>
        )}
        <View style={{ marginTop: 14 }}>
          <SupportLink url={props.supportUrl} color={theme.colors.inkMuted} />
        </View>
        <InstallNudge />
      </Animated.View>
    </View>
  );
}

// Prislista's celebration: a stamped till receipt with one line per cell.
function Receipt(props: {
  lines: string[];
  count: number;
  shareGrid: string[];
  title: string;
  shareLabel: string;
  onShare: () => void;
  onClose: () => void;
}) {
  const r = useThemedStyles(makeReceiptStyles);
  const { t } = useTheme();
  const now = new Date();
  const stamp = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return (
    <View style={r.wrap}>
      <Text style={r.center}>DOKUBOLAGET</Text>
      <Text style={r.center}>{t("boardComplete.receiptStore")}</Text>
      <Text style={r.center}>{stamp}</Text>
      <View style={r.rule} />
      <Text style={r.center}>{props.title.toUpperCase()}</Text>
      {props.lines.map((line) => (
        <View key={line} style={r.line}>
          <Text numberOfLines={1} style={r.lineText}>{line}</Text>
          <View style={r.dots} />
          <Text style={r.lineText}>✓</Text>
        </View>
      ))}
      <View style={r.rule} />
      <View style={r.line}>
        <Text style={r.total}>{t("boardComplete.receiptTotal")}</Text>
        <View style={r.dots} />
        <Text style={r.total}>{props.count}/9</Text>
      </View>
      <View style={r.grid}>
        {props.shareGrid.map((row, index) => (
          <Text key={index} style={r.gridLine}>{row}</Text>
        ))}
      </View>
      <Text style={r.stampMark}>{t("boardComplete.receiptApproved")}</Text>
      <View style={r.buttons}>
        <Pressable style={[r.button, r.primary]} onPress={props.onShare} accessibilityRole="button">
          <Text style={[r.buttonText, r.primaryText]}>{props.shareLabel.toUpperCase()}</Text>
        </Pressable>
        <Pressable style={r.button} onPress={props.onClose} accessibilityRole="button">
          <Text style={r.buttonText}>{t("boardComplete.receiptBack")}</Text>
        </Pressable>
      </View>
      <Text style={[r.center, { marginTop: 8 }]}>{t("boardComplete.receiptFooter")}</Text>
    </View>
  );
}

const makeReceiptStyles = (theme: Theme) => ({
  wrap: { width: "100%" as const, gap: 3 },
  center: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.ink, textAlign: "center" as const },
  rule: { borderTopWidth: 1.5, borderStyle: "dashed" as const, borderColor: theme.colors.ink, marginVertical: 8 },
  line: { flexDirection: "row" as const, alignItems: "flex-end" as const },
  lineText: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.ink, flexShrink: 1 },
  dots: { flex: 1, minWidth: 10, borderBottomWidth: 1.5, borderStyle: "dotted" as const, borderColor: theme.colors.ink, marginHorizontal: 4, marginBottom: 4 },
  total: { fontFamily: theme.fonts.mono, fontSize: 16, fontWeight: "600" as const, color: theme.colors.ink },
  grid: { alignItems: "center" as const, marginTop: 8 },
  gridLine: { fontSize: 22, lineHeight: 26, letterSpacing: 2 },
  stampMark: {
    position: "absolute" as const, right: 4, top: "48%" as const,
    fontFamily: theme.fonts.condensed, fontSize: 26, letterSpacing: 3, color: theme.colors.accent,
    borderWidth: 3, borderColor: theme.colors.accent, paddingHorizontal: 8, paddingVertical: 2,
    transform: [{ rotate: "-14deg" }], opacity: 0.85,
  },
  buttons: { flexDirection: "row" as const, gap: 8, marginTop: 12 },
  button: { flex: 1, borderWidth: 1.5, borderColor: theme.colors.ink, paddingVertical: 9, alignItems: "center" as const },
  primary: { backgroundColor: theme.colors.ink },
  buttonText: { fontFamily: theme.fonts.condensed, fontSize: 13, letterSpacing: 1.5, color: theme.colors.ink },
  primaryText: { color: "#fbf7ea" },
});

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
    backgroundColor: theme.flags.celebrationLayout === "receipt" ? "#fbf7ea" : theme.colors.surface,
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
