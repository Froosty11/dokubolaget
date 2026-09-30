import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { USE_NATIVE_DRIVER } from "../animation";
import { Confetti } from "../components/Confetti";

type BoardCompleteViewProps = {
  filledCount: number;
  shareGrid: string[];
  shareStatus: "idle" | "shared" | "copied" | "failed";
  onShare: () => void;
  onClose: () => void;
};

export function BoardCompleteView(props: Readonly<BoardCompleteViewProps>) {
  const { width, height } = useWindowDimensions();
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
      <Confetti mode="rain" width={width} height={height} seed={confettiSeed} />
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
        <Text style={styles.title}>Board complete!</Text>
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
          <MaterialCommunityIcons name="share-variant" size={18} color="#ffd400" />
          <Text style={styles.shareText}>{shareLabel}</Text>
        </Pressable>
        <Pressable onPress={props.onClose} hitSlop={10}>
          <Text style={styles.close}>Back to the board</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 40, 18, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 50,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#f3f3f1",
    borderRadius: 18,
    borderWidth: 4,
    borderColor: "#ffd400",
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  kicker: {
    fontFamily: "BolagetMediumCondensed",
    fontSize: 14,
    letterSpacing: 2,
    color: "#007a33",
  },
  title: { fontFamily: "Monopol", fontSize: 30, color: "#1b1b1b", textAlign: "center" },
  count: { fontFamily: "Monopol", fontSize: 64, color: "#007a33", lineHeight: 70 },
  countOf: { fontSize: 28, color: "#6b6b6b" },
  subtitle: { fontFamily: "InterVariable", fontSize: 14, color: "#555", marginTop: -4 },
  grid: { marginVertical: 10, alignItems: "center" },
  gridLine: { fontSize: 26, lineHeight: 30, letterSpacing: 2 },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#007a33",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 24,
    marginTop: 4,
  },
  shareText: { fontFamily: "InterVariable", fontSize: 16, fontWeight: "600", color: "#fff" },
  close: {
    fontFamily: "InterVariable",
    fontSize: 14,
    color: "#555",
    textDecorationLine: "underline",
    marginTop: 8,
  },
});
