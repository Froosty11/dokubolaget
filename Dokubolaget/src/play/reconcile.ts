// Merging the server's record of a board into the device's. Pure, so the
// model (dokuModel.ts) stays thin and this stays testable.
import { productToResult } from "../searchHelpers";
import type { BoardResult, CellResult } from "./types";

export type CellInfo = { score: number | null; share: number | null; unicorn: boolean };
type BoardState = { products: Record<number, any>; info: Record<number, CellInfo>; misses: Record<number, number> };

// The bottle the server has in a cell. The server may know only its number
// (a product it looked up before a restart): the cell is solved all the same.
export function serverPick(cell: Pick<CellResult, "productNumber" | "product">) {
  return productToResult(cell.product ?? { productNumber: cell.productNumber });
}

// The server's record wins, except for cells with guesses still on their way.
export function reconcileBoard(current: BoardState, board: BoardResult, pendingCells: Set<number>) {
  const products = { ...current.products };
  const info: Record<number, CellInfo> = {};
  const misses = { ...current.misses };
  let reverted = false;
  let added = false;
  for (const cell of board.cells) {
    if (pendingCells.has(cell.cell)) {
      if (current.info[cell.cell]) info[cell.cell] = current.info[cell.cell];
      continue;
    }
    if (cell.productNumber) {
      if (String(products[cell.cell]?.raw?.productNumber ?? "") !== cell.productNumber) {
        if (!products[cell.cell]) added = true;
        products[cell.cell] = serverPick(cell);
      }
      info[cell.cell] = { score: cell.score, share: cell.share, unicorn: cell.unicorn };
    } else if (products[cell.cell]) {
      delete products[cell.cell];
      reverted = true;
    }
    if (cell.misses > Number(misses[cell.cell] || 0)) misses[cell.cell] = cell.misses;
  }
  return { products, info, misses, reverted, added };
}
