import type { ComponentType } from "react";
import type { DecorationKind } from "../packSchema";
import type { ThemeId } from "../types";

export type DecorationProps = { screen?: "home" | "board"; reducedMotion: boolean };

// Each theme task registers its artwork here (see decorations/index.ts).
export const BACKDROPS: Partial<Record<ThemeId, ComponentType<DecorationProps>>> = {};
export const CELEBRATION_ART: Partial<Record<ThemeId, ComponentType<DecorationProps>>> = {};

// Decorations club themes can pick, drawn in the theme's own colours.
export type KitDecorationProps = DecorationProps & { colors: string[] };
export const DECORATIONS: Partial<Record<DecorationKind, ComponentType<KitDecorationProps>>> = {};
