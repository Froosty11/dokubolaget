import { Component, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion, useTheme } from "../ThemeProvider";
import { BACKDROPS, CELEBRATION_ART, DECORATIONS } from "./registry";
import "./index";

// A decoration that throws must never take the screen down with it.
export class DecorationBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("Theme decoration failed:", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

// Theme artwork behind a screen's content. Render it as the first child so
// everything after it draws on top.
export function ThemeBackdrop({ screen }: { screen: "home" | "board" }) {
  const { id, theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const Backdrop = BACKDROPS[id];
  // Club themes pick a decoration from the kit instead.
  const kind = theme.decoration?.kind;
  const Kit = !Backdrop && kind && kind !== "none" ? DECORATIONS[kind] : undefined;
  if (!Backdrop && !Kit) return null;
  const colors = theme.decoration?.colors.length ? theme.decoration.colors : [theme.colors.accent, theme.colors.highlight];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <DecorationBoundary key={id}>
        {Backdrop ? <Backdrop screen={screen} reducedMotion={reducedMotion} /> : Kit ? <Kit screen={screen} reducedMotion={reducedMotion} colors={colors} /> : null}
      </DecorationBoundary>
    </View>
  );
}

// Theme artwork above the board-complete card (a maypole, say).
export function ThemeCelebrationArt() {
  const { id } = useTheme();
  const reducedMotion = useReducedMotion();
  const Art = CELEBRATION_ART[id];
  if (!Art) return null;
  return (
    <View pointerEvents="none">
      <DecorationBoundary key={id}>
        <Art reducedMotion={reducedMotion} />
      </DecorationBoundary>
    </View>
  );
}
