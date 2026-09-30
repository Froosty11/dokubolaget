import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import { USE_NATIVE_DRIVER, seededRandom } from "../animation";

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
  return <Text style={styles.bar}>{"x".repeat(Math.max(4, Math.min(length, 26)))}</Text>;
}

function PeelingBar({ length, delay }: { length: number; delay: number }) {
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
    <Animated.View
      pointerEvents="none"
      style={[
        styles.card,
        {
          width,
          opacity: appear,
          transform: [
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
            { rotate: "-1deg" },
          ],
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.caseNo}>CASE FILE #{productNumber}</Text>
      </View>
      <Text style={styles.subject} numberOfLines={2}>
        SUBJECT: {name.toUpperCase()}
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
          <Text style={styles.label}>FIELD NOTES</Text>
          {redact.has("taste") && !revealed ? (
            <Bar length={taste.length} />
          ) : (
            <TasteNote text={taste} seed={seed} revealed={revealed} />
          )}
        </>
      ) : null}
      <View style={[styles.stamp, revealed ? styles.stampOpen : null]}>
        <Text style={[styles.stampText, revealed ? styles.stampTextOpen : null]}>
          {revealed ? "DECLASSIFIED" : "CLASSIFIED"}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f3e9d2",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d8c9a3",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: "hidden",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  caseNo: { fontFamily: MONO, fontSize: 11, color: "#6b5b3a", letterSpacing: 1 },
  subject: { fontFamily: MONO, fontSize: 14, fontWeight: "700", color: "#1b1b1b", marginTop: 2 },
  rule: { height: 1, backgroundColor: "#cbb98f", marginVertical: 6 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  label: { fontFamily: MONO, fontSize: 11, color: "#6b5b3a", width: 96, flexShrink: 0, paddingTop: 1 },
  valueWrap: { flexShrink: 1, alignSelf: "flex-start" },
  value: { fontFamily: MONO, fontSize: 13, color: "#1b1b1b", flexShrink: 1 },
  bar: {
    fontFamily: MONO,
    fontSize: 13,
    color: "#111",
    backgroundColor: "#111",
    overflow: "hidden",
  },
  peel: { backgroundColor: "#111", overflow: "hidden" },
  taste: { fontFamily: MONO, fontSize: 12, color: "#1b1b1b", lineHeight: 18 },
  stamp: {
    position: "absolute",
    top: 14,
    right: -6,
    borderWidth: 2,
    borderColor: "#c0392b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    transform: [{ rotate: "14deg" }],
    opacity: 0.85,
  },
  stampOpen: { borderColor: "#1e7d45" },
  stampText: {
    fontFamily: MONO,
    fontSize: 12,
    fontWeight: "700",
    color: "#c0392b",
    letterSpacing: 2,
  },
  stampTextOpen: { color: "#1e7d45" },
});
