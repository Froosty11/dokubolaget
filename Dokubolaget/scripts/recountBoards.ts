// Recounts each bundled board's answers using only playable products and drops
// boards with a cell under MIN answers. Run after changing what counts.
//   bun run scripts/recountBoards.ts [--min 5]
import fs from "node:fs";
import path from "node:path";
import { doesProductMatchTagId } from "../src/boardTags";
import { isPlayable } from "../src/playable";

const root = path.resolve(import.meta.dir, "..");
const minIndex = process.argv.indexOf("--min");
const MIN = minIndex === -1 ? 5 : Number(process.argv[minIndex + 1]);
const productsPath = process.env.PRODUCTS_PATH || path.resolve(root, "..", "products.json");
const products = (JSON.parse(fs.readFileSync(productsPath, "utf8")) as any[]).filter(isPlayable);
const file = path.join(root, "data", "generated-boards.json");
const pool = JSON.parse(fs.readFileSync(file, "utf8"));

const kept = [];
for (const board of pool.boards) {
  const counts = board.rows.map((row: any) =>
    board.cols.map((col: any) => products.filter((p) => doesProductMatchTagId(p, row.id) && doesProductMatchTagId(p, col.id)).length),
  );
  const smallest = Math.min(...counts.flat());
  if (smallest < MIN) {
    console.log(`drop: ${board.rows.map((t: any) => t.id).join(", ")} × ${board.cols.map((t: any) => t.id).join(", ")} (smallest ${smallest})`);
    continue;
  }
  kept.push({ ...board, counts });
}
fs.writeFileSync(file, JSON.stringify({ ...pool, boards: kept, recountedAt: new Date().toISOString() }, null, 2) + "\n");
console.log(`kept ${kept.length} of ${pool.boards.length} boards`);
