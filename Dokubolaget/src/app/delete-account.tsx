import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { reactiveModel } from "../mobxReactiveModel";
import { useTheme } from "../theme/ThemeProvider";
import { deleteAccountACB } from "../utilities";

// Deletes an account. Reached from Home when logged in, and also works on its
// own on the website (dokubolaget.se/delete-account) for players without the
// app, which Google Play asks for.
export default function DeleteAccountPage() {
  const { theme, t } = useTheme();
  const { colors, fonts, radii } = theme;
  const [email, setEmail] = useState(() => reactiveModel.account?.email ?? "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "confirm" | "deleting" | "done">("idle");
  const [error, setError] = useState("");

  const text = { fontFamily: fonts.body, color: colors.ink };
  const input = {
    fontFamily: fonts.body,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: Math.min(8, radii.card),
    padding: 10,
    backgroundColor: colors.surfaceAlt,
  };
  const button = { borderRadius: radii.button, padding: 12, alignItems: "center" as const };

  async function submit() {
    if (status === "deleting") return;
    setError("");
    // First press asks again; the second one deletes.
    if (status !== "confirm") {
      setStatus("confirm");
      return;
    }
    setStatus("deleting");
    try {
      await deleteAccountACB(email, password);
      setPassword("");
      setStatus("done");
    } catch (error: any) {
      setError(error.message);
      setStatus("idle");
    }
  }

  function goHome() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <View style={{ width: "100%", maxWidth: 380, gap: 14, backgroundColor: colors.surface, borderRadius: radii.card, padding: 24, borderWidth: 1, borderColor: colors.divider }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, color: colors.inkStrong }}>
          {t("dialogs.delete.title")}
        </Text>
        {status === "done" ? (
          <>
            <Text accessibilityRole="alert" style={text}>
              {t("dialogs.delete.done")}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={{ ...button, backgroundColor: colors.accent }}>
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.accentInk }}>{t("dialogs.goHome")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={text}>
              {t("dialogs.delete.intro")}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("dialogs.delete.emailPlaceholder")}
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              accessibilityLabel={t("dialogs.delete.emailLabel")}
              style={input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t("dialogs.delete.passwordPlaceholder")}
              placeholderTextColor={colors.inkFaint}
              autoComplete="current-password"
              accessibilityLabel={t("dialogs.delete.passwordLabel")}
              onSubmitEditing={submit}
              style={input}
            />
            {!!error && <Text accessibilityRole="alert" style={{ fontFamily: fonts.body, color: colors.miss }}>{error}</Text>}
            {status === "confirm" && (
              <Text accessibilityRole="alert" style={{ fontFamily: fonts.bodyStrong, color: colors.miss }}>
                {t("dialogs.delete.confirmWarning")}
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={!email || !password}
              style={{ ...button, backgroundColor: colors.miss, opacity: email && password ? 1 : 0.5 }}
            >
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.surface }}>
                {status === "deleting" ? t("dialogs.delete.deleting") : status === "confirm" ? t("dialogs.delete.confirmButton") : t("dialogs.delete.button")}
              </Text>
            </Pressable>
            <Text style={{ fontFamily: fonts.body, color: colors.inkMuted }}>
              {t("dialogs.delete.forgotHint")}
            </Text>
            <Pressable accessibilityRole="button" onPress={goHome}>
              <Text style={{ ...text, textDecorationLine: "underline" }}>{t("dialogs.delete.cancel")}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
