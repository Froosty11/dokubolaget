import {loginACB, signupACB, logoutACB, subscribeToAuthChangesCB} from "../utilities";

export async function handleLoginACB(email: string, password: string, isSignUp: boolean) {
    if (isSignUp) {
        return signupACB(email, password);
    }
    return loginACB(email, password);
}

export async function handleLogoutACB() {
    return logoutACB();
}

export function authObserverCB(callback: any){
    return subscribeToAuthChangesCB(callback);
}
