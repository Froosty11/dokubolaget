import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCandidateTags } from "../src/boardTags";

/*
Approximate generation prompt used for this script family:
- Build a 3-step pipeline for Dokubolaget.
- Step 1: find robust tags from products.json.
- Step 2: generate seeded 3x3 boards where all cells are completable.
- Step 3: confirm one generated board by counting exact solutions in each cell.
- Keep tags objective (for example alcohol, volume, container, taste clock);
  avoid subjective dish-pairing tags.
- Output code-friendly JSON in data/ so app code can consume it directly.

Run (step 2):
- bun run generate:board --seed 2026-04-12 --attempts 5000 --boards 3
- Defaults favour beatable boards: min 15 products per cell, at most one
  hard header (alcohol / taste clock), easy headers (beverage, country) rewarded.

Output:
- data/generated-boards.json
*/

type Product = Record<string, unknown>;

type Tag = {
  id: string;
  label: string;
  family: string;
  support: number;
  share: number;
  predicate: (product: Product) => boolean;
  conflicts?: string[];
};

type Board = {
  rows: Tag[];
  cols: Tag[];
  counts: number[][];
  score: number;
  difficulty: number;
  difficultyLabel: string;
};

type Args = {
  seed: string;
  minCellMatches: number;
  targetLow: number;
  targetHigh: number;
  attempts: number;
  boards: number;
  outFile?: string;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const productsPath = path.resolve(projectRoot, "..", "products.json");

function parseArgs(): Args {
  const defaults: Args = {
    seed: new Date().toISOString().slice(0, 10),
    minCellMatches: 15,
    targetLow: 40,
    targetHigh: 400,
    attempts: 5000,
    boards: 3,
    outFile: path.resolve(projectRoot, "data", "generated-boards.json"),
  };

  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--seed" && next) {
      defaults.seed = next;
      index += 1;
    } else if (arg === "--min-cell" && next) {
      defaults.minCellMatches = Number(next);
      index += 1;
    } else if (arg === "--target-low" && next) {
      defaults.targetLow = Number(next);
      index += 1;
    } else if (arg === "--target-high" && next) {
      defaults.targetHigh = Number(next);
      index += 1;
    } else if (arg === "--attempts" && next) {
      defaults.attempts = Number(next);
      index += 1;
    } else if (arg === "--boards" && next) {
      defaults.boards = Number(next);
      index += 1;
    } else if (arg === "--out" && next) {
      defaults.outFile = path.resolve(projectRoot, next);
      index += 1;
    }
  }

  return defaults;
}

function loadProducts(): Product[] {
  const raw = fs.readFileSync(productsPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected products.json to be an array");
  }

  return parsed as Product[];
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let temp = Math.imul(value ^ (value >>> 15), 1 | value);
    temp ^= temp + Math.imul(temp ^ (temp >>> 7), 61 | temp);
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleN<T>(values: T[], count: number, random: () => number): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy.slice(0, count);
}

function countByStringField(products: Product[], field: string) {
  const counts = new Map<string, number>();
  for (const product of products) {
    const value = product[field];
    if (typeof value !== "string" || !value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function createStringTags(
  products: Product[],
  map: Map<string, number>,
  field: string,
  family: string,
  prefix: string,
  limit: number,
  minShare: number,
  maxShare: number,
): Tag[] {
  const total = products.length;
  return topEntries(map, limit)
    .map(([value, support]) => {
      const share = support / total;
      return {
        id: `${prefix}:${value}`,
        label: `${prefix}:${value}`,
        family,
        support,
        share,
        predicate: (product: Product) => product[field] === value,
      };
    })
    .filter((tag) => tag.share >= minShare && tag.share <= maxShare);
}

function createBucketTags(
  products: Product[],
  field: string,
  family: string,
  buckets: Array<{
    key: string;
    label: string;
    test: (value: number) => boolean;
  }>,
  minShare: number,
  maxShare: number,
): Tag[] {
  const total = products.length;
  return buckets
    .map((bucket) => {
      let support = 0;
      for (const product of products) {
        const value = product[field];
        if (typeof value === "number" && bucket.test(value)) {
          support += 1;
        }
      }

      const share = support / total;
      return {
        id: `${family}:${bucket.key}`,
        label: bucket.label,
        family,
        support,
        share,
        predicate: (product: Product) => {
          const value = product[field];
          return typeof value === "number" && bucket.test(value);
        },
      };
    })
    .filter((tag) => tag.share >= minShare && tag.share <= maxShare);
}

function createTasteSymbolTags(
  products: Product[],
  limit: number,
  minShare: number,
  maxShare: number,
): Tag[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    const symbols = Array.isArray(product.tasteSymbols)
      ? (product.tasteSymbols as unknown[])
      : [];
    for (const symbol of symbols) {
      if (typeof symbol === "string" && symbol) {
        counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
      }
    }
  }

  const total = products.length;
  return topEntries(counts, limit)
    .map(([symbol, support]) => {
      const share = support / total;
      return {
        id: `tasteSymbol:${symbol}`,
        label: `Taste:${symbol}`,
        family: "taste",
        support,
        share,
        predicate: (product: Product) => {
          const symbols = Array.isArray(product.tasteSymbols)
            ? (product.tasteSymbols as unknown[])
            : [];
          return symbols.some((value) => value === symbol);
        },
      } as Tag;
    })
    .filter((tag) => tag.share >= minShare && tag.share <= maxShare);
}

function normalizeContainerType(value: string | null) {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("flaska")) return "Bottle";
  if (text.includes("burk")) return "Can";
  if (text.includes("box")) return "Box";
  if (text.includes("fat")) return "Keg";
  if (text.includes("påse")) return "Pouch";
  if (text.includes("papp")) return "Carton";
  if (text.includes("multipack")) return "Multipack";
  return null;
}

function normalizeContainerMaterial(value: string | null) {
  if (!value) return null;
  const text = value.toLowerCase();
  if (text.includes("glas")) return "Glass";
  if (text.includes("burk")) return "Aluminum/Metal";
  if (text.includes("pet") || text.includes("plast")) return "Plastic";
  if (text.includes("box") || text.includes("papp")) return "Paper/Cardboard";
  if (text.includes("påse")) return "Flexible/Plastic";
  if (text.includes("fat")) return "Metal/Keg";
  return null;
}

function countContainerDimensions(products: Product[]) {
  const typeCounts = new Map<string, number>();
  const materialCounts = new Map<string, number>();

  for (const product of products) {
    const packaging =
      typeof product.packagingLevel1 === "string"
        ? product.packagingLevel1
        : null;
    const bottleText =
      typeof product.bottleText === "string" ? product.bottleText : null;

    const type =
      normalizeContainerType(packaging) ?? normalizeContainerType(bottleText);
    const material =
      normalizeContainerMaterial(packaging) ??
      normalizeContainerMaterial(bottleText);

    if (type) typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    if (material)
      materialCounts.set(material, (materialCounts.get(material) ?? 0) + 1);
  }

  return { typeCounts, materialCounts };
}

function buildTagProducts(products: Product[], tags: Tag[]) {
  return tags.map((tag) => {
    const indices: number[] = [];
    for (let index = 0; index < products.length; index += 1) {
      if (tag.predicate(products[index])) {
        indices.push(index);
      }
    }
    return indices;
  });
}

function intersectCountSorted(left: number[], right: number[]) {
  let i = 0;
  let j = 0;
  let count = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      count += 1;
      i += 1;
      j += 1;
    } else if (left[i] < right[j]) {
      i += 1;
    } else {
      j += 1;
    }
  }

  return count;
}

function buildIntersectionMatrix(tagProducts: number[][]) {
  const size = tagProducts.length;
  const matrix: number[][] = Array.from({ length: size }, () =>
    Array<number>(size).fill(0),
  );

  for (let i = 0; i < size; i += 1) {
    matrix[i][i] = tagProducts[i].length;
    for (let j = i + 1; j < size; j += 1) {
      const count = intersectCountSorted(tagProducts[i], tagProducts[j]);
      matrix[i][j] = count;
      matrix[j][i] = count;
    }
  }

  return matrix;
}

function hasEnoughPairs(
  index: number,
  matrix: number[][],
  minCellMatches: number,
  minGoodPairs: number,
) {
  let good = 0;
  for (let other = 0; other < matrix.length; other += 1) {
    if (other === index) {
      continue;
    }
    if (matrix[index][other] >= minCellMatches) {
      good += 1;
      if (good >= minGoodPairs) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Beatability scoring.
//
// A board is "beatable" when (a) every cell has plenty of matching products,
// so a player who knows the category can name *something*, and (b) the
// categories themselves are things ordinary people actually know about a
// drink. Beverage type and country are easy; container and price are
// medium; alcohol buckets and the taste-clock numbers are hard because most
// players have never looked at them.
//
// The score is dominated by the *hardest* cell (the trap cell), not the
// average, so one obscure intersection can't hide behind eight easy ones.
// ---------------------------------------------------------------------------

const FAMILY_DIFFICULTY: Record<string, number> = {
  beverage: 1,
  geography: 1,
  style: 1,
  region: 2,
  grape: 2,
  flag: 2,
  seal: 3,
  container: 2,
  containerType: 2,
  containerMaterial: 2,
  price: 2,
  volume: 2,
  alcohol: 3,
  taste: 4,
};

const EASY_FAMILIES = new Set<string>(["beverage", "geography", "style"]);
const HARD_DIFFICULTY = 3;

// Max total difficulty for a board. Six easy tags = 6; one hard tag plus
// mostly easy ones lands around 10. Anything above this is rejected outright.
const MAX_BOARD_DIFFICULTY = 12;

// Tags that match more than this share of the whole catalog ("glass
// bottle", "750-1000 ml") are not really categories, they're the default.
// A cell built from them has thousands of answers and is boring to play.
const MAX_TAG_SHARE = 0.45;

function tagDifficulty(tag: Tag) {
  return FAMILY_DIFFICULTY[tag.family] ?? 3;
}

function boardDifficulty(tags: Tag[]) {
  let total = 0;
  for (const tag of tags) {
    total += tagDifficulty(tag);
  }
  return total;
}

function difficultyLabel(difficulty: number) {
  if (difficulty <= 8) return "easy";
  if (difficulty <= 10) return "medium";
  return "hard";
}

// log2-shaped credit for a cell, capped at targetHigh. Going from 15 to 30
// matches is worth as much as going from 100 to 200: what matters is how
// many *plausible* answers a player has, and that saturates.
function cellCredit(count: number, targetHigh: number) {
  const capped = Math.min(count, targetHigh);
  let credit = Math.log2(Math.max(capped, 1));
  if (count > targetHigh) {
    // Above the sweet spot the cell is trivially solvable and the
    // uniqueness scoring in-game stops being interesting. Bleed credit
    // slowly: 4x targetHigh costs 2 points, 32x costs 5.
    credit -= Math.log2(count / targetHigh);
  }
  return credit;
}

function scoreBoard(
  counts: number[][],
  rows: Tag[],
  cols: Tag[],
  args: Args,
) {
  const tags = [...rows, ...cols];
  const flat = counts.flat();
  const maxCredit = Math.log2(args.targetHigh);

  // 1. Per-cell credit (up to ~9 x 6 = 54 for a board of fat cells).
  let score = 0;
  for (const count of flat) {
    score += cellCredit(count, args.targetHigh) * 6;
  }

  // 2. Trap-cell weighting: the smallest cell counts triple on top. A board
  //    whose worst cell is 15 products scores much lower than one whose
  //    worst cell is 60, even if the other eight are identical.
  const minCount = Math.min(...flat);
  score += (cellCredit(minCount, args.targetHigh) / maxCredit) * 60;

  // 3. Bonus when every cell clears the comfortable threshold.
  if (minCount >= args.targetLow) {
    score += 25;
  }

  // 4. Difficulty penalty: every point of category difficulty above "all
  //    easy" costs 12. Six easy tags = 0 penalty, one taste tag = -36.
  score -= (boardDifficulty(tags) - tags.length) * 12;

  // 5. Familiarity bonus: reward boards where most headers are things
  //    people say out loud ("a Spanish red", "an Italian beer").
  const easyCount = tags.filter((tag) => EASY_FAMILIES.has(tag.family)).length;
  score += Math.min(easyCount, 4) * 6;
  const hasBeverage = tags.some(
    (tag) => tag.family === "beverage" || tag.family === "style",
  );
  const hasCountry = tags.some((tag) => tag.family === "geography");
  if (hasBeverage && hasCountry) {
    score += 15;
  }

  // 6. Variety bonus: don't let the generator collapse into "three countries
  //    vs three countries" every day.
  const families = new Set(tags.map((tag) => tag.family));
  score += families.size * 10;

  // 7. Small bonus for exactly one taste-clock tag. They're the most
  //    interesting header when used sparingly, and the difficulty penalty
  //    above already ensures they only survive on boards that are otherwise
  //    easy.
  const tasteCount = tags.filter((tag) => tag.family === "taste").length;
  if (tasteCount === 1) {
    score += 8;
  }

  return Math.round(score);
}

function boardKey(rows: Tag[], cols: Tag[]) {
  const rowKey = rows
    .map((tag) => tag.id)
    .sort()
    .join("|");
  const colKey = cols
    .map((tag) => tag.id)
    .sort()
    .join("|");
  return `${rowKey}__${colKey}`;
}

// Raw packaging strings ("Lättare glasflaska", "PET-flaska", "Burk") are
// either unknowable to a player or duplicates of the normalised
// ContainerType/ContainerMaterial tags. Keep them out of boards entirely.
const BLACKLISTED_FAMILIES = new Set<string>(["container"]);

const BLACKLISTED_TAG_IDS = new Set<string>([
  // Multipack is technically a container TYPE but in practice it's a packaging
  // detail that players don't reliably know per-product. Skip it entirely.
  "ContainerType:Multipack",
]);

// containerType and containerMaterial are almost perfectly correlated
// (Can ↔ Aluminum, Box ↔ Paper/Cardboard, Bottle ↔ Glass), so allowing both
// on one board makes two slots redundant. Treat them as one "container" group.
const CONTAINER_FAMILIES = new Set<string>([
  "container",
  "containerType",
  "containerMaterial",
]);

function countFamily(tags: Tag[], family: string) {
  let count = 0;
  for (const tag of tags) {
    if (tag.family === family) {
      count += 1;
    }
  }
  return count;
}

function countContainerTags(tags: Tag[]) {
  let count = 0;
  for (const tag of tags) {
    if (CONTAINER_FAMILIES.has(tag.family)) {
      count += 1;
    }
  }
  return count;
}

function findBoards(tags: Tag[], matrix: number[][], args: Args) {
  const random = mulberry32(hashSeed(args.seed));
  const candidates: Board[] = [];
  const seen = new Set<string>();

  const usableTags = tags.filter(
    (tag) =>
      !BLACKLISTED_TAG_IDS.has(tag.id) &&
      !BLACKLISTED_FAMILIES.has(tag.family) &&
      tag.share <= MAX_TAG_SHARE,
  );

  const rowPool = usableTags.filter((tag) => tag.family !== "container");
  const colPool = usableTags.filter((tag) => tag.family !== "taste");

  const idToIndex = new Map(tags.map((tag, index) => [tag.id, index]));

  for (let attempt = 0; attempt < args.attempts; attempt += 1) {
    const rows = sampleN(rowPool, 3, random);
    const rowIndices = rows.map((row) => idToIndex.get(row.id) ?? -1);
    if (rowIndices.includes(-1)) {
      continue;
    }

    // Only consider columns that clear the per-cell minimum against all
    // three rows. With ~100 tags a blind draw almost never does, so this
    // filter is what makes the search productive.
    const compatibleCols = colPool.filter((tag) => {
      if (rows.some((row) => row.id === tag.id)) return false;
      const colIndex = idToIndex.get(tag.id);
      if (colIndex == null) return false;
      return rowIndices.every(
        (rowIndex) => matrix[rowIndex][colIndex] >= args.minCellMatches,
      );
    });
    if (compatibleCols.length < 3) {
      continue;
    }
    const cols = sampleN(compatibleCols, 3, random);

    // Reject boards that pick both a container type and a container material.
    if (countContainerTags([...rows, ...cols]) > 1) {
      continue;
    }

    const allTags = [...rows, ...cols];

    // A child tag never shares a board with a parent that implies it
    // (Region:Champagne + Country:Frankrike, Style:IPA + Beverage:Ale).
    const boardIds = new Set(allTags.map((tag) => tag.id));
    if (allTags.some((tag) => tag.conflicts?.some((id) => boardIds.has(id)))) {
      continue;
    }

    // At most one hard header (alcohol bucket or taste-clock number) per
    // board, and never more than one taste tag. Two obscure axes crossing
    // each other is what made boards unbeatable.
    const hardCount = allTags.filter(
      (tag) => tagDifficulty(tag) >= HARD_DIFFICULTY,
    ).length;
    if (hardCount > 1) {
      continue;
    }

    if (boardDifficulty(allTags) > MAX_BOARD_DIFFICULTY) {
      continue;
    }

    // Numeric bands are filler when doubled up ("< 100 SEK" next to
    // "100-200 SEK" is one axis pretending to be two). One each per board.
    if (countFamily(allTags, "price") > 1 || countFamily(allTags, "volume") > 1) {
      continue;
    }

    const key = boardKey(rows, cols);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const counts: number[][] = [];
    let invalid = false;

    for (const row of rows) {
      const rowIndex = idToIndex.get(row.id);
      if (rowIndex == null) {
        invalid = true;
        break;
      }
      const rowCounts: number[] = [];

      for (const col of cols) {
        const colIndex = idToIndex.get(col.id);
        if (colIndex == null) {
          invalid = true;
          break;
        }

        const count = matrix[rowIndex][colIndex];
        rowCounts.push(count);
        if (count < args.minCellMatches) {
          invalid = true;
        }
      }

      counts.push(rowCounts);
    }

    if (invalid) {
      continue;
    }

    const score = scoreBoard(counts, rows, cols, args);
    const difficulty = boardDifficulty(allTags);
    candidates.push({
      rows,
      cols,
      counts,
      score,
      difficulty,
      difficultyLabel: difficultyLabel(difficulty),
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, args.boards);
}

function productDisplayName(product: Product) {
  const bold =
    typeof product.productNameBold === "string" ? product.productNameBold : "";
  const thin =
    typeof product.productNameThin === "string" ? product.productNameThin : "";
  const number =
    typeof product.productNumber === "string" ? product.productNumber : "";

  const name = [bold, thin].filter(Boolean).join(" ").trim();
  if (!name && number) {
    return `#${number}`;
  }
  if (!number) {
    return name || "Unknown product";
  }
  return `${name} (${number})`;
}

function sampleProductsForCell(
  products: Product[],
  row: Tag,
  col: Tag,
  seed: string,
) {
  const matches = products.filter(
    (product) => row.predicate(product) && col.predicate(product),
  );
  const random = mulberry32(hashSeed(`${seed}:${row.id}:${col.id}`));
  return sampleN(matches, Math.min(3, matches.length), random).map(
    productDisplayName,
  );
}

function printBoard(
  board: Board,
  products: Product[],
  seed: string,
  index: number,
) {
  console.log(`\nBoard option ${index + 1}`);
  console.log(`Score: ${board.score}`);
  console.log(`Difficulty: ${board.difficultyLabel} (${board.difficulty})`);
  console.log(`Smallest cell: ${Math.min(...board.counts.flat())} products`);
  console.log(`Rows: ${board.rows.map((tag) => tag.label).join(" | ")}`);
  console.log(`Cols: ${board.cols.map((tag) => tag.label).join(" | ")}`);

  console.log("Counts per row");
  for (let row = 0; row < 3; row += 1) {
    console.log(`- ${board.rows[row].label}: ${board.counts[row].join(", ")}`);
  }

  console.log("Cell samples");
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const examples = sampleProductsForCell(
        products,
        board.rows[row],
        board.cols[col],
        seed,
      );
      console.log(`- ${board.rows[row].label} + ${board.cols[col].label}`);
      console.log(`  ${examples.join(" // ")}`);
    }
  }
}

function boardToJson(board: Board) {
  return {
    rows: board.rows.map((tag) => ({
      id: tag.id,
      label: tag.label,
      family: tag.family,
    })),
    cols: board.cols.map((tag) => ({
      id: tag.id,
      label: tag.label,
      family: tag.family,
    })),
    counts: board.counts,
    score: board.score,
    difficulty: board.difficulty,
    difficultyLabel: board.difficultyLabel,
  };
}

const args = parseArgs();
const products = loadProducts();

const tags: Tag[] = buildCandidateTags(products) as Tag[];

const uniqueTagsById = new Map<string, Tag>();
for (const tag of tags) {
  uniqueTagsById.set(tag.id, tag);
}
const uniqueTags = [...uniqueTagsById.values()];

const tagProducts = buildTagProducts(products, uniqueTags);
const matrix = buildIntersectionMatrix(tagProducts);

const viableIndices: number[] = [];
for (let index = 0; index < uniqueTags.length; index += 1) {
  if (hasEnoughPairs(index, matrix, args.minCellMatches, 18)) {
    viableIndices.push(index);
  }
}

const viableTags = viableIndices.map((index) => uniqueTags[index]);
const viableTagProducts = viableIndices.map((index) => tagProducts[index]);
const viableMatrix = buildIntersectionMatrix(viableTagProducts);

console.log("Dokubolaget board generator");
console.log(`Seed: ${args.seed}`);
console.log(`Products: ${products.length.toLocaleString("en-US")}`);
console.log(`Viable tags: ${viableTags.length}`);
console.log(`Attempts: ${args.attempts}`);

const boards = findBoards(viableTags, viableMatrix, args);
if (boards.length === 0) {
  console.log("No boards found. Try lower --min-cell or higher --attempts.");
  process.exit(0);
}

for (let index = 0; index < boards.length; index += 1) {
  printBoard(boards[index], products, `${args.seed}:${index}`, index);
}

if (args.outFile) {
  fs.mkdirSync(path.dirname(args.outFile), { recursive: true });
  fs.writeFileSync(
    args.outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        seed: args.seed,
        minCellMatches: args.minCellMatches,
        targetLow: args.targetLow,
        targetHigh: args.targetHigh,
        boards: boards.map(boardToJson),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nSaved boards file: ${args.outFile}`);
}
