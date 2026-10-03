import { Animated, Platform, Pressable, Share, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { observer } from "mobx-react-lite"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { GameView } from "../views/gameplayView"
import { BoardCompleteView } from "../views/boardCompleteView"
import { ThemeUnlockView } from "../views/themeUnlockView"
import type { ThemeId } from "../theme/types"
import type { HeaderRevealState } from "../views/boardAnimations"
import { Dossier, redactionKeysForTags } from "../components/Dossier"
import { router } from "expo-router"
import { BoardTag, GuessFeedback } from "../dokuModel"
import { useEffect, useState, useRef } from "react"
import { haptics } from "../theme/haptics";
import { useTheme } from "../theme/ThemeProvider"
import { composeFeedbackText } from "../theme/feedbackText"
import { receiptLines } from "../searchHelpers"

let tutorialShownForSession = false;

const LAST_REVEAL_KEY = "dokubolaget.lastHeaderReveal";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type GameplayProps = {
  model: {
    setCurrentCell: (cell: number) => void
    topCategories: BoardTag[]
    sideCategories: BoardTag[]
    gameCells: number[]
    selectedProductsByCell: Record<number, any>
    filledCellCount: number
    buildShareText: () => string
    lastFeedback: GuessFeedback | null
    clearLastFeedback: () => void
    recordBoardComplete: () => ThemeId[]
    justRestored: boolean
    supportUrl: string | null
    shiftPendingUnlock: (source?: "board" | "streak") => ThemeId | null
  }
}

function bump(map: Record<string | number, number>, key: string | number) {
  return { ...map, [key]: (map[key] || 0) + 1 };
}

async function shareTextACB(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (Platform.OS === "web") {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) {
        await nav.share({ text });
        return "shared";
      }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        return "copied";
      }
      return "failed";
    }
    await Share.share({ message: text });
    return "shared";
  } catch {
    return "failed";
  }
}

const Gameplay = observer(function GameRender({ model }: GameplayProps) {
    const { copy, setId } = useTheme();
    const [unlockCard, setUnlockCard] = useState<ThemeId | null>(null);
    const [feedback, setFeedback] = useState<GuessFeedback | null>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const [flipNonceByCell, setFlipNonceByCell] = useState<Record<number, number>>({});
    const [shakeNonceByCell, setShakeNonceByCell] = useState<Record<number, number>>({});
    const [pulseNonceByTag, setPulseNonceByTag] = useState<Record<string, number>>({});
    const [bursts, setBursts] = useState<Array<{ id: number; cell: number }>>([]);
    const burstIdRef = useRef(1);

    const [boardCompleteOpen, setBoardCompleteOpen] = useState(false);
    const [shareStatus, setShareStatus] = useState<"idle" | "shared" | "copied" | "failed">("idle");
    const previousFilledRef = useRef(model.filledCellCount);

    const [dossierCell, setDossierCell] = useState<number | null>(null);

    // Guess outcomes → animations + haptics.
    useEffect(() => {
      const next = model.lastFeedback;
      if (!next) return;

      fadeAnim.setValue(1);
      setFeedback({ ...next, message: composeFeedbackText(next, copy) });
      model.clearLastFeedback();

      if (next.kind === "correct") {
        haptics.play("correct");
        setFlipNonceByCell((current) => bump(current, next.cell) as Record<number, number>);
        const id = burstIdRef.current++;
        // Let the flip land before the confetti pops out of the cell.
        setTimeout(() => setBursts((current) => [...current, { id, cell: next.cell }]), 220);
      } else {
        haptics.play(next.kind === "near" ? "nearMiss" : "miss");
        setShakeNonceByCell((current) => bump(current, next.cell) as Record<number, number>);
        if (next.kind === "near" && next.matchedTagId) {
          setPulseNonceByTag((current) => bump(current, next.matchedTagId as string));
        }
      }

      Animated.sequence([
        Animated.delay(next.kind === "near" ? 1800 : 1200),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: Platform.OS !== "web",
        })
      ]).start(() => {
        setFeedback(null);
      });
    }, [model.lastFeedback]);

    // Board completion → celebration (only when it happens in this session).
    useEffect(() => {
      const previous = previousFilledRef.current;
      previousFilledRef.current = model.filledCellCount;
      // A board restored as already finished was celebrated when it happened.
      if (model.justRestored) {
        model.justRestored = false;
        return;
      }
      if (previous < 9 && model.filledCellCount === 9) {
        model.recordBoardComplete();
        setShareStatus("idle");
        const timer = setTimeout(() => {
          setBoardCompleteOpen(true);
          haptics.play("complete");
        }, 900);
        return () => clearTimeout(timer);
      }
    }, [model.filledCellCount]);

    const handleCellPress = (cell: number) => {
      model.setCurrentCell(cell)
      router.push({ pathname: "/search", params: { cell: String(cell) } })
    }

    const [tutorialOpen, setTutorialOpen] = useState(false);

    useEffect(() => {
      if (!tutorialShownForSession) {
        setTutorialOpen(true);
        tutorialShownForSession = true;
      }
    }, [])

    // First visit of the day: headers drop in one by one once the tutorial
    // is out of the way. Later visits show them immediately.
    const [headerReveal, setHeaderReveal] = useState<HeaderRevealState>("pending");
    const revealDueRef = useRef<boolean | null>(null);

    useEffect(() => {
      AsyncStorage.getItem(LAST_REVEAL_KEY)
        .catch(() => null)
        .then((value) => {
          revealDueRef.current = value !== todayKey();
          if (!revealDueRef.current) setHeaderReveal("shown");
        });
    }, []);

    useEffect(() => {
      if (headerReveal !== "pending" || tutorialOpen || revealDueRef.current == null) return;
      if (revealDueRef.current) {
        setHeaderReveal("animate");
        AsyncStorage.setItem(LAST_REVEAL_KEY, todayKey()).catch(() => {});
      } else {
        setHeaderReveal("shown");
      }
    });

    function openTutorialACB() {
      haptics.play("tap")
      setTutorialOpen(true);
    }

    function closeTutorialACB() {
      haptics.play("tap")
      setTutorialOpen(false);
    }

    async function onShareACB() {
      haptics.play("tap")
      setShareStatus(await shareTextACB(model.buildShareText()));
    }

    const shareGrid = model.buildShareText().split("\n").slice(1, 4);

    const dossierProduct = dossierCell != null ? model.selectedProductsByCell[dossierCell] : null;
    const dossierTags =
      dossierCell != null
        ? [
            model.sideCategories[Math.floor((dossierCell - 1) / 3)],
            model.topCategories[(dossierCell - 1) % 3],
          ]
        : [];

    return (
      <SafeAreaView style={styles.container}>
        {/* The model always has a board (bundled fallback, swapped for the
            server's one when that lookup finishes), so don't gate the
            game on the background refresh — on web it takes seconds. */}
        <GameView
          onCellPressed={handleCellPress}
          topCategories={model.topCategories}
          sideCategories={model.sideCategories}
          gameCells={model.gameCells}
          selectedProductsByCell={model.selectedProductsByCell}
          feedback={feedback}
          feedbackFadeAnim={fadeAnim}

          tutorialOpen={tutorialOpen}
          openTutorialACB={openTutorialACB}
          closeTutorialACB={closeTutorialACB}

          flipNonceByCell={flipNonceByCell}
          shakeNonceByCell={shakeNonceByCell}
          pulseNonceByTag={pulseNonceByTag}
          headerReveal={headerReveal}
          bursts={bursts}
          onBurstDone={(id) => setBursts((current) => current.filter((burst) => burst.id !== id))}
          onFilledCellPressed={(cell) => setDossierCell(cell)}
        />

        {dossierProduct ? (
          <Pressable style={styles.dossierBackdrop} onPress={() => setDossierCell(null)}>
            <View style={styles.dossierWrap}>
              <Dossier
                product={dossierProduct.raw ?? dossierProduct}
                redact={redactionKeysForTags(dossierTags)}
                revealed
              />
            </View>
          </Pressable>
        ) : null}

        {boardCompleteOpen ? (
          <BoardCompleteView
            filledCount={model.filledCellCount}
            shareGrid={shareGrid}
            shareStatus={shareStatus}
            receiptLines={receiptLines(model.selectedProductsByCell)}
            supportUrl={model.supportUrl}
            onShare={onShareACB}
            onClose={() => {
              setBoardCompleteOpen(false);
              setUnlockCard(model.shiftPendingUnlock("board"));
            }}
          />
        ) : null}

        {unlockCard ? (
          <ThemeUnlockView
            themeId={unlockCard}
            onTry={() => {
              setId(unlockCard);
              setUnlockCard(model.shiftPendingUnlock("board"));
            }}
            onLater={() => setUnlockCard(model.shiftPendingUnlock("board"))}
          />
        ) : null}
      </SafeAreaView>
    )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  dossierBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
  },
  dossierWrap: {
    maxWidth: "92%",
  },
})

export default Gameplay
