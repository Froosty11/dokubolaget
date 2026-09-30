import { observer } from "mobx-react-lite";
import { IndexView } from "../views/indexView";
import { reactiveModel } from "../mobxReactiveModel";
import { useState, useEffect } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import * as Haptics from "expo-haptics"

//temp
type IndexProps = {
    model: typeof reactiveModel

    ageGate: {
        isOpen: boolean,
        acceptAgeACB: () => void,
        rejectAgeACB: () => void }
}

const AGE_VERIFIED_KEY = "verified";

const Index = observer(
    function (props: IndexProps,) {
        const [isOpen, setIsOpen] = useState(false);

        useEffect(() => {
            // AsyncStorage is cross-platform (uses localStorage on web,
            // SharedPreferences/Keychain on native). Wrapped in an async IIFE
            // so the effect itself stays sync per React's rules.
            (async () => {
                const stored = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
                setIsOpen(stored !== "true");
            })().catch(function ageGateReadErrorACB(error) {
                console.warn("Age-gate read failed:", error);
                setIsOpen(true);
            });
        }, []);

        function acceptAgeACB(){
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            AsyncStorage.setItem(AGE_VERIFIED_KEY, "true").catch(
                function ageGateWriteErrorACB(error) {
                    console.warn("Age-gate write failed:", error);
                },
            );
            setIsOpen(false);
        }

        function rejectAgeACB(){
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            // window.location is web-only; Linking handles native too.
            Linking.openURL("https://www.systembolaget.se/under-20/").catch(
                function rejectNavErrorACB(error) {
                    console.warn("Age-gate redirect failed:", error);
                },
            );

        }

        const ageGate = {
            isOpen,
            acceptAgeACB,
            rejectAgeACB
        }

        return (<IndexView
            ageGate={ageGate}
        />)

    }
);
export {Index}