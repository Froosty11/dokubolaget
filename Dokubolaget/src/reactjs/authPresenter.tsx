import { loginACB, logoutACB, requestPasswordResetACB, signupACB } from "../utilities";

const NICKNAME = /^[^@<>]{2,24}$/;

export async function handleLoginACB(email: string, password: string, isSignUp: boolean, nickname = "") {
    if (isSignUp) {
        if (!NICKNAME.test(nickname.trim())) {
            throw new Error("Pick a nickname of 2 to 24 characters, without @. It's shown on the leaderboard instead of your email.");
        }
        return signupACB(email, password, nickname);
    }
    return loginACB(email, password);
}

export async function handleLogoutACB() {
    return logoutACB();
}

export async function handleResetRequestACB(email: string) {
    return requestPasswordResetACB(email);
}
