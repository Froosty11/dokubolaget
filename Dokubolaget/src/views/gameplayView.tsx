import { useEffect, useState } from "react";
import { FlatList, Image, Pressable, ScrollView as RNScrollView, StyleSheet, Text, View, useWindowDimensions, Animated } from "react-native";
import { Style } from "../AppStyles"
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics"
import { formatTagLabel, getTagIconName, getTagImageUrl } from "../tagDisplay";
import { AlertDialog, ScrollView, XStack, YStack } from "tamagui";
import DokubolagetLogo from "../../assets/Dokubolaget3.svg";
import InfoIcon from "../../assets/info.svg";
import { Confetti } from "../components/Confetti";
import { AnimatedCellSlot, AnimatedHeader, type HeaderRevealState } from "./boardAnimations";
import type { GuessFeedback } from "../dokuModel";

type BoardTag = {
  id: string;
  label: string;
  family: string;
};

type GameViewProps = {
  score: number;
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
};

const FEEDBACK_COLORS: Record<GuessFeedback["kind"], { background: string; text: string }> = {
  correct: { background: "#d4edda", text: "#155724" },
  near: { background: "#fff1c2", text: "#7a5a00" },
  miss: { background: "#f8d7da", text: "#721c24" },
};

type CellContentProps = {
  item: number;
  selectedProduct: any;
};


export function GameView(props: Readonly<GameViewProps>) {
  const {
    score,
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
  } = props;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Fit the board to whichever dimension is tighter. Laptops are wide but
  // short, so sizing from width alone pushed the bottom row off-screen.
  const TAB_BAR_AND_PADDING = 56 + 32 + 10;
  const logoHeight = Math.round(Math.min(110, Math.max(56, windowHeight * 0.12)));
  const boardSize = Math.max(
    280,
    Math.min(windowWidth - 16, 720, windowHeight - TAB_BAR_AND_PADDING - logoHeight),
  );
  const cellSize = boardSize / 4;

  // Gameboard stylesheet
  const board = StyleSheet.create({
    board: {
      width: cellSize * 3,
      height: cellSize * 3
    },
    cellSlot: {
      padding: 5,
      width: cellSize,
      height: cellSize
    },
    cell: {
      flex: 1,
      flexDirection: "column",
      rowGap: 3,
      borderRadius: 3,
      borderBottomWidth: 1,
      borderRightWidth: 1,
  		borderColor: "#e0e0e0",
      backgroundColor: "#ffffff",
      padding: 5,
      width: "100%",
    },
    cellLabelWrap: {
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    cellLabel: {
      fontFamily: "InterVariable",
      textAlign: "center",
    },
    category: {
      flex: 1,
      padding: 5,
      borderWidth: 1,
      borderRadius: 3,
  		borderColor: "#e0e0e0",
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    categoryImage: {
      width: 32,
      height: 32,
      resizeMode: "contain",
    },
    categoryIcon: {
      color: "#262626",
    },
    categoryLabel: {
      fontFamily: "BolagetMediumCondensed",
      marginTop: 4,
      backgroundColor: "#fff",
      paddingVertical: 4,
      paddingHorizontal: 6,
      borderRadius: 10,
      textAlign: "center"
    },
    tutorialCloseButton: {
      fontFamily: "InterVariable",
      color: "#262626",
      backgroundColor: "#d6e9df",
      padding: 5,
      borderRadius: 5
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
      fontFamily: "Monopol",
      fontSize: 24,
      fontWeight: "600",
      textAlign: "center",
    }
  })

  // console.log(gameCells)

  return (
    <RNScrollView
      style={{ flex: 1, backgroundColor: Style.body.backgroundColor }}
      contentContainerStyle={[Style.body, { height: undefined, flexGrow: 1 }]}
    >
        <View style={{ height: logoHeight, width: (logoHeight * 496) / 283 }}>
          <DokubolagetLogo width="100%" height="100%" />
        </View>

      {/* game window */}
      <View style={{alignSelf: "center", width: boardSize, height: boardSize, position: "relative"}}>

        <View style={{flexDirection: "row", height: cellSize}}>
          {/* top left */}
          <View style={{padding: 5, width: cellSize, height: cellSize, alignItems: "center", justifyContent: "center" }}>
            {/*Tutorial popup*/}
            {tutorialPopup()}
          </View>


          {/* top categories */}
          <View style={{flexDirection: "row", width: cellSize * 3}}>
            {topCategories.map((category, index) =>
              categoryRenderCB(category, index, index)
            )}
          </View>
        </View>

        <View style={{flexDirection: "row", height: cellSize * 3 }}>
          {/* side categories */}
          <View style={{ width: cellSize }}>
            {sideCategories.map((category, index) =>
              categoryRenderCB(category, index, 3 + index)
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
              x={cellSize * (col + 1) + cellSize / 2}
              y={cellSize * (row + 1) + cellSize / 2}
              onDone={() => onBurstDone(burst.id)}
            />
          );
        })}

        {feedback && (
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
    </RNScrollView>
  );

  // Tutorial
  function tutorialPopup() {
    return (
      <AlertDialog open={tutorialOpen} onOpenChange={(open)=>{if(!open) closeTutorialACB()}}>
        <AlertDialog.Trigger asChild>
          <Pressable onPress={openTutorialACB} /*style={Style.tutorialButton}*/>
            <InfoIcon width={24} height={24} fill={board.categoryIcon.color} />
          </Pressable>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay key="overlay" opacity={0.5} /*style={Style.tutorialOverlay}*//>
            <AlertDialog.Content
              bordered
            elevate>
            <YStack gap="$4" >
              <AlertDialog.Title style={{fontFamily: "Monopol"}}>How to play!</AlertDialog.Title>
              <ScrollView key="scroll" style={{maxHeight: 300}} showsVerticalScrollIndicator>
                <Text style={{fontFamily: "InterVariable", letterSpacing: -0.2}}>
                  The goal of this game is to fill in the 3x3 grid with products that match both of the categories on the top and the left side of the board.{"\n\n"}
                  You only have the 9 guesses total when answering so choose wisely. Only one product may be used per board. The uniqueness score is the sum of the total score on that board and that is the tallied up against other players.{"\n\n"}
                </Text>
                <Text style={{fontFamily: "InterVariable", fontSize: 12}}>New gameboards are genereated at 2 AM GST +1 </Text>
              </ScrollView>

            <XStack justifyContent="flex-end" gap="$2">
              <AlertDialog.Action asChild>
                <Pressable onPress={closeTutorialACB} /*style={Style.tutorialCloseButton}*/>
                  <Text style={board.tutorialCloseButton}>Ok, let's play!</Text>
                </Pressable>
              </AlertDialog.Action>
            </XStack>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
    )
  }

  // Render categories along top and side
  function categoryRenderCB(category: BoardTag, index: number, revealOrder: number) {
    const imageUrl = getTagImageUrl(category);
    const iconName = imageUrl ? null : getTagIconName(category);
    const icon = iconName ? (
      <MaterialCommunityIcons name={iconName as any} size={28} color="#2D2926" style={board.categoryIcon} />
    ) : null;
    return (
      <AnimatedHeader
        key={category.id + "-" + String(index)}
        slotStyle={board.cellSlot}
        reveal={headerReveal}
        revealOrder={revealOrder}
        pulseNonce={pulseNonceByTag[category.id] || 0}
      >
        <View style={board.category}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={board.categoryImage} />
          ) : iconName ? (
            <MaterialCommunityIcons name={iconName as any} size={28} color="#2D2926" style={board.categoryIcon} />
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

    function onCellPressedACB() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      if (selectedProduct) {
        onFilledCellPressed(item);
      } else {
        onCellPressed(item);
      }
    }

    return (
      <AnimatedCellSlot
        slotStyle={board.cellSlot}
        cellStyle={board.cell}
        filled={Boolean(selectedProduct)}
        flipNonce={flipNonceByCell[item] || 0}
        shakeNonce={shakeNonceByCell[item] || 0}
        index={item - 1}
        onPress={onCellPressedACB}
      >
        <CellContent item={item} selectedProduct={selectedProduct} />
      </AnimatedCellSlot>
    );
  }

function CellContent({
  item,
  selectedProduct,
}: Readonly<CellContentProps>) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [selectedProduct?.image]);

  const shouldShowImage = Boolean(selectedProduct?.image) && !imageFailed;

  if (shouldShowImage) {
    return (
      <Image
        source={{ uri: selectedProduct.image }}
        style={Style.cellImage}
        onError={() => setImageFailed(true)}
      />
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
}

}
