import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

import { auth, setPendingNickname } from "./firestoreModel";

export function loginACB(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

// The nickname is what the public leaderboard shows; the email stays private.
export function signupACB(email: string, password: string, nickname: string) {
    setPendingNickname(nickname);
    return createUserWithEmailAndPassword(auth, email, password).catch(function clearNicknameACB(error) {
        setPendingNickname(null);
        throw error;
    });
}

export function logoutACB() {
    return signOut(auth);
}

export function subscribeToAuthChangesCB(callback: (user: any) => void) {
    return onAuthStateChanged(auth, callback);
}