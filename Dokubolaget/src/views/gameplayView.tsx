import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Platform, Pressable, ScrollView as RNScrollView, StyleSheet, Text, View, useWindowDimensions, Animated } from "react-native";
import { makeAppStyles } from "../AppStyles"
import { useTheme, useThemedStyles } from "../theme/ThemeProvider";
import { ThemeLogo } from "../theme/ThemeLogo";
import { ThemeBackdrop } from "../theme/decorations/ThemeBackdrop";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { haptics } from "../theme/haptics";
import { formatTagLabel, getTagIconName, getTagImageUrl } from "../tagDisplay";
import InfoIcon from "../../assets/info.svg";
import { Confetti } from "../components/Confetti";
import { AnimatedCellSlot, AnimatedHeader, type HeaderRevealState } from "./boardAnimations";
import type { GuessFeedback } from "../dokuModel";
import { formatKronor } from "../searchHelpers";
import { HowToPlayDialog } from "../components/HowToPlayDialog";
import { RAIL_WIDTH } from "../layout";
import { useWideLayout } from "../useWideLayout";

type BoardTag = {
  id: string;
  label: string;
  family: string;
};

type GameViewProps = {
  onCellPressed: (cell: number) => void;
  topCategories: BoardTag[];
  sideCategories: BoardTag[];
  gameCells: number[];
  selectedProductsByCell: Record<number, any>;
  feedback: GuessFeedback | null;
  feedbackFadeAnim: Animated.Value;

  // Animation triggers, owned by the presenter.
  flipNonceByCell: Record<number, number>;
  shakeNonceByCell: Record<number, number>;
  pulseNonceByTag: Record<string, number>;
  headerReveal: HeaderRevealState;
  bursts: Array<{ id: number; cell: number }>;
  onBurstDone: (id: number) => void;
  onFilledCellPressed: (cell: number) => void;

  tutorialOpen: boolean;
  openTutorialACB: () => void;
  closeTutorialACB: () => void;

  boardStatus: "loading" | "ready" | "offline";
  practiceLabel: string | null;
  cellInfo: Record<number, { score: number | null; unicorn: boolean }>;
  toast: string | null;
};


type CellContentProps = {
  item: number;
  selectedProduct: any;
  info: { score: number | null; unicorn: boolean } | undefined;
};


export function GameView(props: Readonly<GameViewProps>) {
  const {
    onCellPressed,
    topCategories,
    sideCategories,
    gameCells,
    selectedProductsByCell,
    feedback,
    feedbackFadeAnim,
    tutorialOpen,
    openTutorialACB,
    closeTutorialACB,
    flipNonceByCell,
    shakeNonceByCell,
    pulseNonceByTag,
    headerReveal,
    bursts,
    onBurstDone,
    onFilledCellPressed,
    boardStatus,
    practiceLabel,
    cellInfo,
    toast,
  } = props;
  const { theme, t } = useTheme();
  const app = useThemedStyles(makeAppStyles);
  const { colors, fonts, radii, borders } = theme;
  const FEEDBACK_COLORS: Record<GuessFeedback["kind"], { background: string; text: string }> = {
    correct: { background: colors.correctBg, text: colors.correct },
    near: { background: colors.nearMissBg, text: colors.nearMiss },
    miss: { background: colors.missBg, text: colors.miss },
  };
  const glowText = theme.glow ? { textShadowColor: theme.glow.color, textShadowRadius: theme.glow.radius } : null;

  // Midsommar: cross-stitched headers and a faint flower in empty cells.
  const stitched = theme.id === "midsommar";
  // Speakeasy: stepped double gold frames on headers and solved cells.
  const deco = theme.id === "speakeasy";
  const decoFrame = deco ? (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1, borderColor: "rgba(212, 175, 55, 0.45)" }}
    />
  ) : null;
  // Neon themes glow around headers and solved cells.
  const glowBox = theme.glow
    ? { shadowColor: theme.glow.color, shadowOpacity: 1, shadowRadius: theme.glow.radius, shadowOffset: { width: 0, height: 0 } }
    : null;
  // Prislista draws the board as a ruled price-list table: no gaps, hairlines.
  const ruled = theme.flags.ruledTable;
  const slipFeedback = theme.flags.feedbackPlacement === "slip";
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Wide browser windows have the sidebar's icon rail instead of a tab bar,
  // and the logo sits in the rail, so the board gets that room.
  const wide = useWideLayout();
  // Fit the board to whichever dimension is tighter. Laptops are wide but
  // short, so sizing from width alone pushed the bottom row off-screen.
  // Themes that show feedback as a slip under the board need room for it.
  const TAB_BAR_AND_PADDING = (wide ? 0 : 56) + 32 + 10 + (slipFeedback ? 56 : 0);
  const logoHeight = wide ? 0 : Math.round(Math.min(110, Math.max(56, windowHeight * 0.12)));
  const availableWidth = windowWidth - (wide ? RAIL_WIDTH + 32 : 16);
  const boardSize = Math.max(
    280,
    Math.min(availableWidth, 720, windowHeight - TAB_BAR_AND_PADDING - logoHeight),
  );
  const cellSize = boardSize / 4;
  // Prislista's solved-cell bottle thumbnail, sized from the cell so it isn't a
  // tiny stamp on larger boards. The text column pads right to clear it.
  const thumbW = Math.max(22, Math.round(cellSize * 0.24));
  const thumbH = Math.max(52, Math.round(cellSize * 0.56));
  const thumbPad = thumbW + 8;

  // Gameboard stylesheet
  const board = StyleSheet.create({
    board: {
      width: cellSize * 3,
      height: cellSize * 3
    },
    cellSlot: {
      padding: ruled ? 0 : 5,
      width: cellSize,
      height: cellSize
    },
    cell: {
      flex: 1,
      flexDirection: "column",
      rowGap: 3,
      borderRadius: radii.cell,
      borderBottomWidth: borders.cell,
      borderRightWidth: borders.cell,
      borderColor: colors.cellBorder,
      backgroundColor: colors.cellFill,
      padding: 5,
      width: "100%",
    },
    ruledBoard: {
      borderTopWidth: borders.header,
      borderLeftWidth: borders.cell,
      borderColor: colors.ink,
    },
    numberCell: {
      flex: 1,
      justifyContent: "flex-start",
      gap: 2,
    },
    numberCellNr: {
      fontFamily: fonts.mono,
      fontSize: Math.max(9, cellSize * 0.1),
      color: colors.accent,
      paddingRight: thumbPad,
    },
    numberCellName: {
      fontFamily: fonts.display,
      fontSize: Math.max(10, cellSize * 0.11),
      lineHeight: Math.max(12, cellSize * 0.14),
      color: colors.ink,
      paddingRight: thumbPad,
    },
    numberCellPrice: {
      fontFamily: fonts.mono,
      fontSize: Math.max(10, cellSize * 0.11),
      color: colors.ink,
    },
    numberCellThumb: {
      position: "absolute",
      top: 2,
      right: 2,
      width: thumbW,
      height: thumbH,
      resizeMode: "contain",
      opacity: 0.95,
    },
    slip: {
      alignSelf: "center",
      width: boardSize,
      marginTop: 10,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.ink,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    slipText: {
      fontFamily: fonts.mono,
      fontSize: 13,
      lineHeight: 19,
    },
    cellLabelWrap: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    cellLabel: {
      fontFamily: fonts.body,
      color: colors.ink,
      textAlign: "center",
    },
    category: {
      flex: 1,
      padding: 5,
      ...(ruled
        ? { borderRightWidth: borders.cell, borderBottomWidth: borders.cell }
        : { borderWidth: borders.header }),
      borderRadius: radii.cell,
      borderColor: colors.headerCol,
      backgroundColor: theme.dark ? colors.surface : undefined,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    categoryImage: {
      width: 32,
      height: 32,
      resizeMode: "contain",
      ...(theme.flags.greyscaleFlags
        ? Platform.OS === "web"
          ? { filter: "grayscale(1) contrast(1.2)" }
          : { opacity: 0.85 }
        : {}),
    },
    categoryIcon: {
      color: colors.icon,
    },
    categoryLabel: {
      fontFamily: fonts.condensed,
      fontSize: 14 * theme.typeScale.headerLabel,
      color: colors.ink,
      marginTop: 4,
      backgroundColor: colors.headerLabelBg,
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: radii.pill,
      textAlign: "center",
      ...(glowText ?? {}),
    },
    feedbackOverlay: {
      position: "absolute",
      top: "50%",
      left: "50%",
      marginLeft: -120,
      marginTop: -40,
      width: 240,
      paddingVertical: 20,
      paddingHorizontal: 24,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    feedbackText: {
      fontFamily: fonts.display,
      fontSize: 24,
      fontWeight: "600",
      textAlign: "center",
    }
  })

  // console.log(gameCells)

  if (boardStatus === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <ThemeBackdrop screen="board" />
        <ActivityIndicator color={colors.accent} />
        <Text style={{ fontFamily: fonts.body, color: colors.inkMuted }}>{t("gameplay.loadingBoard")}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
    <ThemeBackdrop screen="board" />
    <RNScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[app.body, { height: undefined, flexGrow: 1, backgroundColor: "transparent" }]}
    >
        {wide ? null : <ThemeLogo height={logoHeight} />}

        {practiceLabel ? (
          <Text accessibilityRole="text" style={{ alignSelf: "center", fontFamily: fonts.bodyStrong, color: colors.inkMuted, marginBottom: 8, letterSpacing: 1, textTransform: "uppercase", fontSize: 12 }}>
            {practiceLabel}
          </Text>
        ) : null}

        {toast ? (
          <View accessibilityLiveRegion="polite" style={{ marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider }}>
            <Text style={{ fontFamily: fonts.body, color: colors.ink, textAlign: "center" }}>{toast}</Text>
          </View>
        ) : null}

      {/* game window */}
      <View style={[{alignSelf: "center", width: boardSize, height: boardSize, position: "relative"}, ruled ? board.ruledBoard : null]}>

        <View style={{flexDirection: "row", height: cellSize}}>
          {/* top left */}
          <View style={[
            {padding: 5, width: cellSize, height: cellSize, alignItems: "center", justifyContent: "center" },
            ruled ? { backgroundColor: colors.surfaceAlt, borderRightWidth: borders.cell, borderBottomWidth: borders.header, borderColor: colors.ink } : null,
          ]}>
            {/*Tutorial popup*/}
            {tutorialPopup()}
          </View>


          {/* top categories */}
          <View style={{flexDirection: "row", width: cellSize * 3}}>
            {topCategories.map((category, index) =>
              categoryRenderCB(category, index, index, "col")
            )}
          </View>
        </View>

        <View style={{flexDirection: "row", height: cellSize * 3 }}>
          {/* side categories */}
          <View style={{ width: cellSize }}>
            {sideCategories.map((category, index) =>
              categoryRenderCB(category, index, 3 + index, "row")
            )}
          </View>

          {/* game sudoku */}
          <FlatList
            data={gameCells}
            renderItem={cellRenderCB}
            numColumns={3}
            scrollEnabled={false}
            style={board.board}
            keyExtractor={String}
            extraData={[selectedProductsByCell, flipNonceByCell, shakeNonceByCell]}
          />
        </View>

        {bursts.map((burst) => {
          const col = (burst.cell - 1) % 3;
          const row = Math.floor((burst.cell - 1) / 3);
          return (
            <Confetti
              key={burst.id}
              mode="burst"
              seed={burst.id}
              shape={theme.confetti.shape}
              colors={theme.confetti.colors}
              x={cellSize * (col + 1) + cellSize / 2}
              y={cellSize * (row + 1) + cellSize / 2}
              onDone={() => onBurstDone(burst.id)}
            />
          );
        })}

        {feedback && !slipFeedback && (
          <Animated.View pointerEvents="none" style={[
            board.feedbackOverlay,
            {
              backgroundColor: FEEDBACK_COLORS[feedback.kind].background,
              opacity: feedbackFadeAnim,
            }
          ]}>
            <Text style={[
              board.feedbackText,
              { color: FEEDBACK_COLORS[feedback.kind].text }
            ]}>
              {feedback.message}
            </Text>
          </Animated.View>
        )}
      </View>

      {/* Prislista: a typed slip under the board instead of a popup. */}
      {feedback && slipFeedback ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[board.slip, { backgroundColor: FEEDBACK_COLORS[feedback.kind].background, opacity: feedbackFadeAnim }]}
        >
          <Text style={[board.slipText, { color: FEEDBACK_COLORS[feedback.kind].text }]}>{feedback.message}</Text>
        </Animated.View>
      ) : null}
    </RNScrollView>
    </View>
  );

  // Tutorial
  function tutorialPopup() {
    return (
      <HowToPlayDialog open={tutorialOpen} onClose={closeTutorialACB}>
        <Pressable onPress={openTutorialACB} accessibilityRole="button" accessibilityLabel={t("gameplay.howToPlayA11y")}>
          {deco ? (
            <View style={{ width: 34, height: 34, borderWidth: 1.5, borderColor: colors.accent, transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center" }}>
              <Text style={{ transform: [{ rotate: "-45deg" }], fontFamily: fonts.logo, fontSize: 18, color: colors.accent }}>?</Text>
            </View>
          ) : (
            <InfoIcon width={24} height={24} color={colors.icon} />
          )}
        </Pressable>
      </HowToPlayDialog>
    )
  }

  // Render categories along top and side
  function categoryRenderCB(category: BoardTag, index: number, revealOrder: number, axis: "col" | "row") {
    const imageUrl = getTagImageUrl(category);
    const iconName = imageUrl ? null : getTagIconName(category);
    return (
      <AnimatedHeader
        key={category.id + "-" + String(index)}
        slotStyle={board.cellSlot}
        reveal={headerReveal}
        revealOrder={revealOrder}
        pulseNonce={pulseNonceByTag[category.id] || 0}
        pulseColor={colors.pulse}
        radius={radii.cell}
      >
        {/* Keyed by theme: on Android, restyling this view in place for a new
            theme leaves its icon and label unpainted, so it's rebuilt instead. */}
        <View key={theme.id} style={[
          board.category,
          { borderColor: axis === "col" ? colors.headerCol : colors.headerRow },
          stitched ? { borderColor: colors.cellBorder, backgroundColor: colors.headerLabelBg } : null,
          glowBox ? { ...glowBox, shadowColor: axis === "col" ? colors.headerCol : colors.headerRow, shadowRadius: glowBox.shadowRadius * 0.8 } : null,
          ruled ? (axis === "col" ? { borderBottomWidth: borders.header } : { borderRightWidth: borders.header }) : null,
        ]}>
          {decoFrame}
          {stitched ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute", top: 4, left: 4, right: 4, bottom: 4,
                borderWidth: 2, borderStyle: "dashed", borderRadius: Math.max(0, radii.cell - 4),
                borderColor: axis === "col" ? colors.headerCol : colors.headerRow,
              }}
            />
          ) : null}
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[
                board.categoryImage,
                // Line-art header images are black; on dark themes draw them in the icon colour. Flags keep their colours.
                theme.dark && !imageUrl.includes("flagcdn") ? { tintColor: colors.icon } : null,
              ]}
            />
          ) : iconName ? (
            <MaterialCommunityIcons name={iconName as any} size={28} color={colors.icon} style={board.categoryIcon} />
          ) : null}
          <Text numberOfLines={3} style={board.categoryLabel}>{formatTagLabel(category)}</Text>
        </View>
      </AnimatedHeader>
    );
  }

  // Render game cells
  function cellRenderCB(renderInfo: { item: number }) {
    const item = renderInfo.item;
    const selectedProduct = selectedProductsByCell[item];
    const info = cellInfo[item];

    function onCellPressedACB() {
      haptics.play("tap")
      if (selectedProduct) {
        onFilledCellPressed(item);
      } else {
        onCellPressed(item);
      }
    }

    return (
      <AnimatedCellSlot
        slotStyle={board.cellSlot}
        cellStyle={[
          board.cell,
          selectedProduct && stitched ? { borderColor: colors.correct, borderWidth: 2.5 } : null,
          selectedProduct && glowBox ? { ...glowBox, borderColor: colors.correct, borderWidth: 1.5, backgroundColor: colors.correctBg } : null,
          selectedProduct && deco ? { borderColor: colors.accent, borderWidth: 1, backgroundColor: colors.surfaceAlt } : null,
        ]}
        filled={Boolean(selectedProduct)}
        flipNonce={flipNonceByCell[item] || 0}
        shakeNonce={shakeNonceByCell[item] || 0}
        shimmerColor={colors.cellShimmer}
        radius={radii.cell}
        index={item - 1}
        onPress={onCellPressedACB}
        accessibilityLabel={t("gameplay.cellAccessibility", {
          side: formatTagLabel(sideCategories[Math.floor((item - 1) / 3)]),
          top: formatTagLabel(topCategories[(item - 1) % 3]),
          detail: selectedProduct
            ? t(info?.unicorn ? "gameplay.cellFilledUnicorn" : "gameplay.cellFilled", {
                name: selectedProduct.name,
                score: info?.score ?? t("gameplay.scorePending"),
              })
            : t("gameplay.cellEmpty"),
        })}
      >
        <CellContent item={item} selectedProduct={selectedProduct} info={info} />
      </AnimatedCellSlot>
    );
  }

function CellContent({
  item,
  selectedProduct,
  info,
}: Readonly<CellContentProps>) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [selectedProduct?.image]);

  const shouldShowImage = Boolean(selectedProduct?.image) && !imageFailed;

  const content = (() => {
    if (selectedProduct && theme.flags.productNumberCells) {
      return (
        <View style={board.numberCell}>
          {shouldShowImage ? (
            <Image source={{ uri: selectedProduct.image }} style={board.numberCellThumb} onError={() => setImageFailed(true)} />
          ) : null}
          <Text style={board.numberCellNr}>NR {selectedProduct.raw?.productNumber}</Text>
          <Text numberOfLines={3} style={board.numberCellName}>{selectedProduct.name}</Text>
          <Text style={board.numberCellPrice}>{formatKronor(selectedProduct.raw?.price)}:-</Text>
        </View>
      );
    }

    if (shouldShowImage) {
      return (
        <Image
          source={{ uri: selectedProduct.image }}
          style={app.cellImage}
          onError={() => setImageFailed(true)}
        />
      );
    }

    if (selectedProduct && deco) {
      return (
        <View style={[board.cellLabelWrap, { flex: 1, justifyContent: "flex-end" }]}>
          {decoFrame}
          <Text style={{ position: "absolute", top: 4, left: 6, fontSize: 14 }}>🥃</Text>
          <Text numberOfLines={2} style={[board.cellLabel, { fontFamily: fonts.display, fontSize: Math.max(10, cellSize * 0.12), color: colors.inkStrong }]}>
            {selectedProduct.name}
          </Text>
          <Text style={{ fontFamily: fonts.bodyStrong, fontSize: 11, letterSpacing: 1, color: colors.accent }}>
            {formatKronor(selectedProduct.raw?.price)} KR
          </Text>
        </View>
      );
    }

    if (!selectedProduct && stitched) {
      return (
        <View style={[board.cellLabelWrap, { flex: 1 }]}>
          <Text style={{ fontSize: 22, color: colors.cellBorder }}>✿</Text>
        </View>
      );
    }

    return (
      <View style={board.cellLabelWrap}>
        <Text numberOfLines={2} style={board.cellLabel}>
          {/* {selectedProduct?.name || "Cell " + item} */}
          {selectedProduct?.name || ""}
        </Text>
      </View>
    );
  })();

  if (!selectedProduct) return content;

  return (
    <>
      {content}
      {info ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 3, right: 3, backgroundColor: colors.accent, borderRadius: radii.pill, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text style={{ fontFamily: fonts.bodyStrong, fontSize: 11, color: colors.accentInk }}>
            {info.unicorn ? "🦄 " : ""}{info.score ?? "…"}
          </Text>
        </View>
      ) : null}
    </>
  );
}

}
