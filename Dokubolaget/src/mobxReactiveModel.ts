import { observable, reaction, configure } from "mobx";
import { model } from "./dokuModel";

import { connectToPersistence } from "./firestoreModel"


configure({ enforceActions: "never" });

export const reactiveModel = observable(model);
reaction(checkACB,sideEffectACB);

// TODO - Impelement this
connectToPersistence(reactiveModel, reaction)

// Pull today's board from Firestore on app start. Falls back silently to the
// local generated-boards.json pick already in reactiveModel.topCategories /
// sideCategories if Firestore has no doc for today.
reactiveModel.loadDailyBoardFromFirestore();


function checkACB() {
    //TODO
    // return myModel.currentCell ?
    return true;
}

function sideEffectACB() {
    //TODO
    // myModel.currentCellEffect() ?

}
