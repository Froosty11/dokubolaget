import { router } from "expo-router";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api, ApiRequestError } from "../api";
import { AgeGate, useAgeGate } from "../components/AgeGate";
import { clubThemes, reactiveModel } from "../mobxReactiveModel";
import { haptics } from "../theme/haptics";
import type { ClubThemeId, PackSummary } from "../theme/packSchema";
import { clubTheme } from "../theme/registry";
import { useTheme } from "../theme/ThemeProvider";
import { saveDeviceThemePrefs } from "../theme/themeStorage";
import { ClubUnlockView } from "../views/clubUnlockView";

type State =
  | { kind: "redeeming" }
  | { kind: "unlocked"; themeId: ClubThemeId; summary: PackSummary | null; downloaded: boolean }
  | { kind: "error"; message: string }
  | { kind: "offline" };

// /scan/<code>: the link in a pub's QR code. Often the first page a visitor
// ever opens, so the ID check comes first.
export const ScanPresenter = observer(function ScanPresenter({ code }: { code: string }) {
  const ageGate = useAgeGate();
  const { theme } = useTheme();
  const [state, setState] = useState<State>({ kind: "redeeming" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ageGate.answered) return;
    let cancelled = false;
    setState({ kind: "redeeming" });
    (async () => {
      try {
        const { themeId, summary } = await api.scan(code);
        const id = themeId as ClubThemeId;
        const downloaded = await clubThemes.ensure(id);
        reactiveModel.addUnlocks([id], "scan");
        reactiveModel.shiftPendingUnlock("scan");
        // Saved before anything is shown, so closing the tab now keeps it.
        saveDeviceThemePrefs(reactiveModel.themeId, reactiveModel.unlockedThemes);
        if (summary) reactiveModel.setClubSummaries(mergeSummary(reactiveModel.clubSummaries, summary));
        if (!cancelled) setState({ kind: "unlocked", themeId: id, summary, downloaded });
        if (downloaded) {
          const pattern = clubTheme(id)?.haptics;
          if (pattern) haptics.playPattern(pattern, "unlock");
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.status === 0) setState({ kind: "offline" });
        else setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ageGate.answered, code, attempt]);

  function home() {
    router.replace("/");
  }

  const { colors, fonts } = theme;
  const unlockedTheme = state.kind === "unlocked" ? clubTheme(state.themeId) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, alignItems: "center", justifyContent: "center", padding: 24 }}>
      {state.kind === "unlocked" && unlockedTheme && state.summary ? (
        <ClubUnlockView
          theme={unlockedTheme}
          club={state.summary.club}
          logoUrl={api.logoUrl(state.summary)}
          onWear={() => {
            reactiveModel.setThemeId(state.themeId);
            home();
          }}
          onLater={home}
        />
      ) : (
        <View style={{ maxWidth: 360, gap: 14, alignItems: "center" }}>
          <Text accessibilityRole="alert" style={{ fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlign: "center" }}>
            {state.kind === "redeeming"
              ? "Checking your code…"
              : state.kind === "offline"
                ? "You're offline. Connect and try again."
                : state.kind === "error"
                  ? state.message
                  : "Unlocked. The theme will download next time you're online."}
          </Text>
          {state.kind === "offline" ? (
            <Pressable onPress={() => setAttempt((n) => n + 1)} accessibilityRole="button" style={{ backgroundColor: colors.accent, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 6 }}>
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.accentInk }}>Retry</Text>
            </Pressable>
          ) : null}
          {state.kind !== "redeeming" ? (
            <Pressable onPress={home} accessibilityRole="link">
              <Text style={{ fontFamily: fonts.body, color: colors.ink, textDecorationLine: "underline" }}>Back to Home</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      <AgeGate isOpen={ageGate.isOpen} onAccept={ageGate.acceptAgeACB} onReject={ageGate.rejectAgeACB} />
    </View>
  );
});

function mergeSummary(list: PackSummary[], summary: PackSummary): PackSummary[] {
  return list.some((s) => s.id === summary.id) ? list.map((s) => (s.id === summary.id ? summary : s)) : [...list, summary];
}
