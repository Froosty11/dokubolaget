import Constants from "expo-constants";

// The app version, from app.json (single source of truth). Shown in the corner
// on Home so you can tell at a glance which build is deployed. Bump the
// "version" in app.json per release.
export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";
