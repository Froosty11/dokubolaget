import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { AlertDialog, ScrollView, YStack } from "tamagui";
import { useTheme } from "../theme/ThemeProvider";
import { useWideLayout } from "../useWideLayout";

type Props = {
  open: boolean;
  onClose: () => void;
  // The button that opens it, when there is one (the board's corner button).
  children?: ReactNode;
};

// The rules, shown on the board and from Home on wide screens.
export function HowToPlayDialog({ open, onClose, children }: Props) {
  const { theme, t } = useTheme();
  const { colors, fonts } = theme;
  const wide = useWideLayout();
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {children ? <AlertDialog.Trigger asChild>{children}</AlertDialog.Trigger> : null}
      <AlertDialog.Portal>
        <AlertDialog.Overlay key="overlay" opacity={0.5} />
        <AlertDialog.Content
          bordered
          elevate
          style={{ backgroundColor: colors.dialogSurface, borderColor: colors.divider, ...(wide ? { maxWidth: 480 } : null) }}>
          <YStack gap="$4" >
            <AlertDialog.Title style={{fontFamily: fonts.display, color: colors.dialogInk}}>{t("gameplay.howToPlayTitle")}</AlertDialog.Title>
            <ScrollView key="scroll" style={{maxHeight: 300}} showsVerticalScrollIndicator>
              <Text style={{ fontFamily: fonts.body, color: colors.dialogInk, letterSpacing: -0.2, lineHeight: 21 }}>
                <Text style={{ fontFamily: fonts.bodyStrong }}>{t("gameplay.howToFillTitle")}</Text>{t("gameplay.howToFillBody")}{"\n\n"}
                <Text style={{ fontFamily: fonts.bodyStrong }}>{t("gameplay.howToRarerTitle")}</Text>{t("gameplay.howToRarerBody")}{"\n\n"}
                <Text style={{ fontFamily: fonts.bodyStrong }}>{t("gameplay.howToNewBoard")}</Text>
              </Text>
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <AlertDialog.Action asChild>
                <Pressable onPress={onClose}>
                  <Text style={{ fontFamily: fonts.body, color: colors.dialogButtonInk, backgroundColor: colors.dialogButton, padding: 5, borderRadius: 5 }}>
                    {t("gameplay.howToPlayAction")}
                  </Text>
                </Pressable>
              </AlertDialog.Action>
            </View>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
