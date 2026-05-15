import fs from "node:fs";
import path from "node:path";

const DEFAULT_PATH = process.env.KURO_POSITIONS_PATH ?? "./executor/positions.json";

export interface Position {
  mint: string;
  source: string;
  sol_in: number;
  opened_at: number;
  entry_signature: string | null;
  in_amount_lamports: number;
  out_amount_estimated: number;
  exit_signature?: string | null;
  closed_at?: number;
  exit_reason?: "take_profit" | "stop_loss" | "max_hold";
  pnl_sol_estimated?: number;
}

export interface PositionsFile {
  open: Position[];
  closed: Position[];
}

export function loadPositions(p = DEFAULT_PATH): PositionsFile {
  if (!fs.existsSync(p)) return { open: [], closed: [] };
  return JSON.parse(fs.readFileSync(p, "utf-8")) as PositionsFile;
}

export function savePositions(positions: PositionsFile, p = DEFAULT_PATH): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(positions, null, 2));
}

export function addOpenPosition(pos: Position, p = DEFAULT_PATH): void {
  const data = loadPositions(p);
  data.open.push(pos);
  savePositions(data, p);
}

export function closePosition(
  mint: string,
  exit: {
    exit_signature: string | null;
    pnl_sol_estimated: number;
    exit_reason: "take_profit" | "stop_loss" | "max_hold";
  },
  p = DEFAULT_PATH,
): void {
  const data = loadPositions(p);
  const idx = data.open.findIndex((o) => o.mint === mint);
  if (idx < 0) return;
  const removed = data.open.splice(idx, 1)[0];
  if (removed) {
    data.closed.push({
      ...removed,
      ...exit,
      closed_at: Date.now(),
    });
  }
  savePositions(data, p);
}
