import { router } from "expo-router";
import { haptics } from "../theme/haptics";
import { handleLogoutACB } from "../reactjs/authPresenter";
import type { Account } from "../api";
import { FC, use, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Dialog, Input, YStack } from "tamagui";
import { SvgProps } from "react-native-svg";
import  Leaderboard  from "../reactjs/leaderboardPresenter";
import { makeAppStyles } from "../AppStyles"
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import { ThemeLogo } from "../theme/ThemeLogo";
import { ThemeBackdrop } from "../theme/decorations/ThemeBackdrop";
import { ResponsibleNote } from "../components/ResponsibleNote";
import { AgeGate } from "../components/AgeGate";
import { SupportLink } from "../components/SupportLink";
import type { Theme } from "../theme/types";
import  AuthDialog from "./authDialogView";
import Chevron from "../../assets/chevron.svg";
import Drinks from "../../assets/drinks.svg";
import Smakprofil from "../../assets/smakprofil.svg";
import Lista from "../../assets/lista.svg";


/* === INDEX OPTIONS === */

interface IndexOptionProps {
  Icon: FC<SvgProps>;
  text: string;
  onPress: () => void;
}

function IndexOption({ Icon, text, onPress }: IndexOptionProps) {
  const { theme } = useTheme();
  const option = useThemedStyles(makeOptionStyles);
  return (
    <Pressable
      style={option.button}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Icon width={32} height={32} color={theme.colors.icon} />
      <View style={option.text}>
        <Text style={option.label}>{text}</Text>
        <Chevron width={24} height={24} opacity={0.65} color={theme.colors.inkMuted} />
      </View>
    </Pressable>
  )
}

const makeOptionStyles = (theme: Theme) => ({
  button: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingLeft: 6,
    paddingRight: 4,
    paddingVertical: 6,
    borderRadius: theme.radii.cell,
    backgroundColor: theme.colors.surface,
  },
  label: {
    fontFamily: theme.fonts.body,
    color: theme.colors.ink,
  },
  icon: {
    width: 32,
    height: 32,
    resizeMode: "contain"
  },
  text: {
    flex: 5,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
});

/* === INDEXVIEW === */

type IndexViewProps = {
  ageGate: { isOpen: boolean; acceptAgeACB: () => void; rejectAgeACB: () => void };
  // The logged-in player, or null.
  account: Account | null;
  supportUrl: string | null;
};

export function IndexView({ ageGate, account, supportUrl }: IndexViewProps) {
  const [showLogin, setShowLogin] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const { theme } = useTheme();
  const app = useThemedStyles(makeAppStyles);

  function dailyPlayACB() {
    haptics.play("tap")
    router.push("/gameplay");
  }

  // function showLeaderboardACB() {
  //   setShowLeaderboard(true);
  // }

  function themesACB() {
    haptics.play("tap")
    router.push("/themes");
  }

  function stampsACB() {
    haptics.play("tap");
    router.push("/stamps");
  }

  function loginACB() {
    haptics.play("tap")
    setShowLogin(true);
  }
  

  const isLoggedIn = account != null;

  return (
    <View style={app.body}>
      <ThemeBackdrop screen="home" />

      {/* Title */}
      <View style={{alignItems: "center"}}>
        <View style={{marginVertical: 20, width: "40%", aspectRatio: 1, alignItems: "center", justifyContent: "center"}}>
          <ThemeLogo height={110} fill />
        </View>
        <Text style={{fontFamily: theme.fonts.condensed, fontSize: 20, color: theme.colors.ink}}>Welcome to</Text>
        <Text style={{fontFamily: theme.fonts.display, fontSize: 40, color: theme.colors.ink}}>Dokubolaget</Text>
      </View>

      {/* Index menu */}
      <View style={{width: "100%", gap: 10, marginBottom: 16}}>
        <IndexOption
          Icon={Drinks}
          text="Daily play!"
          onPress={dailyPlayACB}
        />

        <IndexOption
          Icon={Lista}
          text="Themes"
          onPress={themesACB}
        />

        <IndexOption
          Icon={Drinks}
          text="Pub stamps"
          onPress={stampsACB}
        />

        {/* Login conditional rendering */}
        {!isLoggedIn ? (
          <IndexOption
            Icon={Smakprofil}
            text="Login / Sign up"
            onPress={loginACB}
          />
        ) : (
          <View style={{gap: 5}}>
            <Text style={{fontFamily: theme.fonts.body, color: theme.colors.ink}}>Logged in as {account?.nickname}</Text>
            <IndexOption
              Icon={Smakprofil}
              text="Logout"
              onPress={handleLogoutACB}
            />
            <Pressable accessibilityRole="link" onPress={() => router.push("/delete-account")}>
              <Text style={{fontFamily: theme.fonts.body, color: theme.colors.inkMuted, textDecorationLine: "underline"}}>Delete account</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={{marginBottom: 56, gap: 18}}>
        <SupportLink url={supportUrl} />
        <ResponsibleNote />
      </View>

      {/* Login dialog */}
      <AuthDialog 
        open={showLogin}
        onOpenChange={setShowLogin}
      />

      {/* Age verification dialog-component */}
      <AgeGate
        isOpen={ageGate.isOpen}
        // isOpen={true} // <-- Debug
        onAccept={ageGate.acceptAgeACB}
        onReject={ageGate.rejectAgeACB}
      />
    </View>
  );
}
