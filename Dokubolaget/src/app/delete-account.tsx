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
  const { theme } = useTheme();
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
          Delete account
        </Text>
        {status === "done" ? (
          <>
            <Text accessibilityRole="alert" style={text}>
              Your account is deleted, along with your nickname, saved progress and themes. You can keep playing logged out.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={{ ...button, backgroundColor: colors.accent }}>
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.accentInk }}>Go to Home</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={text}>
              This deletes your Dokubolaget account for good: your email, nickname, password, unlocked themes and saved
              progress. It's removed right away, and from our backups within 7 days.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              accessibilityLabel="Email"
              style={input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={colors.inkFaint}
              autoComplete="current-password"
              accessibilityLabel="Password"
              onSubmitEditing={submit}
              style={input}
            />
            {!!error && <Text accessibilityRole="alert" style={{ fontFamily: fonts.body, color: colors.miss }}>{error}</Text>}
            {status === "confirm" && (
              <Text accessibilityRole="alert" style={{ fontFamily: fonts.bodyStrong, color: colors.miss }}>
                This can't be undone. Press again to delete your account.
              </Text>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={submit}
              disabled={!email || !password}
              style={{ ...button, backgroundColor: colors.miss, opacity: email && password ? 1 : 0.5 }}
            >
              <Text style={{ fontFamily: fonts.bodyStrong, color: colors.surface }}>
                {status === "deleting" ? "Deleting..." : status === "confirm" ? "Yes, delete my account" : "Delete my account"}
              </Text>
            </Pressable>
            <Text style={{ fontFamily: fonts.body, color: colors.inkMuted }}>
              Forgot your password? Use "Forgot password?" in the login box first, then come back here.
            </Text>
            <Pressable accessibilityRole="button" onPress={goHome}>
              <Text style={{ ...text, textDecorationLine: "underline" }}>Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
