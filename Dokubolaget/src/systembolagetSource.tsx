import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  CORS_PROXY,
  SYSTEMBOLAGET_API_BASE,
  SYSTEMBOLAGET_API_KEY,
  SYSTEMBOLAGET_DEBUG,
  SYSTEMBOLAGET_WEBSITE,
} from "../apiConfig";
import {
  readCachedSystembolagetApiKeyACB,
  writeCachedSystembolagetApiKeyACB,
} from "./systembolagetCache";

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

const API_KEY_STORAGE_KEY_ACB = "dokubolaget.systembolagetApiKey";

let cachedApiKeyACB = SYSTEMBOLAGET_API_KEY || "";

function debugLogACB(...args: any[]) {
  if (SYSTEMBOLAGET_DEBUG) {
    console.log(...args);
  }
}

// CORS only exists in browsers. Native fetches the Systembolaget URL directly;
// without this gate, mobile devices try to hit the dev machine's localhost:8787
// proxy and fail with "Network request failed" (localhost on a phone = the phone).
const NEEDS_PROXY = Platform.OS === "web";

function getProxiedUrlACB(url: string) {
  if (!NEEDS_PROXY) {
    return url;
  }
  // local proxy format: /proxy?url=<encoded-target-url>
  return CORS_PROXY + encodeURIComponent(url);
}

debugLogACB("[SB DEBUG] Enabled:", SYSTEMBOLAGET_DEBUG);

function readWebStoredApiKeyACB() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY_ACB) || "";
  } catch (error) {
    return "";
  }
}

async function readLocalCachedApiKeyACB() {
  const webKey = readWebStoredApiKeyACB();
  if (webKey) {
    return webKey;
  }

  try {
    const value = (await AsyncStorage.getItem(API_KEY_STORAGE_KEY_ACB)) || "";
    debugLogACB("[SB DEBUG] AsyncStorage key present:", Boolean(value));
    return value;
  } catch (error) {
    debugLogACB("[SB DEBUG] AsyncStorage read failed:", error);
    return "";
  }
}

async function storeLocalCachedApiKeyACB(apiKey: string) {
  const normalizedApiKey = String(apiKey || "").trim();
  if (!normalizedApiKey) {
    return "";
  }

  cachedApiKeyACB = normalizedApiKey;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(API_KEY_STORAGE_KEY_ACB, normalizedApiKey);
    } catch (error) {
      // ignore storage failures
    }
  }

  try {
    await AsyncStorage.setItem(API_KEY_STORAGE_KEY_ACB, normalizedApiKey);
  } catch (error) {
    // ignore storage failures
  }

  return normalizedApiKey;
}

async function readServerCachedApiKeyACB() {
  try {
    const value = String(
      (await readCachedSystembolagetApiKeyACB()) || "",
    ).trim();
    debugLogACB("[SB DEBUG] Server key present:", Boolean(value));
    return value;
  } catch (error) {
    debugLogACB("[SB DEBUG] Server key read failed:", error);
    return "";
  }
}

async function storeServerCachedApiKeyACB(apiKey: string) {
  try {
    await writeCachedSystembolagetApiKeyACB(apiKey, "scraper");
  } catch (error) {
    // ignore server cache write failures
  }
}

function clearLocalCachedApiKeyACB() {
  cachedApiKeyACB = "";

  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY_ACB);
    } catch (error) {
      // ignore
    }
  }

  AsyncStorage.removeItem(API_KEY_STORAGE_KEY_ACB).catch(function ignoreACB() {
    return null;
  });
}

function gotResponseACB(response: Response) {
  if (!response.ok) {
    return response.text().then(function errorTextACB(text) {
      const errorMsg = text || response.statusText;
      if (response.status === 401 || response.status === 403) {
        debugLogACB(
          "[SB DEBUG] API auth error " + response.status + ":",
          errorMsg,
        );
      } else {
        console.error("API Error " + response.status + ":", errorMsg);
      }
      let parsedBody: any = text;

      if (text) {
        try {
          parsedBody = JSON.parse(text);
        } catch (error) {
          parsedBody = text;
        }
      }

      throw {
        status: response.status,
        statusText: response.statusText,
        body: parsedBody,
        rawText: text,
      };
    });
  }

  return response.text().then(function successTextACB(text) {
    // it someitmes returns json and sometimes not thanks systemet
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      console.warn("Non-JSON success response received:", text);
      return text;
    }
  });
}

function isExpiredOrInvalidKeyErrorACB(error: any) {
  const status = Number(
    error?.status || error?.response?.status || error?.body?.status,
  );
  if (status === 401 || status === 403) {
    return true;
  }

  const message = String(
    error?.message ||
      error?.body?.message ||
      error?.body?.error ||
      error?.rawText ||
      "",
  ).toLowerCase();

  return (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("subscription") ||
    message.includes("forbidden")
  );
}

function parseBundlePathsACB(html: string) {
  const pattern = /<script[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const paths: string[] = [];
  let match = pattern.exec(html);

  while (match) {
    paths.push(match[1]);
    match = pattern.exec(html);
  }

  const uniquePaths = Array.from(new Set(paths));
  if (uniquePaths.length === 0) {
    throw new Error("Could not find script src paths in website HTML");
  }

  return uniquePaths;
}

function parseApiKeyACB(bundleJs: string) {
  const patterns = [
    /NEXT_PUBLIC_API_KEY_APIM:"([^"]+)"/,
    /NEXT_PUBLIC_API_KEY_APIM\s*:\s*"([^"]+)"/,
    /NEXT_PUBLIC_API_KEY_APIM\s*=\s*"([^"]+)"/,
  ];

  for (let i = 0; i < patterns.length; i += 1) {
    const match = bundleJs.match(patterns[i]);
    if (match) {
      return match[1];
    }
  }

  throw new Error("Could not find API key in app bundle");
}

// API key extraction strategy (same idea as AlexGustafsson/systembolaget-api):
// 1. Fetch systembolaget.se HTML.
// 2. Find the Next.js _app bundle script path.
// 3. Fetch that JavaScript bundle.
// 4. Read NEXT_PUBLIC_API_KEY_APIM from the bundle source.
// Note: Uses CORS proxy for development. Once API key is approved, set EXPO_PUBLIC_SYSTEMBOLAGET_API_KEY env var which should skip everything.
function extractApiKeyFromWebsite() {
  debugLogACB("[SB DEBUG] Extracting API key from website...");
  return fetch(getProxiedUrlACB(SYSTEMBOLAGET_WEBSITE))
    .then(function websiteResponseACB(response) {
      if (!response.ok)
        throw new Error("Failed to fetch website: " + response.status);
      debugLogACB(
        "[SB DEBUG] Website response:",
        response.status,
        response.headers.get("content-type"),
      );
      return response.text();
    })
    .then(function websiteHtmlACB(html) {
      const scriptPaths = parseBundlePathsACB(html);
      const jsCandidates = scriptPaths.filter(function filterJsPathsACB(path) {
        return /\.js($|\?)/i.test(path);
      });
      const prioritizedCandidates = jsCandidates.filter(
        function prioritizeACB(path) {
          return /_next|static|chunk|app/i.test(path);
        },
      );
      const orderedCandidates = [
        ...prioritizedCandidates,
        ...jsCandidates.filter(function nonPrioritizedACB(path) {
          return prioritizedCandidates.indexOf(path) === -1;
        }),
      ];

      debugLogACB("[SB DEBUG] Script src count:", scriptPaths.length);
      debugLogACB("[SB DEBUG] JS candidate count:", jsCandidates.length);

      if (orderedCandidates.length === 0) {
        throw new Error("No JavaScript script paths found in website HTML");
      }

      function tryBundleCandidateACB(index: number): Promise<string> {
        if (index >= orderedCandidates.length) {
          throw new Error(
            "Could not find API key in any bundle candidate. Tried " +
              orderedCandidates.length +
              " bundle(s).",
          );
        }

        const currentPath = orderedCandidates[index];
        const resolvedBundleUrl =
          currentPath.indexOf("http") === 0
            ? currentPath
            : SYSTEMBOLAGET_WEBSITE + currentPath;
        const requestBundleUrl = getProxiedUrlACB(resolvedBundleUrl);
        debugLogACB(
          "[SB DEBUG] Trying bundle",
          index + 1,
          "of",
          orderedCandidates.length,
          currentPath,
        );

        return fetch(requestBundleUrl)
          .then(function bundleResponseACB(bundleResponse) {
            if (!bundleResponse.ok) {
              throw new Error(
                "Failed to fetch bundle: " + bundleResponse.status,
              );
            }
            debugLogACB("[SB DEBUG] Bundle response:", bundleResponse.status);
            return bundleResponse.text();
          })
          .then(function bundleTextACB(bundleJs) {
            try {
              return parseApiKeyACB(bundleJs);
            } catch (error) {
              debugLogACB("[SB DEBUG] No key in candidate #", index + 1);
              return tryBundleCandidateACB(index + 1);
            }
          })
          .catch(function candidateErrorACB() {
            return tryBundleCandidateACB(index + 1);
          });
      }

      return tryBundleCandidateACB(0);
    })
    .catch(function extractErrorACB(error) {
      // console.warn (not console.error) so the React Native dev red-overlay
      // doesn't block interaction. The app boot doesn't need this key — only
      // product search does — so failures here are recoverable.
      console.warn("API key extraction failed:", error);
      throw error;
    });
}

async function resolveFreshApiKeyACB() {
  const extractedApiKey = await extractApiKeyFromWebsite();
  debugLogACB("[SB DEBUG] Fresh key extracted, writing caches");
  await Promise.all([
    storeLocalCachedApiKeyACB(extractedApiKey),
    storeServerCachedApiKeyACB(extractedApiKey),
  ]);
  return extractedApiKey;
}

type ResolvedApiKeyResult = {
  apiKey: string;
  source: "env" | "memory" | "local" | "server" | "fresh";
};

async function resolveApiKeyACB() {
  if (SYSTEMBOLAGET_API_KEY) {
    debugLogACB("[SB DEBUG] Using API key from environment");
    return {
      apiKey: SYSTEMBOLAGET_API_KEY,
      source: "env",
    } as ResolvedApiKeyResult;
  }

  if (cachedApiKeyACB) {
    debugLogACB("[SB DEBUG] Using in-memory cached key");
    return {
      apiKey: cachedApiKeyACB,
      source: "memory",
    } as ResolvedApiKeyResult;
  }

  const localCachedApiKey = await readLocalCachedApiKeyACB();
  if (localCachedApiKey) {
    debugLogACB("[SB DEBUG] Using local cached key");
    cachedApiKeyACB = localCachedApiKey;
    return {
      apiKey: localCachedApiKey,
      source: "local",
    } as ResolvedApiKeyResult;
  }

  const serverCachedApiKey = await readServerCachedApiKeyACB();
  if (serverCachedApiKey) {
    debugLogACB("[SB DEBUG] Using server cached key");
    cachedApiKeyACB = serverCachedApiKey;
    await storeLocalCachedApiKeyACB(serverCachedApiKey);
    return {
      apiKey: serverCachedApiKey,
      source: "server",
    } as ResolvedApiKeyResult;
  }

  debugLogACB("[SB DEBUG] No cache hit, scraping key");
  return {
    apiKey: await resolveFreshApiKeyACB(),
    source: "fresh",
  } as ResolvedApiKeyResult;
}

function buildQueryParamsACB(params: QueryParams = {}) {
  const queryParams = new URLSearchParams();

  Object.keys(params).forEach(function keyACB(key) {
    const value = params[key];

    if (value == null) {
      return;
    }

    queryParams.set(key, String(value));
  });

  return queryParams;
}

function makeApiRequest(url: string, params?: URLSearchParams) {
  function requestWithKeyACB(apiKey: string) {
    const headers = {
      "Ocp-Apim-Subscription-Key": apiKey,
    };

    const requestUrl = params ? url + "?" + params.toString() : url;
    //using proxy server since systemet is blocking localhost >:C
    const proxiedUrl = getProxiedUrlACB(requestUrl);
    return fetch(proxiedUrl, { headers }).then(gotResponseACB);
  }

  return resolveApiKeyACB().then(function requestWithResolvedKeyACB(resolved) {
    return requestWithKeyACB(resolved.apiKey).catch(
      function retryOnAuthFailureACB(error) {
        const isRetryableAuthError = isExpiredOrInvalidKeyErrorACB(error);
        const fromNonEnvCache = resolved.source !== "env";

        if (!isRetryableAuthError || !fromNonEnvCache) {
          throw error;
        }

        debugLogACB(
          "[SB DEBUG] Cached key rejected from source",
          resolved.source,
          "- refreshing",
        );
        clearLocalCachedApiKeyACB();
        return resolveFreshApiKeyACB().then(requestWithKeyACB);
      },
    );
  });
}

export function searchSystembolaget(
  endpoint: string,
  params: QueryParams = {},
) {
  const normalizedEndpoint = endpoint.replace(/^\/+/, "");
  const url = SYSTEMBOLAGET_API_BASE + "/" + normalizedEndpoint;
  const queryParams = buildQueryParamsACB(params);

  return makeApiRequest(url, queryParams).then(function logResultsACB(data) {
    const itemCount =
      data?.products?.length || data?.siteSearchResults?.length || 0;
    return data;
  });
}

export function getSystembolagetProduct(productNumber: string) {
  if (!productNumber) {
    throw new Error("productNumber is required");
  }

  const safeProductNumber = String(productNumber).trim();
  const url =
    SYSTEMBOLAGET_API_BASE +
    "/product/" +
    encodeURIComponent(safeProductNumber);

  return makeApiRequest(url).then(function logProductACB(product) {
    return product;
  });
}

function normalizeProductParamsACB(params: QueryParams = {}) {
  const normalized: QueryParams = {};

  Object.keys(params).forEach(function keyACB(key) {
    normalized[key] = params[key];
  });

  // product search endpoint expects textQuery.
  if (normalized.textQuery == null) {
    if (normalized.query != null) {
      normalized.textQuery = normalized.query;
    }
  }
  if (normalized.pageSize == null && normalized.size != null) {
    normalized.pageSize = normalized.size;
  }

  return normalized;
}

export function searchSystembolagetProducts(params: QueryParams = {}) {
  const normalizedParams = normalizeProductParamsACB(params);
  return searchSystembolaget("productsearch/search", normalizedParams);
}

export function searchSystembolagetStores(params: QueryParams = {}) {
  return searchSystembolaget("sitesearch/site", params);
}

export function searchByID(productNumber: string) {
  return getSystembolagetProduct(productNumber);
}

export function searchByName(name: string, params: QueryParams = {}) {
  const mergedParams: QueryParams = {};

  Object.keys(params).forEach(function keyACB(key) {
    mergedParams[key] = params[key];
  });

  mergedParams.textQuery = String(name || "");
  return searchSystembolagetProducts(mergedParams);
}
