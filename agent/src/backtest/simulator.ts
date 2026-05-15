import type { Policy } from "../autonomous/policy.js";
import type { HistoricalLaunch, PricePoint, SimulatedTrade } from "./types.js";

/**
 * Phase-1 simulator: pure price-trajectory walk. Assumes every launch passes
 * the safety policy (no analyze_token call yet — Phase 2 will plumb that in).
 * Models entry/exit slippage as a flat bps haircut.
 *
 * Reasoning: Phase 1's question is "given the TP/SL/max-hold config, what's
 * the PnL if I sniped every pump.fun launch?". If that's catastrophic, the
 * safety gates need to be aggressive filters. If it's break-even or positive,
 * gates are tuning the upside, not saving us from ruin.
 */
export function simulateLaunch(
  launch: HistoricalLaunch,
  prices: PricePoint[],
  policy: Policy,
): SimulatedTrade {
  const first = prices[0];
  if (!first) {
    return {
      mint: launch.mint,
      symbol: launch.symbol,
      decision: "skip",
      skip_reason: "no_trades",
    };
  }

  const slippage = policy.max_slippage_bps / 10000;
  const entryPrice = first.sol_per_token * (1 + slippage);
  const tp = entryPrice * (1 + policy.take_profit_pct / 100);
  const sl = entryPrice * (1 - policy.stop_loss_pct / 100);
  const maxExitTs = first.ts + policy.max_hold_seconds;

  let exit: PricePoint | null = null;
  let reason: SimulatedTrade["exit_reason"] = "no_exit_in_window";

  for (let i = 1; i < prices.length; i++) {
    const p = prices[i]!;
    if (p.ts > maxExitTs) {
      const prev = prices[i - 1];
      exit = prev ?? first;
      reason = "max_hold";
      break;
    }
    if (p.sol_per_token >= tp) {
      exit = p;
      reason = "take_profit";
      break;
    }
    if (p.sol_per_token <= sl) {
      exit = p;
      reason = "stop_loss";
      break;
    }
  }

  if (!exit) {
    // never hit TP/SL/maxhold within available trades → use last known price
    const last = prices[prices.length - 1] ?? first;
    exit = last;
    // already initialised reason = "no_exit_in_window"
  }

  const effExitPrice = exit.sol_per_token * (1 - slippage);
  const riskPerToken = entryPrice - sl;
  const pnlPerToken = effExitPrice - entryPrice;
  const r = riskPerToken > 0 ? pnlPerToken / riskPerToken : 0;

  const tokensBought = policy.snipe_sol / entryPrice;
  const sellValue = tokensBought * effExitPrice;
  const pnlSol = sellValue - policy.snipe_sol;

  return {
    mint: launch.mint,
    symbol: launch.symbol,
    decision: "snipe",
    entry_ts: first.ts,
    entry_sol_per_token: entryPrice,
    exit_ts: exit.ts,
    exit_sol_per_token: effExitPrice,
    exit_reason: reason,
    r_multiple: r,
    pnl_sol: pnlSol,
    hold_seconds: exit.ts - first.ts,
  };
}
