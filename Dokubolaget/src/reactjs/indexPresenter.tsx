import { observer } from "mobx-react-lite";
import { IndexView } from "../views/indexView";
import { ThemeUnlockView } from "../views/themeUnlockView";
import { useTheme } from "../theme/ThemeProvider";
import { useAgeGate } from "../components/AgeGate";
import type { ThemeId } from "../theme/types";
import { reactiveModel } from "../mobxReactiveModel";
import { useState, useEffect } from "react";
import { View } from "react-native";

//temp
type IndexProps = {
    model: typeof reactiveModel

}


const Index = observer(
    function (props: IndexProps,) {
        const { setId } = useTheme();
        const [unlockCard, setUnlockCard] = useState<ThemeId | null>(null);
        const ageGate = useAgeGate();

        // Unlocks earned away from the board (streaks) are announced here.
        const hasPendingUnlock = reactiveModel.hasPendingUnlock("streak");
        useEffect(() => {
            if (!unlockCard && !ageGate.isOpen && hasPendingUnlock) {
                setUnlockCard(reactiveModel.shiftPendingUnlock("streak"));
            }
        }, [hasPendingUnlock, ageGate.isOpen, unlockCard]);

        return (
            <View style={{ flex: 1 }}>
                <IndexView ageGate={ageGate} account={reactiveModel.account} supportUrl={reactiveModel.supportUrl} />
                {unlockCard ? (
                    <ThemeUnlockView
                        themeId={unlockCard}
                        onTry={() => {
                            setId(unlockCard);
                            setUnlockCard(null);
                        }}
                        onLater={() => setUnlockCard(null)}
                    />
                ) : null}
            </View>
        )

    }
);
export {Index}