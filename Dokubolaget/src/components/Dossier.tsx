import * as Font from "expo-font";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { USE_NATIVE_DRIVER, seededRandom } from "../animation";
import { useTheme } from "../theme/ThemeProvider";
import type { DossierLook } from "../theme/types";

type Tag = { id?: string; family?: string };

export type DossierFieldKey =
  | "country"
  | "region"
  | "style"
  | "grapes"
  | "strength"
  | "volume"
  | "price"
  | "packaging"
  | "closure"
  | "organic"
  | "assortment"
  | "taste";

// Which dossier lines would give away whether a product fits a given tag.
// Those get blacked out while the cell is still unsolved.
export function redactionKeysForTags(tags: Array<Tag | undefined>): Set<DossierFieldKey> {
  const keys = new Set<DossierFieldKey>();
  for (const tag of tags) {
    if (!tag) continue;
    const id = String(tag.id ?? "");
    switch (tag.family) {
      case "geography":
        // A region ("Rioja", "Champagne") gives the country away too.
        keys.add("country");
        keys.add("region");
        break;
      case "region":
        keys.add("region");
        keys.add("country");
        break;
      case "beverage":
      case "style":
        keys.add("style");
        break;
      case "grape":
        keys.add("grapes");
        break;
      case "alcohol":
        keys.add("strength");
        break;
      case "volume":
        keys.add("volume");
        break;
      case "price":
        keys.add("price");
        break;
      case "container":
      case "containerType":
      case "containerMaterial":
        keys.add("packaging");
        break;
      case "seal":
        keys.add("closure");
        break;
      case "taste":
        keys.add("taste");
        break;
      case "flag":
        keys.add(id === "flag:organic" ? "organic" : "assortment");
        break;
    }
  }
  return keys;
}

const MONO = Platform.select({
  web: "'Courier New', Courier, monospace",
  ios: "Courier",
  default: "monospace",
});

function formatPrice(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(number % 1 ? 2 : 0)} kr` : "";
}

type Line = { key: DossierFieldKey | null; label: string; value: string };

type DossierStyles = ReturnType<typeof makeStyles>;
const StylesContext = createContext<DossierStyles | null>(null);
const useStyles = () => useContext(StylesContext)!;

function buildLines(raw: any): Line[] {
  const grapes = Array.isArray(raw?.grapes) ? raw.grapes.join(", ") : "";
  const style = [raw?.categoryLevel2, raw?.categoryLevel3].filter(Boolean).join(" / ");
  const lines: Line[] = [
    { key: null, label: "PRODUCER", value: raw?.producerName || raw?.supplierName || "" },
    { key: "country", label: "ORIGIN", value: raw?.country || "" },
    { key: "region", label: "REGION", value: raw?.originLevel1 || "" },
    { key: "style", label: "TYPE", value: style },
    { key: "grapes", label: "GRAPES", value: grapes },
    {
      key: "strength",
      label: "STRENGTH",
      value: raw?.alcoholPercentage != null ? `${raw.alcoholPercentage} %` : "",
    },
    { key: "volume", label: "VOLUME", value: raw?.volumeText || "" },
    { key: "price", label: "PRICE", value: formatPrice(raw?.price) },
    { key: "packaging", label: "PACKAGING", value: raw?.packagingLevel1 || raw?.bottleText || "" },
    { key: "closure", label: "CLOSURE", value: raw?.seal || "" },
    {
      key: "organic",
      label: "ORGANIC",
      value: raw?.isOrganic === true ? "Yes" : raw?.isOrganic === false ? "No" : "",
    },
    { key: "assortment", label: "SHELF", value: raw?.assortmentText || "" },
    {
      key: null,
      label: "ON FILE SINCE",
      value: typeof raw?.productLaunchDate === "string" ? raw.productLaunchDate.slice(0, 4) : "",
    },
  ];
  return lines.filter((line) => line.value);
}

// A black bar the same width as the hidden text. The real value is never put
// in the DOM while redacted, so it can't be read by selecting the text.
function Bar({ length }: { length: number }) {
  const styles = useStyles();
  return <Text style={styles.bar}>{"x".repeat(Math.max(4, Math.min(length, 26)))}</Text>;
}

function PeelingBar({ length, delay }: { length: number; delay: number }) {
  const styles = useStyles();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 0,
      duration: 420,
      delay,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.peel,
        { transformOrigin: "right", transform: [{ scaleX: progress }] },
      ]}
    >
      <Text style={styles.bar}>{"x".repeat(Math.max(4, Math.min(length, 26)))}</Text>
    </Animated.View>
  );
}

function Value({
  text,
  redacted,
  revealed,
  delay,
}: {
  text: string;
  redacted: boolean;
  revealed: boolean;
  delay: number;
}) {
  const styles = useStyles();
  if (redacted && !revealed) return <Bar length={text.length} />;
  return (
    <View style={styles.valueWrap}>
      <Text style={styles.value}>{text}</Text>
      {redacted && revealed ? <PeelingBar length={text.length} delay={delay} /> : null}
    </View>
  );
}

// Blacks out roughly a quarter of the descriptive words in a tasting note.
function TasteNote({ text, seed, revealed }: { text: string; seed: number; revealed: boolean }) {
  const styles = useStyles();
  const words = useMemo(() => {
    const random = seededRandom(seed);
    return text.split(/(\s+)/).map((word) => ({
      word,
      hide: !revealed && word.trim().length > 4 && random() < 0.28,
    }));
  }, [text, seed, revealed]);
  return (
    <Text style={styles.taste}>
      {words.map((part, index) =>
        part.hide ? (
          <Text key={index} style={styles.bar}>
            {"x".repeat(part.word.length)}
          </Text>
        ) : (
          <Text key={index}>{part.word}</Text>
        ),
      )}
    </Text>
  );
}

type DossierProps = {
  product: any;
  redact: Set<DossierFieldKey>;
  // true once the cell is solved: bars peel away to show the real values.
  revealed?: boolean;
  width?: number;
};

export function Dossier({ product, redact, revealed = false, width = 300 }: DossierProps) {
  const { theme, copy } = useTheme();
  const look = theme.dossier;
  const font = look.font && Font.isLoaded(look.font) ? look.font : MONO;
  const styles = useMemo(() => StyleSheet.create(makeStyles(look, font)), [look, font]);
  const lines = buildLines(product);
  const productNumber = String(product?.productNumber || product?.productId || "0000");
  const seed = Number(productNumber.replace(/\D/g, "").slice(-8)) || 7;
  const name = [product?.productNameBold, product?.productNameThin].filter(Boolean).join(" ");
  const taste = typeof product?.taste === "string" ? product.taste.trim() : "";

  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(appear, {
      toValue: 1,
      friction: 7,
      tension: 90,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [productNumber]);

  let peelIndex = 0;

  return (
    <StylesContext.Provider value={styles}>
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          width,
          opacity: appear,
          transform: [
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            { rotate: look.tilt },
          ],
        },
      ]}
    >
      {look.ruledLines ? (
        <View style={styles.ruledLines}>
          {Array.from({ length: 40 }, (_, i) => (
            <View key={i} style={styles.ruledLine} />
          ))}
        </View>
      ) : null}
      {look.marginRule ? <View style={styles.marginRule} /> : null}
      {look.borderStyle === "double" ? <View style={styles.innerFrame} /> : null}
      <View style={styles.headerRow}>
        <Text style={styles.caseNo}>{copy.dossierTitle}{productNumber}</Text>
      </View>
      <Text style={styles.subject} numberOfLines={2}>
        {copy.dossierSubject} {name.toUpperCase()}
      </Text>
      <View style={styles.rule} />
      {lines.map((line) => {
        const redacted = line.key != null && redact.has(line.key);
        const delay = redacted ? 250 + peelIndex++ * 180 : 0;
        return (
          <View key={line.label} style={styles.line}>
            <Text style={styles.label}>{line.label}</Text>
            <Value text={line.value} redacted={redacted} revealed={revealed} delay={delay} />
          </View>
        );
      })}
      {taste ? (
        <>
          <View style={styles.rule} />
          <Text style={styles.label}>{copy.dossierNotes.toUpperCase()}</Text>
          {redact.has("taste") && !revealed ? (
            <Bar length={taste.length} />
          ) : (
            <TasteNote text={taste} seed={seed} revealed={revealed} />
          )}
        </>
      ) : null}
      <View style={[styles.stamp, revealed ? styles.stampOpen : null]}>
        <Text style={[styles.stampText, revealed ? styles.stampTextOpen : null]}>
          {revealed ? copy.stampRevealed : copy.stampHidden}
        </Text>
      </View>
    </Animated.View>
    </StylesContext.Provider>
  );
}

function makeStyles(look: DossierLook, font: string) {
  const glow = look.glow ? { textShadowColor: look.label, textShadowRadius: 6 } : {};
  const barGlow = look.glow
    ? { textShadowColor: look.bar, textShadowRadius: 8 }
    : {};
  return {
    card: {
      backgroundColor: look.paper,
      borderRadius: look.radius,
      borderWidth: look.borderStyle === "double" ? 1.5 : look.borderStyle === "dashed" ? 2 : 1,
      borderStyle: look.borderStyle === "dashed" ? ("dashed" as const) : ("solid" as const),
      borderColor: look.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      paddingLeft: look.marginRule ? 34 : 16,
      gap: 4,
      shadowColor: look.glow ? look.border : "#000",
      shadowOpacity: look.glow ? 0.8 : 0.25,
      shadowRadius: look.glow ? 16 : 12,
      shadowOffset: { width: 0, height: look.glow ? 0 : 6 },
      elevation: 8,
      overflow: "hidden" as const,
    },
    ruledLines: { position: "absolute" as const, left: 0, right: 0, top: 30, gap: 19 },
    ruledLine: { height: 1, backgroundColor: look.rule },
    marginRule: { position: "absolute" as const, top: 0, bottom: 0, left: 24, width: 1.5, backgroundColor: look.marginRule ?? "transparent" },
    innerFrame: { position: "absolute" as const, top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderColor: look.border, opacity: 0.55 },
    headerRow: { flexDirection: "row" as const, justifyContent: "space-between" as const },
    caseNo: { fontFamily: font, fontSize: 11, color: look.label, letterSpacing: 1, ...glow },
    subject: { fontFamily: font, fontSize: 14, fontWeight: "700" as const, color: look.ink, marginTop: 2 },
    rule: { height: 1, backgroundColor: look.rule, marginVertical: 6 },
    line: { flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 8 },
    label: { fontFamily: font, fontSize: 11, color: look.label, width: 96, flexShrink: 0, paddingTop: 1 },
    valueWrap: { flexShrink: 1, alignSelf: "flex-start" as const },
    value: { fontFamily: font, fontSize: 13, color: look.ink, flexShrink: 1 },
    bar: {
      fontFamily: font,
      fontSize: 13,
      color: look.bar,
      backgroundColor: look.bar,
      overflow: "hidden" as const,
      ...barGlow,
    },
    peel: { backgroundColor: look.bar, overflow: "hidden" as const },
    taste: { fontFamily: font, fontSize: 12, color: look.ink, lineHeight: 18 },
    stamp: {
      position: "absolute" as const,
      top: 14,
      right: -6,
      borderWidth: 2,
      borderColor: look.stampHidden,
      paddingHorizontal: 6,
      paddingVertical: 2,
      transform: [{ rotate: "14deg" }],
      opacity: 0.85,
    },
    stampOpen: { borderColor: look.stampRevealed },
    stampText: {
      fontFamily: font,
      fontSize: 12,
      fontWeight: "700" as const,
      color: look.stampHidden,
      letterSpacing: 2,
    },
    stampTextOpen: { color: look.stampRevealed },
  };
}
