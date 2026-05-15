import { fetchRecentPumpfunLaunches } from "./launches.js";
import { fetchPumpfunTrades, tradesToPriceSeries } from "./trades.js";
import { simulateLaunch } from "./simulator.js";
import { buildReport, formatReport } from "./report.js";
import { defaultPolicy } from "../autonomous/policy.js";
import type { BacktestReport, SimulatedTrade } from "./types.js";

export interface BacktestOptions {
  limit: number;
  max_age_hours?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}

export async function runBacktest(opts: BacktestOptions): Promise<BacktestReport> {
  const policy = defaultPolicy();
  const launches = await fetchRecentPumpfunLaunches({
    limit: opts.limit,
    max_age_hours: opts.max_age_hours,
  });
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const trades: SimulatedTrade[] = [];
  let next = 0;

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < launches.length) {
        const idx = next++;
        const launch = launches[idx]!;
        try {
          const pf = await fetchPumpfunTrades(launch.mint, { limit: 200 });
          const series = tradesToPriceSeries(pf);
          trades.push(simulateLaunch(launch, series, policy));
        } catch {
          trades.push({
            mint: launch.mint,
            symbol: launch.symbol,
            decision: "skip",
            skip_reason: "trade_fetch_error",
          });
        }
        opts.onProgress?.(trades.length, launches.length);
      }
    }),
  );

  return buildReport(trades, launches.length, policy);
}

export { formatReport };
export type { BacktestReport, SimulatedTrade } from "./types.js";
