import {loginACB, signupACB, logoutACB, subscribeToAuthChangesCB} from "../utilities";
import { normalizeDisplayName } from "../firestoreModel";

export async function handleLoginACB(email: string, password: string, isSignUp: boolean, nickname = "") {
    if (isSignUp) {
        if (!normalizeDisplayName(nickname)) {
            throw new Error("Pick a nickname of 2 to 24 characters, without @. It's shown on the leaderboard instead of your email.");
        }
        return signupACB(email, password, nickname);
    }
    return loginACB(email, password);
}

export async function handleLogoutACB() {
    return logoutACB();
}

export function authObserverCB(callback: any){
    return subscribeToAuthChangesCB(callback);
}
