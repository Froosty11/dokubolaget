import { Platform, useWindowDimensions } from "react-native";
import { isWideLayout } from "./layout";

// True on a wide browser window. Follows window resizes.
export function useWideLayout() {
  const { width } = useWindowDimensions();
  return isWideLayout(Platform.OS, width);
}
