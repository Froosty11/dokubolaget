// Playable products by product number, from the nightly products.json mirror.
// A product the mirror doesn't have yet (a new release) is looked up once at
// Systembolaget and cached for an hour.
import fs from "node:fs";
import { isPlayable } from "../src/playable";

export type CatalogProduct = Record<string, any> & { productNumber: string };
export class CatalogUnavailable extends Error {}

const HEAVY_FIELDS = ["priceHistory", "alcoholHistory", "imageModules", "otherSelections", "dishPoints"];
const LOOKUP_TTL_MS = 3_600_000;

function trim(product: any): CatalogProduct {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(product)) if (!HEAVY_FIELDS.includes(key)) out[key] = value;
  out.productNumber = String(product.productNumber);
  return out as CatalogProduct;
}

export function createCatalog(opts: { path: string | null; lookup?: (n: string) => Promise<any | null>; now?: () => number }) {
  const now = opts.now ?? (() => Date.now());
  let byNumber = new Map<string, CatalogProduct>();
  const looked = new Map<string, { product: CatalogProduct | null; at: number }>();

  function reload(): number {
    const next = new Map<string, CatalogProduct>();
    if (opts.path && fs.existsSync(opts.path)) {
      const list = JSON.parse(fs.readFileSync(opts.path, "utf8"));
      for (const product of Array.isArray(list) ? list : []) {
        if (product?.productNumber && isPlayable(product)) next.set(String(product.productNumber), trim(product));
      }
    }
    byNumber = next;
    return next.size;
  }

  async function get(productNumber: string): Promise<CatalogProduct | null> {
    const known = byNumber.get(productNumber);
    if (known) return known;
    const cached = looked.get(productNumber);
    if (cached && now() - cached.at < LOOKUP_TTL_MS) return cached.product;
    if (!opts.lookup) return null;
    let found: any;
    try {
      found = await opts.lookup(productNumber);
    } catch (error) {
      throw new CatalogUnavailable(String((error as Error)?.message ?? error));
    }
    const product = found && String(found.productNumber) === productNumber && isPlayable(found) ? trim(found) : null;
    looked.set(productNumber, { product, at: now() });
    return product;
  }

  function getKnown(productNumber: string): CatalogProduct | null {
    return byNumber.get(productNumber) ?? looked.get(productNumber)?.product ?? null;
  }

  reload();
  return {
    reload,
    get,
    getKnown,
    get size() {
      return byNumber.size;
    },
  };
}

export type Catalog = ReturnType<typeof createCatalog>;

const SEARCH = "https://api-extern.systembolaget.se/sb-api-ecommerce/v1/productsearch/search";

export function systembolagetLookup(
  sbKey: { get(): Promise<string> },
  fetchFn: typeof fetch = fetch,
  timeoutMs = 10_000,
) {
  return async (productNumber: string) => {
    const key = await sbKey.get();
    const response = await fetchFn(`${SEARCH}?textQuery=${encodeURIComponent(productNumber)}&size=10`, {
      headers: { "Ocp-Apim-Subscription-Key": key },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Systembolaget search HTTP ${response.status}`);
    const data: any = await response.json();
    return (data?.products ?? []).find((product: any) => String(product?.productNumber) === productNumber) ?? null;
  };
}
