import { Pressable, ScrollView, Text, View, Switch } from "react-native";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import { useWideLayout } from "../useWideLayout";
import { ThemeSwatch } from "../theme/ThemeSwatch";
import type { Theme, ThemeId } from "../theme/types";
import type { ThemeCardState } from "../theme/unlocks";

type ThemePickerViewProps = {
  cards: Array<{ theme: Theme; card: ThemeCardState }>;
  streakLine: string | null;
  onPick: (id: ThemeId) => void;
  onClose: () => void;
  hapticsOn: boolean;
  onToggleHaptics: (on: boolean) => void;
  // Unlocked club themes that can be worn, and names of ones still downloading.
  clubCards: Array<{ theme: Theme; card: ThemeCardState }>;
  downloading: string[];
  onOpenStamps: () => void;
};

export function ThemePickerView({
  cards, streakLine, onPick, onClose, hapticsOn, onToggleHaptics, clubCards, downloading, onOpenStamps,
}: Readonly<ThemePickerViewProps>) {
  const { theme, lang, setLang, t } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const wide = useWideLayout();

  function renderCard({ theme: item, card }: { theme: Theme; card: ThemeCardState }) {
    const copy = item.copy[lang];
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
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Themes</Text>
        {/* On wide screens this is a page beside the sidebar, not a sheet to close. */}
        {wide ? null : (
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close themes" hitSlop={12} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        )}
      </View>
      {streakLine ? <Text style={styles.streak}>{streakLine}</Text> : null}
      <ScrollView contentContainerStyle={styles.list}>
        {cards.map(renderCard)}
        <View style={styles.sectionRow}>
          <Text style={styles.section}>PUB THEMES</Text>
          <Pressable onPress={onOpenStamps} accessibilityRole="link" hitSlop={8}>
            <Text style={[styles.section, styles.sectionLink]}>Pub stamps ›</Text>
          </Pressable>
        </View>
        {clubCards.length === 0 && downloading.length === 0 ? (
          <Text style={styles.description}>Scan the code at a club's pub to collect its theme.</Text>
        ) : null}
        {clubCards.map(renderCard)}
        {downloading.map((name) => (
          <Text key={name} style={styles.description}>{name}: downloading…</Text>
        ))}
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
        <View style={styles.setting}>
          <View style={styles.cardText}>
            <Text style={styles.name}>{t("settings.language")}</Text>
          </View>
          <View style={styles.langToggle}>
            {(["en", "sv"] as const).map((code) => {
              const on = lang === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setLang(code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[styles.langOption, on ? styles.langOptionActive : null]}
                >
                  <Text style={[styles.langOptionText, on ? styles.langOptionTextActive : null]}>
                    {t(code === "en" ? "lang.en" : "lang.sv")}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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
  sectionRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, marginTop: 10 },
  section: { fontFamily: theme.fonts.condensed, fontSize: 13, letterSpacing: 2, color: theme.colors.inkMuted },
  sectionLink: { color: theme.colors.ink, textDecorationLine: "underline" as const },
  setting: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 14, paddingTop: 14, marginTop: 4,
    borderTopWidth: 1, borderTopColor: theme.colors.divider,
  },
  badgeText: { fontFamily: theme.fonts.bodyStrong, fontSize: 10, letterSpacing: 1, color: theme.colors.accentInk },
  langToggle: {
    flexDirection: "row" as const,
    borderWidth: 1.5,
    borderColor: theme.colors.divider,
    borderRadius: theme.radii.button,
    overflow: "hidden" as const,
  },
  langOption: { paddingVertical: 7, paddingHorizontal: 14, backgroundColor: theme.colors.surface },
  langOptionActive: { backgroundColor: theme.colors.accent },
  langOptionText: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.ink },
  langOptionTextActive: { fontFamily: theme.fonts.bodyStrong, color: theme.colors.accentInk },
});
