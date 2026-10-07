// Native portals (dialogs, sheets) keep React context only through react-native-teleport.
import "@tamagui/native/setup-teleport";
import "@tamagui/native/setup-zeego";

import { DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../tamagui.config";
import { ThemeProvider } from "../theme/ThemeProvider";
import { reactiveModel } from "../mobxReactiveModel";

import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Sidebar } from "../components/Sidebar";
import { DocumentTitle } from "../components/DocumentTitle";
import { useWideLayout } from "../useWideLayout";

// On native, keep the splash screen up until the base fonts are registered;
// text laid out before then keeps the stand-in font's size on Android.
if (Platform.OS !== "web") SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialCommunityIcons.font,
    Monopol: require("../../assets/monopol.ttf"),
    // MonopolItalic: require("../../assets/monopolItalic.ttf"),
    BolagetMediumCondensed: require("../../assets/bolagetMediumCondensed.ttf"),
    InterVariable: require("../../assets/interVariable.ttf"),
    // InterVariableItalic: require("../../assets/interVariableItalic.ttf"),
  });
  const fontsSettled = fontsLoaded || fontError != null;
  // Wide browser windows get the sidebar, and Themes and Pub stamps open as
  // pages beside it instead of modals over everything.
  const wide = useWideLayout();
  const sheet = wide ? "card" : "modal";

  useEffect(() => {
    if (fontsSettled && Platform.OS !== "web") SplashScreen.hideAsync().catch(() => {});
  }, [fontsSettled]);

  if (Platform.OS !== "web" && !fontsSettled) return null;

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ThemeProvider model={reactiveModel}>
        <NavThemeProvider value={DefaultTheme}>
          {/* Same tree at every width, so crossing the breakpoint doesn't
              remount the navigator and lose where the player is. */}
          <View style={{ flex: 1, flexDirection: "row" }}>
            {wide ? <Sidebar /> : null}
            <View style={{ flex: 1 }}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="search"
                  options={{
                    headerShown: false,
                    presentation: "transparentModal",
                    contentStyle: { backgroundColor: "transparent" },
                  }}
                />
                <Stack.Screen name="themes" options={{ headerShown: false, presentation: sheet }} />
                <Stack.Screen name="stamps" options={{ headerShown: false, presentation: sheet }} />
                <Stack.Screen name="reset-password" options={{ headerShown: false }} />
                <Stack.Screen name="delete-account" options={{ headerShown: false }} />
                <Stack.Screen name="scan/[code]" options={{ headerShown: false }} />
              </Stack>
            </View>
          </View>
          <DocumentTitle />
        </NavThemeProvider>
      </ThemeProvider>
    </TamaguiProvider>
  );
}
