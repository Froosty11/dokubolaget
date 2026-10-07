// A small, dismissible "add to home screen" nudge shown after a finished board.
// Web only; renders nothing on native (already an app), when already installed,
// or once dismissed. The decision logic lives in ../installNudge (unit-tested).
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { chooseInstallNudge, INSTALL_NUDGE_KEY, isIOS, isStandalone, type InstallNudge as Mode } from "../installNudge";

declare global {
  // The install prompt captured before React mounts (see app/+html.tsx).
  interface Window {
    __bip?: { prompt: () => Promise<void> } | null;
  }
}

export function InstallNudge() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [mode, setMode] = useState<Mode>("none");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(INSTALL_NUDGE_KEY)
      .then((dismissed) => {
        if (!active) return;
        setMode(
          chooseInstallNudge({
            isWeb: Platform.OS === "web",
            standalone: isStandalone(),
            isIOS: isIOS(),
            canPrompt: typeof window !== "undefined" && Boolean(window.__bip),
            dismissed: Boolean(dismissed),
          }),
        );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (mode === "none") return null;

  function remember() {
    AsyncStorage.setItem(INSTALL_NUDGE_KEY, "1").catch(() => {});
    setMode("none");
  }
  async function onInstall() {
    const bip = typeof window !== "undefined" ? window.__bip : null;
    if (bip) {
      try {
        await bip.prompt();
      } catch {}
      if (typeof window !== "undefined") window.__bip = null;
    }
    remember();
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MaterialCommunityIcons name="cellphone-arrow-down" size={20} color={theme.colors.accent} />
        <Text style={styles.title}>Add Dokubolaget to your phone</Text>
      </View>
      <Text style={styles.body}>
        {mode === "ios"
          ? "Tap the Share button, then “Add to Home Screen” — for a full-screen app and a one-tap icon."
          : "Install it for a full-screen app and a one-tap icon on your home screen."}
      </Text>
      <View style={styles.actions}>
        {mode === "prompt" ? (
          <Pressable accessibilityRole="button" style={styles.installButton} onPress={onInstall}>
            <Text style={styles.installText}>Add to home screen</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={remember} hitSlop={8}>
          <Text style={styles.dismiss}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (theme: Theme) => ({
  card: {
    marginTop: 14,
    alignSelf: "stretch" as const,
    borderWidth: 1,
    borderColor: theme.colors.divider,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surfaceAlt,
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  title: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 15,
    fontWeight: "700" as const,
    color: theme.colors.inkStrong,
  },
  body: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.inkMuted,
  },
  actions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "flex-end" as const,
    gap: 16,
    marginTop: 2,
  },
  installButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.button,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  installText: {
    fontFamily: theme.fonts.bodyStrong,
    fontSize: 14,
    fontWeight: "700" as const,
    color: theme.colors.accentInk,
  },
  dismiss: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    color: theme.colors.inkMuted,
  },
});
