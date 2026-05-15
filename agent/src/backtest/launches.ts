import type { HistoricalLaunch } from "./types.js";

const PF_BASE = process.env.PUMPFUN_API_BASE ?? "https://frontend-api.pump.fun";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36";

interface PumpfunCoin {
  mint: string;
  name?: string;
  symbol?: string;
  /** unix milliseconds */
  created_timestamp: number;
  complete?: boolean;
  market_cap?: number;
  virtual_sol_reserves?: number;
  virtual_token_reserves?: number;
}

/**
 * Pull recent Pump.fun launches via the unofficial frontend API. Same source
 * GMGN and similar tools scrape. If/when it gets rate-limited or blocked, fall
 * back to a paid feed (Helius / Birdeye / Bitquery) — this module's job is to
 * produce a list of (mint, created_at) tuples, not commit to one source.
 */
export async function fetchRecentPumpfunLaunches(opts: {
  limit: number;
  max_age_hours?: number;
}): Promise<HistoricalLaunch[]> {
  const url = `${PF_BASE}/coins?offset=0&limit=${opts.limit}&sort=created_timestamp&order=DESC&includeNsfw=false`;
  const r = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
  });
  if (!r.ok) {
    throw new Error(`pump.fun /coins returned ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  const data = (await r.json()) as PumpfunCoin[];
  const cutoffMs = opts.max_age_hours
    ? Date.now() - opts.max_age_hours * 3600 * 1000
    : 0;

  return data
    .filter((c) => c.created_timestamp >= cutoffMs)
    .map<HistoricalLaunch>((c) => ({
      mint: c.mint,
      symbol: c.symbol,
      name: c.name,
      created_at: Math.floor(c.created_timestamp / 1000),
      complete: c.complete,
      current_market_cap_sol:
        c.virtual_sol_reserves && c.virtual_token_reserves && c.market_cap
          ? c.market_cap / 1e9
          : undefined,
    }));
}
