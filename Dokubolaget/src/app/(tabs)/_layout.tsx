import { Tabs } from "expo-router";
import { observer } from "mobx-react-lite";
import { FC } from "react";
import { SvgProps } from "react-native-svg";
import "@tamagui/native/setup-zeego";
import Smakprofil from "../../../assets/smakprofil.svg";
import Drinks from "../../../assets/drinks.svg";
import LeaderboardIcon from "../../../assets/leaderboard.svg";
import * as Haptics from "expo-haptics"

export default observer(function TabsLayout() {

  function TabIcon({ Icon }: { Icon: FC<SvgProps> }) {
    return <Icon width={24} height={24} />;
  }

  const hapticListeners = {
    tabPress: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    }
  }

  return (
    <Tabs
      screenOptions={{
        tabBarLabelStyle: { fontFamily: "InterVariable" },
        // tabBarPosition: "top",
      }}
    >
      <Tabs.Screen
        name="index"
        listeners={hapticListeners}
        options={{
          title: "Home",
          tabBarIcon: () => <TabIcon Icon={Smakprofil}/>,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="gameplay"
        listeners={hapticListeners}
        options={{
          title: "Play!",
          tabBarIcon: () => <TabIcon Icon={Drinks}/>,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        listeners={hapticListeners}
        options={{
          title: "Leaderboard",
          tabBarIcon: () => <TabIcon Icon={LeaderboardIcon}/>,
          headerShown: false,
        }}
      />
    </Tabs>
  );
});
