import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { resetPasswordACB } from "../utilities";

// Landing page for the link in the password reset email.
export default function ResetPasswordPage() {
  const params = useLocalSearchParams();
  const token = String(Array.isArray(params.token) ? params.token[0] : params.token ?? "");
  const { theme } = useTheme();
  const { colors, fonts, radii } = theme;
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      await resetPasswordACB(token, password);
      setStatus("done");
    } catch (error: any) {
      setError(error.message);
      setStatus("idle");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <View style={{ width: "100%", maxWidth: 360, gap: 14, backgroundColor: colors.surface, borderRadius: radii.card, padding: 24, borderWidth: 1, borderColor: colors.divider }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: 26, color: colors.inkStrong }}>
          New password
        </Text>
        {status === "done" ? (
          <>
            <Text style={{ fontFamily: fonts.body, color: colors.ink }}>Your password is changed. Log in with it from Home.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={{ backgroundColor: colors.accent, borderRadius: radii.button, padding: 12, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.accentInk }}>Go to Home</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="At least 8 characters"
              placeholderTextColor={colors.inkFaint}
              onSubmitEditing={submit}
              style={{ fontFamily: fonts.body, color: colors.ink, borderWidth: 1, borderColor: colors.divider, borderRadius: Math.min(8, radii.card), padding: 10, backgroundColor: colors.surfaceAlt }}
            />
            {!!error && <Text accessibilityRole="alert" style={{ fontFamily: fonts.body, color: colors.miss }}>{error}</Text>}
            <Pressable accessibilityRole="button" onPress={submit} disabled={!token} style={{ backgroundColor: colors.accent, borderRadius: radii.button, padding: 12, alignItems: "center", opacity: token ? 1 : 0.5 }}>
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.accentInk }}>{status === "saving" ? "Saving..." : "Set new password"}</Text>
            </Pressable>
            {!token ? <Text style={{ fontFamily: fonts.body, color: colors.inkMuted }}>This link is missing its code. Ask for a new reset email.</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}
