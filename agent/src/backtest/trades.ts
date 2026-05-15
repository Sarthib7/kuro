import type { PricePoint, Trade } from "./types.js";

const PF_BASE = process.env.PUMPFUN_API_BASE ?? "https://frontend-api.pump.fun";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

interface PumpfunTrade {
  signature?: string;
  mint?: string;
  /** lamports */
  sol_amount: number;
  /** raw token units */
  token_amount: number;
  is_buy: boolean;
  user?: string;
  /** unix seconds */
  timestamp: number;
}

/** Returns all known trades for `mint`, oldest first. */
export async function fetchPumpfunTrades(
  mint: string,
  opts: { limit?: number } = {},
): Promise<Trade[]> {
  const limit = opts.limit ?? 200;
  const url = `${PF_BASE}/trades/all/${mint}?limit=${limit}&offset=0&minimumSize=0`;
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!r.ok) return [];
  const data = (await r.json()) as PumpfunTrade[];
  return data
    .filter((t) => t && t.sol_amount > 0 && t.token_amount > 0)
    .map<Trade>((t) => ({
      ts: t.timestamp,
      sol_amount_lamports: t.sol_amount,
      token_amount_raw: t.token_amount,
      is_buy: t.is_buy,
      signature: t.signature,
      user: t.user,
    }))
    .sort((a, b) => a.ts - b.ts);
}

/** Convert trades to a (ts, sol_per_token) price series. */
export function tradesToPriceSeries(trades: Trade[], tokenDecimals = 6): PricePoint[] {
  return trades.map((t) => {
    const solUi = t.sol_amount_lamports / 1e9;
    const tokenUi = t.token_amount_raw / 10 ** tokenDecimals;
    return { ts: t.ts, sol_per_token: solUi / tokenUi };
  });
}
