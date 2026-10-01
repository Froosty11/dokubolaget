import { useState } from "react";
import { Text, Pressable } from "react-native";
import { Dialog, Input, YStack } from "tamagui";

import { handleLoginACB, handleResetRequestACB } from "../reactjs/authPresenter";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Mode = "login" | "signup" | "forgot";

const TITLES: Record<Mode, string> = { login: "Login", signup: "Sign Up", forgot: "Forgot password" };
const ACTIONS: Record<Mode, string> = { login: "Login", signup: "Sign Up", forgot: "Send reset link" };

export default function AuthDialog({ open, onOpenChange }: Props) {
  const { theme } = useTheme();
  const text = { color: theme.colors.dialogInk, fontFamily: theme.fonts.body };
  const link = { ...text, textDecorationLine: "underline" as const };
  const inputColors = {
    color: theme.colors.dialogInk,
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.divider,
  } as const;

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setNotice("");
  }

  async function submitACB() {
    if (loading) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        await handleResetRequestACB(email);
        // Same message whether or not the account exists.
        setNotice("If there's an account for that email, a reset link is on its way. It works for one hour.");
        return;
      }
      await handleLoginACB(email, password, mode === "signup", nickname);
      onOpenChange(false);
      setEmail("");
      setPassword("");
      setNickname("");
      setMode("login");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay opacity={0.5} bg="black" />

        <Dialog.Content
          width={300}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.divider,
            borderRadius: theme.radii.card,
            backgroundColor: theme.colors.dialogSurface,
          }}
        >
          <YStack gap="$3">
            <Dialog.Title style={{ color: theme.colors.dialogInk, fontFamily: theme.fonts.bodyStrong, fontWeight: "700" }}>
              {TITLES[mode]}
            </Dialog.Title>

            {mode === "signup" && (
              <Input
                style={inputColors}
                placeholder="Nickname (shown on the leaderboard)"
                value={nickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                autoComplete="username"
                maxLength={24}
              />
            )}

            <Input
              style={inputColors}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              onSubmitEditing={mode === "forgot" ? submitACB : undefined}
            />

            {mode !== "forgot" && (
              <Input
                style={inputColors}
                placeholder="Password"
                type="password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                onSubmitEditing={submitACB}
              />
            )}

            {!!error && <Text style={text} accessibilityRole="alert">{error}</Text>}
            {!!notice && <Text style={text} accessibilityRole="alert">{notice}</Text>}

            <Pressable
              onPress={submitACB}
              disabled={loading}
              accessibilityRole="button"
              style={{
                backgroundColor: theme.colors.dialogButton,
                borderRadius: theme.radii.button,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ ...text, color: theme.colors.dialogButtonInk, fontFamily: theme.fonts.bodyStrong, fontWeight: "600" }}>
                {loading ? "Loading..." : ACTIONS[mode]}
              </Text>
            </Pressable>

            {mode === "login" && (
              <Pressable onPress={() => switchMode("forgot")} accessibilityRole="button">
                <Text style={link}>Forgot password?</Text>
              </Pressable>
            )}

            <Pressable onPress={() => switchMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")} accessibilityRole="button">
              <Text style={link}>
                {mode === "signup" ? "Already have an account? Login" : mode === "forgot" ? "Back to login" : "Need an account? Sign Up"}
              </Text>
            </Pressable>

            <Pressable onPress={() => onOpenChange(false)} accessibilityRole="button">
              <Text style={link}>Close</Text>
            </Pressable>
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
