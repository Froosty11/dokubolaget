import { expect, test } from "bun:test";
import { join } from "path";
import { CatalogUnavailable, createCatalog } from "./catalog";

const FIXTURE = join(import.meta.dir, "fixtures", "products.json");

test("keeps only playable products, without the heavy fields", async () => {
  const catalog = createCatalog({ path: FIXTURE });
  expect(catalog.size).toBe(4);
  expect((await catalog.get("1001"))!.productNameBold).toBe("Rioja Test");
  expect((await catalog.get("1001"))!.priceHistory).toBeUndefined();
  expect(await catalog.get("1002")).toBeNull();
});

test("a product the mirror doesn't have is looked up once, then cached", async () => {
  let calls = 0;
  const catalog = createCatalog({
    path: FIXTURE,
    lookup: async (n) => {
      calls += 1;
      return n === "2001" ? { productNumber: "2001", assortmentText: "Fast sortiment", productNameBold: "New" } : null;
    },
  });
  expect((await catalog.get("2001"))!.productNameBold).toBe("New");
  expect((await catalog.get("2001"))!.productNameBold).toBe("New");
  expect(await catalog.get("9999")).toBeNull();
  expect(calls).toBe(2);
  expect(catalog.getKnown("2001")!.productNameBold).toBe("New");
});

test("a failing lookup is 'unavailable', not 'not playable', and isn't cached", async () => {
  let fail = true;
  const catalog = createCatalog({
    path: null,
    lookup: async () => {
      if (fail) throw new Error("down");
      return { productNumber: "3001", assortmentText: "Säsong" };
    },
  });
  await expect(catalog.get("3001")).rejects.toBeInstanceOf(CatalogUnavailable);
  fail = false;
  expect((await catalog.get("3001"))!.productNumber).toBe("3001");
});

test("a missing file gives an empty catalogue", async () => {
  expect(createCatalog({ path: "/nope/products.json" }).size).toBe(0);
});
