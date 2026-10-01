import "@tamagui/native/setup-zeego";

import { DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { TamaguiProvider } from "tamagui";
import { tamaguiConfig } from "../../tamagui.config";
import { ThemeProvider } from "../theme/ThemeProvider";
import { reactiveModel } from "../mobxReactiveModel";

import { useFonts } from "expo-font";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function RootLayout() {
  useFonts({
    ...MaterialCommunityIcons.font,
    Monopol: require("../../assets/monopol.ttf"),
    // MonopolItalic: require("../../assets/monopolItalic.ttf"),
    BolagetMediumCondensed: require("../../assets/bolagetMediumCondensed.ttf"),
    InterVariable: require("../../assets/interVariable.ttf"),
    // InterVariableItalic: require("../../assets/interVariableItalic.ttf"),
  });

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
      <ThemeProvider model={reactiveModel}>
        <NavThemeProvider value={DefaultTheme}>
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
            <Stack.Screen name="themes" options={{ headerShown: false, presentation: "modal" }} />
            <Stack.Screen name="stamps" options={{ headerShown: false, presentation: "modal" }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="delete-account" options={{ headerShown: false }} />
            <Stack.Screen name="scan/[code]" options={{ headerShown: false }} />
          </Stack>
        </NavThemeProvider>
      </ThemeProvider>
    </TamaguiProvider>
  );
}
