import { getApp, getApps, initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

import { firebaseConfig } from "./firebaseConfig";

const SYSTEMBOLAGET_CACHE_COLLECTION = "appConfig";
const SYSTEMBOLAGET_CACHE_DOC = "dokubolagetSystembolagetApi";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

function getSystembolagetCacheDocACB() {
  return doc(db, SYSTEMBOLAGET_CACHE_COLLECTION, SYSTEMBOLAGET_CACHE_DOC);
}

export async function readCachedSystembolagetApiKeyACB() {
  const snapshot = await getDoc(getSystembolagetCacheDocACB());
  const data = snapshot.data() || {};
  return String(data.apiKey || "").trim();
}

export async function writeCachedSystembolagetApiKeyACB(
  apiKey: string,
  source = "scraper",
) {
  const normalizedApiKey = String(apiKey || "").trim();

  if (!normalizedApiKey) {
    return;
  }

  await setDoc(
    getSystembolagetCacheDocACB(),
    {
      apiKey: normalizedApiKey,
      source,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
}
