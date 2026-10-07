import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { observer } from "mobx-react-lite";
import { FC, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SvgProps } from "react-native-svg";
import Drinks from "../../assets/drinks.svg";
import LeaderboardIcon from "../../assets/leaderboard.svg";
import Lista from "../../assets/lista.svg";
import Smakprofil from "../../assets/smakprofil.svg";
import { RAIL_WIDTH, SIDEBAR_WIDTH } from "../layout";
import { reactiveModel } from "../mobxReactiveModel";
import { handleLogoutACB } from "../reactjs/authPresenter";
import { haptics } from "../theme/haptics";
import { ThemeLogo } from "../theme/ThemeLogo";
import { useTheme } from "../theme/ThemeProvider";
import AuthDialog from "../views/authDialogView";

function StampIcon({ width, color }: SvgProps) {
  return <MaterialCommunityIcons name="stamper" size={Number(width)} color={color as string} />;
}

function LoginIcon({ width, color }: SvgProps) {
  return <MaterialCommunityIcons name="account-circle-outline" size={Number(width)} color={color as string} />;
}

type NavItem = { href: string; label: string; Icon: FC<SvgProps>; matches: (path: string) => boolean };

// The board gets the room: there the sidebar shrinks to an icon rail. Search
// opens over the board, so it keeps the rail too.
function isRailPath(path: string) {
  return path.startsWith("/gameplay") || path.startsWith("/search");
}

// Navigation for the desktop web layout (src/layout.ts), in place of the
// bottom tab bar. Also holds the account, which phones show on Home.
export const Sidebar = observer(function Sidebar() {
  const { theme, copy } = useTheme();
  const { colors, fonts, radii } = theme;
  const path = usePathname();
  const rail = isRailPath(path);
  const [showLogin, setShowLogin] = useState(false);
  const account = reactiveModel.account;

  const items: NavItem[] = [
    { href: "/", label: copy.tabHome, Icon: Smakprofil, matches: (p) => p === "/" },
    { href: "/gameplay", label: copy.tabPlay, Icon: Drinks, matches: isRailPath },
    { href: "/leaderboard", label: copy.tabLeaderboard, Icon: LeaderboardIcon, matches: (p) => p.startsWith("/leaderboard") },
    { href: "/themes", label: "Themes", Icon: Lista, matches: (p) => p.startsWith("/themes") },
    { href: "/stamps", label: "Pub stamps", Icon: StampIcon, matches: (p) => p.startsWith("/stamps") },
  ];

  function go(href: string) {
    haptics.play("tap");
    router.navigate(href as any);
  }

  function loginACB() {
    haptics.play("tap");
    setShowLogin(true);
  }

  const linkText = { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, textDecorationLine: "underline" as const };

  return (
    <View
      role="navigation"
      style={{
        width: rail ? RAIL_WIDTH : SIDEBAR_WIDTH,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.divider,
        paddingVertical: 20,
        paddingHorizontal: rail ? 8 : 14,
        alignItems: rail ? "center" : "stretch",
        gap: 4,
        // Hover labels in the rail reach over the page.
        zIndex: 10,
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Dokubolaget, home"
        onPress={() => go("/")}
        style={{ alignItems: rail ? "center" : "flex-start", marginBottom: 18, paddingLeft: rail ? 0 : 6 }}
      >
        <ThemeLogo height={rail ? 26 : 64} />
      </Pressable>

      {items.map((item) => (
        <SidebarLink key={item.href} item={item} active={item.matches(path)} rail={rail} onPress={() => go(item.href)} />
      ))}

      <View style={{ flex: 1 }} />

      <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12, gap: 8, alignItems: rail ? "center" : "flex-start" }}>
        {account ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`Logged in as ${account.nickname}`}>
              <View style={{ width: 30, height: 30, borderRadius: radii.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: fonts.bodyStrong, color: colors.accentInk }}>{account.nickname.slice(0, 1).toUpperCase()}</Text>
              </View>
              {rail ? null : (
                <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.bodyStrong, color: colors.ink }}>{account.nickname}</Text>
              )}
            </View>
            {rail ? null : (
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Pressable accessibilityRole="button" onPress={handleLogoutACB}>
                  <Text style={linkText}>Log out</Text>
                </Pressable>
                <Pressable accessibilityRole="link" onPress={() => router.push("/delete-account")}>
                  <Text style={linkText}>Delete account</Text>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <SidebarLink
            item={{ href: "", label: "Log in / Sign up", Icon: LoginIcon, matches: () => false }}
            active={false}
            rail={rail}
            onPress={loginACB}
          />
        )}
      </View>

      <AuthDialog open={showLogin} onOpenChange={setShowLogin} />
    </View>
  );
});

function SidebarLink({ item, active, rail, onPress }: { item: NavItem; active: boolean; rail: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const { colors, fonts, radii } = theme;
  const { Icon } = item;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ hovered }: any) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 9,
        paddingHorizontal: rail ? 9 : 10,
        borderRadius: radii.cell,
        backgroundColor: active ? colors.surfaceAlt : hovered ? colors.page : "transparent",
      })}
    >
      {({ hovered }: any) => (
        <>
          <Icon width={24} height={24} color={active ? colors.accent : colors.icon} />
          {rail ? null : (
            <Text style={{ fontFamily: active ? fonts.bodyStrong : fonts.body, fontSize: 15, color: active ? colors.accent : colors.ink }}>
              {item.label}
            </Text>
          )}
          {rail && hovered ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute", left: RAIL_WIDTH - 4, paddingVertical: 4, paddingHorizontal: 8,
                backgroundColor: colors.ink, borderRadius: radii.cell,
              }}
            >
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.page }}>{item.label}</Text>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
