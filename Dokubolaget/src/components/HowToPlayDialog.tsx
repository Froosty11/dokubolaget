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
  const { theme } = useTheme();
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
            <AlertDialog.Title style={{fontFamily: fonts.display, color: colors.dialogInk}}>How to play!</AlertDialog.Title>
            <ScrollView key="scroll" style={{maxHeight: 300}} showsVerticalScrollIndicator>
              <Text style={{ fontFamily: fonts.body, color: colors.dialogInk, letterSpacing: -0.2, lineHeight: 21 }}>
                <Text style={{ fontFamily: fonts.bodyStrong }}>Fill the grid.</Text> Find a bottle that matches both its row and its column. Only bottles from Systembolaget's regular, local and seasonal ranges count.{"\n\n"}
                <Text style={{ fontFamily: fonts.bodyStrong }}>Rarer scores more.</Text> The fewer players who picked your bottle, the more it's worth (up to 100 a cell). Each miss costs 5 points, at most 20 per cell.{"\n\n"}
                <Text style={{ fontFamily: fonts.bodyStrong }}>A new board every day at 04:00.</Text>
              </Text>
            </ScrollView>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
              <AlertDialog.Action asChild>
                <Pressable onPress={onClose}>
                  <Text style={{ fontFamily: fonts.body, color: colors.dialogButtonInk, backgroundColor: colors.dialogButton, padding: 5, borderRadius: 5 }}>
                    Ok, let's play!
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
