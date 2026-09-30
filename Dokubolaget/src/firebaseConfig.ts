// Firebase web config. These are public identifiers (not secrets), but they
// can be overridden at build time so the app can point at a different Firebase
// project without a code change. Set EXPO_PUBLIC_FIREBASE_* in .env or in the
// Docker build args.
const env = (globalThis as any)?.process?.env || {};

export const firebaseConfig = {
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCOvYxDCIKJ8WbilJkPOf1uxUVzSkN4Qrs",
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "dokubolaget.firebaseapp.com",
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "dokubolaget",
  storageBucket:
    env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "dokubolaget.firebasestorage.app",
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "989253020321",
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:989253020321:web:c71ed9ae2f426c4f53dee0",
};
