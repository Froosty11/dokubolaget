import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

import { auth } from "./firestoreModel";

export function loginACB(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}

export function signupACB(email: string, password: string) {
    return createUserWithEmailAndPassword(auth, email, password);
}

export function logoutACB() {
    return signOut(auth);
}

export function subscribeToAuthChangesCB(callback: (user: any) => void) {
    return onAuthStateChanged(auth, callback);
}