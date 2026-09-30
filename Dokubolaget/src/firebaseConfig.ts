// Firebase web config. These are public identifiers (not secrets), but they
// can be overridden at build time so the app can point at a different Firebase
// project without a code change. Set EXPO_PUBLIC_FIREBASE_* in .env or in the
// Docker build args. Must be literal process.env.EXPO_PUBLIC_* reads so Expo
// inlines them at build time.

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCOvYxDCIKJ8WbilJkPOf1uxUVzSkN4Qrs",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "dokubolaget.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "dokubolaget",
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "dokubolaget.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "989253020321",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:989253020321:web:c71ed9ae2f426c4f53dee0",
};
