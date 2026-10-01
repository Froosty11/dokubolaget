import { Pressable, ScrollView, Text, View, Switch } from "react-native";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import { ThemeSwatch } from "../theme/ThemeSwatch";
import { UI_LANG } from "../theme/registry";
import type { Theme, ThemeId } from "../theme/types";
import type { ThemeCardState } from "../theme/unlocks";

type ThemePickerViewProps = {
  cards: Array<{ theme: Theme; card: ThemeCardState }>;
  streakLine: string | null;
  onPick: (id: ThemeId) => void;
  onClose: () => void;
  hapticsOn: boolean;
  onToggleHaptics: (on: boolean) => void;
};

export function ThemePickerView({ cards, streakLine, onPick, onClose, hapticsOn, onToggleHaptics }: Readonly<ThemePickerViewProps>) {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Themes</Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close themes" hitSlop={12} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      {streakLine ? <Text style={styles.streak}>{streakLine}</Text> : null}
      <ScrollView contentContainerStyle={styles.list}>
        {cards.map(({ theme: item, card }) => {
          const copy = item.copy[UI_LANG];
          const locked = card.state === "locked";
          const active = card.state === "active";
          return (
            <Pressable
              key={item.id}
              // Locked cards stay focusable so keyboard and screen-reader
              // users can reach the unlock condition; pressing does nothing.
              onPress={() => {
                if (!locked) onPick(item.id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={[
                `${copy.name}:`,
                locked ? `locked. ${copy.unlockHint}` : active ? "active." : "available.",
                card.progress ? `${card.progress.current} of ${card.progress.target} days.` : null,
              ].filter(Boolean).join(" ")}
              style={[styles.card, active ? styles.cardActive : null]}
            >
              <View style={{ opacity: locked ? 0.35 : 1 }}>
                <ThemeSwatch theme={item} />
              </View>
              {locked ? <Text style={styles.lock}>🔒</Text> : null}
              <View style={styles.cardText}>
                <Text style={styles.name}>{copy.name}</Text>
                <Text style={styles.description}>{locked ? copy.unlockHint : copy.description}</Text>
                {card.progress ? (
                  <View style={styles.progressRow}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${(card.progress.current / card.progress.target) * 100}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {card.progress.current} of {card.progress.target} days
                    </Text>
                  </View>
                ) : null}
              </View>
              {active ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>ACTIVE</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <View style={styles.setting}>
          <View style={styles.cardText}>
            <Text style={styles.name}>Vibration</Text>
            <Text style={styles.description}>Each theme buzzes its own way.</Text>
          </View>
          <Switch
            value={hapticsOn}
            onValueChange={onToggleHaptics}
            accessibilityLabel="Vibration"
            trackColor={{ false: theme.colors.divider, true: theme.colors.accent }}
            thumbColor={theme.colors.surface}
            {...({ activeThumbColor: theme.colors.surface } as object)}
          />
        </View>
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
  streak: { fontFamily: theme.fonts.mono, fontSize: 12, color: theme.colors.inkMuted, paddingHorizontal: 18, marginTop: 4 },
  list: { padding: 16, gap: 12, maxWidth: 560, width: "100%" as const, alignSelf: "center" as const },
  card: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 14, padding: 10,
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, borderWidth: 1.5, borderColor: theme.colors.divider,
    overflow: "hidden" as const,
  },
  cardActive: {
    borderColor: theme.colors.accent,
    ...(theme.glow ? { shadowColor: theme.glow.color, shadowRadius: 12, shadowOpacity: 1, shadowOffset: { width: 0, height: 0 } } : {}),
  },
  lock: { position: "absolute" as const, left: 44, top: 34, fontSize: 24 },
  cardText: { flex: 1, gap: 4 },
  name: { fontFamily: theme.fonts.bodyStrong, fontWeight: "700" as const, fontSize: 17, color: theme.colors.inkStrong },
  description: { fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 16, color: theme.colors.inkMuted },
  progressRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, marginTop: 4 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.divider, overflow: "hidden" as const },
  progressFill: { height: 6, backgroundColor: theme.colors.accent },
  progressText: { fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.inkMuted },
  badge: { position: "absolute" as const, top: 8, right: 8, backgroundColor: theme.colors.accent, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  setting: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 14, paddingTop: 14, marginTop: 4,
    borderTopWidth: 1, borderTopColor: theme.colors.divider,
  },
  badgeText: { fontFamily: theme.fonts.bodyStrong, fontSize: 10, letterSpacing: 1, color: theme.colors.accentInk },
});
