import { api } from "./api";
import { playSync, serverSync } from "./mobxReactiveModel";

export async function loginACB(email: string, password: string) {
    await api.login(email.trim(), password);
    await serverSync.afterLogin();
    playSync.refresh();
}

// The nickname is what the public leaderboard shows; the email stays private.
export async function signupACB(email: string, password: string, nickname: string) {
    await api.signup(email.trim(), password, nickname.trim());
    await serverSync.afterLogin();
    playSync.refresh();
}

export function logoutACB() {
    return serverSync.logout();
}

export function deleteAccountACB(email: string, password: string) {
    return serverSync.deleteAccount(email.trim(), password);
}

export function requestPasswordResetACB(email: string) {
    return api.requestReset(email.trim());
}

export function resetPasswordACB(token: string, password: string) {
    return api.resetPassword(token, password);
}
