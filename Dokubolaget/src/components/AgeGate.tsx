import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Dialog } from "tamagui";
import DokubolagetLogo from "../../assets/Dokubolaget3.svg";
import { haptics } from "../theme/haptics";
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import type { Theme } from "../theme/types";
import { ResponsibleNote } from "./ResponsibleNote";

const AGE_VERIFIED_KEY = "verified";

// The ID check: shown once per device, on Home and on scan links (which can
// be the first page a visitor ever opens). `isOpen` is null while the stored
// answer is still being read.
export function useAgeGate() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(AGE_VERIFIED_KEY)
      .then((stored) => setIsOpen(stored !== "true"))
      .catch((error) => {
        console.warn("Age-gate read failed:", error);
        setIsOpen(true);
      });
  }, []);

  function acceptAgeACB() {
    haptics.play("tap");
    AsyncStorage.setItem(AGE_VERIFIED_KEY, "true").catch((error) => console.warn("Age-gate write failed:", error));
    setIsOpen(false);
  }

  function rejectAgeACB() {
    haptics.play("tap");
    // window.location is web-only; Linking handles native too.
    Linking.openURL("https://www.systembolaget.se/under-20/").catch((error) => console.warn("Age-gate redirect failed:", error));
  }

  return { isOpen: isOpen === true, answered: isOpen === false, acceptAgeACB, rejectAgeACB };
}

type AgeGateProps = {
  isOpen: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function AgeGate({
  isOpen,
  onAccept,
  onReject,
}: AgeGateProps) {
  const age = useThemedStyles(makeAgeStyles);
  const { theme } = useTheme();
  if (!isOpen) return null;

  return (
    <Dialog modal open>
      <Dialog.Portal>
        <Dialog.Overlay style={age.overlay}/>
        <Dialog.Content style={age.content}>
          <DokubolagetLogo width={72} height={42}/>
          <Text style={age.title}>
            Hello, can we ask for ID?
          </Text>
          <View style={age.divider}/>
          <Text style={age.bodyText}>
            In the eyes of many, we are very age-obsessed.
            And we can only agree. Asking for ID is part of
            our work to protect young people from alcohol.
            {"\n\n"}
            This website contains information about alcohol.
            To visit it or shop, you must be 20 years of
            age or older.
          </Text>
          <View style={age.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                age.button,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onReject}
              accessibilityRole="button"
              accessibilityLabel="I am under 20"
            >
              <Text style={age.buttonText}>I am under 20</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                age.button,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={onAccept}
              accessibilityRole="button"
              accessibilityLabel="I have turned 20"
            >
              <Text style={age.buttonText}>I have turned 20</Text>
            </Pressable>
          </View>
          <ResponsibleNote color={theme.colors.dialogInk} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

const makeAgeStyles = (theme: Theme) => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.gateOverlay,
    opacity: 0.4, // Unsure whether to keep
  },
  content: {
    backgroundColor: theme.colors.dialogSurface,
    borderRadius: theme.radii.card,
    maxWidth: 320,
    padding: 30,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 16,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 28,
    textAlign: "center" as const,
    color: theme.colors.dialogInk,
  },
  divider: {
    height: 1,
    width: 56,
    backgroundColor: theme.colors.dialogInk,
  },
  bodyText: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
    flexWrap: "wrap" as const,
    color: theme.colors.dialogInk,
  },
  buttonRow: {
    gap: 12,
    paddingTop: 16,
    width: "100%" as const,
    alignItems: "stretch" as const,
  },
  button: {
    width: "100%" as const,
    backgroundColor: theme.colors.dialogButton,
    borderRadius: 999,  // <-- Guarantee round
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  buttonText: {
    fontFamily: theme.fonts.bodyStrong,
    fontWeight: "600" as const,
    fontSize: 16,
    color: theme.colors.dialogButtonInk,
  },
});
