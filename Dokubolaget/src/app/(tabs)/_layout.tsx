import { Tabs } from "expo-router";
import { observer } from "mobx-react-lite";
import { FC } from "react";
import { SvgProps } from "react-native-svg";
import "@tamagui/native/setup-zeego";
import Smakprofil from "../../../assets/smakprofil.svg";
import Drinks from "../../../assets/drinks.svg";
import LeaderboardIcon from "../../../assets/leaderboard.svg";
import * as Haptics from "expo-haptics"
import { useTheme } from "../../theme/ThemeProvider";

export default observer(function TabsLayout() {

  const { theme, copy } = useTheme();

  function TabIcon({ Icon, color }: { Icon: FC<SvgProps>; color: string }) {
    return <Icon width={24} height={24} color={color} />;
  }

  const hapticListeners = {
    tabPress: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }

  return (
    <Tabs
      screenOptions={{
        tabBarLabelStyle: { fontFamily: theme.fonts.body },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.inkFaint,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.divider },
        // tabBarPosition: "top",
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={hapticListeners}
        options={{
          title: copy.tabHome,
          tabBarIcon: () => <TabIcon Icon={Smakprofil} color={theme.colors.icon} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="gameplay"
        listeners={hapticListeners}
        options={{
          title: copy.tabPlay,
          tabBarIcon: () => <TabIcon Icon={Drinks} color={theme.colors.icon} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        listeners={hapticListeners}
        options={{
          title: copy.tabLeaderboard,
          tabBarIcon: () => <TabIcon Icon={LeaderboardIcon} color={theme.colors.icon} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
});
