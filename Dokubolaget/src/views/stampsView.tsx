import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { ClubLogo } from "../components/ClubLogo";
import type { Stamp } from "../stamps";
import { clubTheme } from "../theme/registry";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";

type Props = {
  stamps: Array<Stamp & { logoUrl: string | null }>;
  collectedCount: number;
  offline: boolean;
  contactEmail: string | null;
  onWear: (id: Stamp["summary"]["id"]) => void;
  onClose: () => void;
};

// Every club theme as a stamp: collected ones in colour with "Wear it",
// missing ones greyed out with where and when to scan.
export function StampsView({ stamps, collectedCount, offline, contactEmail, onWear, onClose }: Readonly<Props>) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Pub stamps</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close pub stamps" hitSlop={12} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>
          Scan the poster at a club's pub to collect its stamp and theme.
          {stamps.length ? ` ${collectedCount} of ${stamps.length} collected.` : ""}
        </Text>
        {offline ? <Text style={styles.lead}>You're offline – showing the stamps saved on this device.</Text> : null}
        <View style={styles.grid}>
          {stamps.map((stamp) => {
            const { summary } = stamp;
            // The club's own theme for the badge, or the current one until it downloads.
            const own = clubTheme(summary.id) ?? theme;
            return (
              <View
                key={summary.id}
                accessibilityLabel={`${summary.club.name}: ${stamp.collected ? "collected" : `not collected. Scan the code at ${summary.club.venue}, ${summary.club.pubNight}`}`}
                style={[styles.stamp, stamp.collected ? null : styles.stampMissing]}
              >
                {stamp.collected ? <Text style={styles.got}>SAMLAD</Text> : null}
                <ClubLogo club={summary.club} logoUrl={stamp.logoUrl} theme={own} size={72} dimmed={!stamp.collected} />
                <Text style={styles.name}>{summary.club.name}</Text>
                <Text style={styles.hint}>
                  {stamp.collected ? `${summary.club.pubNight} · ${summary.club.venue}` : `Scan the code at ${summary.club.venue}, ${summary.club.pubNight}`}
                </Text>
                {stamp.collected ? (
                  <Pressable
                    disabled={!stamp.available || stamp.wearing}
                    onPress={() => onWear(summary.id)}
                    accessibilityRole="button"
                    style={[styles.wear, stamp.wearing ? styles.wearing : null]}
                  >
                    <Text style={[styles.wearText, stamp.wearing ? styles.wearingText : null]}>
                      {stamp.wearing ? "WEARING" : stamp.available ? "WEAR IT" : "DOWNLOADING…"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
        {stamps.length === 0 && !offline ? <Text style={styles.lead}>No clubs yet.</Text> : null}
        {contactEmail ? (
          <Pressable onPress={() => Linking.openURL(`mailto:${contactEmail}`)} accessibilityRole="link" style={styles.collab}>
            <Text style={styles.lead}>
              Want your club here? <Text style={styles.link}>{contactEmail}</Text>
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.page, paddingTop: 48 },
  header: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingHorizontal: 18 },
  title: { fontFamily: theme.fonts.display, fontSize: 30, color: theme.colors.inkStrong },
  close: { width: 36, height: 36, alignItems: "center" as const, justifyContent: "center" as const, borderRadius: 18, backgroundColor: theme.colors.surface },
  closeText: { fontSize: 16, color: theme.colors.ink },
  body: { padding: 16, gap: 12, maxWidth: 560, width: "100%" as const, alignSelf: "center" as const },
  lead: { fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 19, color: theme.colors.inkMuted },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 12 },
  stamp: {
    width: "47.5%" as const, alignItems: "center" as const, gap: 6, paddingTop: 16, paddingBottom: 12, paddingHorizontal: 8,
    backgroundColor: theme.colors.surface, borderWidth: 1.5, borderColor: theme.colors.divider, borderRadius: theme.radii.card,
  },
  stampMissing: { backgroundColor: "transparent", borderStyle: "dashed" as const },
  got: {
    position: "absolute" as const, top: 8, right: 8, fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.correct,
    borderWidth: 1, borderColor: theme.colors.correct, paddingHorizontal: 4, transform: [{ rotate: "6deg" }],
  },
  name: { fontFamily: theme.fonts.condensed, fontSize: 18, letterSpacing: 1, color: theme.colors.inkStrong, marginTop: 4 },
  hint: { fontFamily: theme.fonts.body, fontSize: 11, lineHeight: 15, color: theme.colors.inkMuted, textAlign: "center" as const },
  wear: { marginTop: 4, borderWidth: 1.5, borderColor: theme.colors.ink, paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radii.button },
  wearing: { backgroundColor: theme.colors.ink },
  wearText: { fontFamily: theme.fonts.condensed, fontSize: 13, letterSpacing: 1.5, color: theme.colors.ink },
  wearingText: { color: theme.colors.page },
  collab: { marginTop: 8, alignItems: "center" as const },
  link: { color: theme.colors.ink, textDecorationLine: "underline" as const },
});
