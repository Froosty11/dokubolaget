import { StyleSheet, Animated } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { observer } from "mobx-react-lite"
import { GameView } from "../views/gameplayView"
import { router } from "expo-router"
import { BoardTag } from "../dokuModel"
import { useEffect, useState, useRef } from "react"
import * as Haptics from "expo-haptics"

//TODO already exists in dokuModel, should be shared
/*type BoardTag = {
  id: string;
  label: string;
  family: string;
}*/
//TODO try to move contents of GameplayProps into model and only pass model as a prop
let tutorialShownForSession = false;

type GameplayProps = {
  model: {
    score: number;
    boardLoadPromiseState: any;
    setCurrentCell: (cell: number) => void
    topCategories: BoardTag[]
    sideCategories: BoardTag[]
    gameCells: number[]
    selectedProductsByCell: Record<number, any>
    lastFeedback: { isCorrect: boolean; message: string } | null
    clearLastFeedback: () => void
}
}

const Gameplay = observer(function GameRender({ model }: GameplayProps) {
    const [feedback, setFeedback] = useState<{ isCorrect: boolean; message: string } | null>(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (model.lastFeedback) {
        fadeAnim.setValue(1);
        setFeedback(model.lastFeedback);
        model.clearLastFeedback();

        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          })
        ]).start(() => {
          setFeedback(null);
        });
      }
    }, [model.lastFeedback]);

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

    function openTutorialACB() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setTutorialOpen(true);
    }

    function closeTutorialACB() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      setTutorialOpen(false);
    }

    return (
      <SafeAreaView style={styles.container}>
        {/* The model always has a board (bundled fallback, swapped for the
            Firestore one when that lookup finishes), so don't gate the
            game on the background refresh — on web it takes seconds. */}
        <GameView
          score={model.score}
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
        />
      </SafeAreaView>
    )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
})

export default Gameplay