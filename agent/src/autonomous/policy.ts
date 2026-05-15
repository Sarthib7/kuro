import type { AnalyzeTokenResult } from "../skills/analyze_token.js";

export interface Policy {
  // entry gates
  max_top10_pct: number;
  require_renounced_mint: boolean;
  require_renounced_freeze: boolean;
  require_route: boolean;
  require_honeypot_pass: boolean;
  max_round_trip_loss_pct: number;
  // sizing
  snipe_sol: number;
  max_slippage_bps: number;
  jito_tip_sol: number;
  use_jito: boolean;
  // exit
  take_profit_pct: number;
  stop_loss_pct: number;
  max_hold_seconds: number;
  // overall
  dry_run: boolean;
}

function numEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

export function defaultPolicy(): Policy {
  return {
    max_top10_pct: numEnv("KURO_MAX_TOP10_PCT", 60),
    require_renounced_mint: boolEnv("KURO_REQUIRE_RENOUNCED_MINT", false),
    require_renounced_freeze: boolEnv("KURO_REQUIRE_RENOUNCED_FREEZE", true),
    require_route: true,
    require_honeypot_pass: true,
    max_round_trip_loss_pct: numEnv("KURO_MAX_ROUND_TRIP_LOSS_PCT", 25),
    snipe_sol: numEnv("KURO_SNIPE_SOL", 0.02),
    max_slippage_bps: numEnv("KURO_MAX_SLIPPAGE_BPS", 1500),
    jito_tip_sol: numEnv("KURO_JITO_TIP_SOL", 0.0002),
    use_jito: boolEnv("KURO_USE_JITO", true),
    take_profit_pct: numEnv("KURO_TAKE_PROFIT_PCT", 50),
    stop_loss_pct: numEnv("KURO_STOP_LOSS_PCT", 30),
    max_hold_seconds: numEnv("KURO_MAX_HOLD_SECONDS", 600),
    dry_run: !boolEnv("KURO_AUTONOMOUS_LIVE", false),
  };
}

export interface Decision {
  action: "snipe" | "pass";
  reason?: string;
  score?: number;
}

export function decide(analysis: AnalyzeTokenResult, p: Policy): Decision {
  if (p.require_route && analysis.flags.includes("no_jupiter_route")) {
    return { action: "pass", reason: "no_route" };
  }
  if (
    p.require_honeypot_pass &&
    analysis.flags.includes("sell_simulation_failed_possible_honeypot")
  ) {
    return { action: "pass", reason: "honeypot_sell_sim_failed" };
  }
  if (p.require_renounced_mint && !analysis.authorities.mintRenounced) {
    return { action: "pass", reason: "mint_authority_not_renounced" };
  }
  if (p.require_renounced_freeze && !analysis.authorities.freezeRenounced) {
    return { action: "pass", reason: "freeze_authority_not_renounced" };
  }
  if (analysis.holders.topNPct > p.max_top10_pct) {
    return {
      action: "pass",
      reason: `top_holders_${analysis.holders.topNPct.toFixed(1)}pct`,
    };
  }
  const rt = analysis.honeypotSim?.roundTripSolRetained;
  if (rt !== undefined && rt < 1 - p.max_round_trip_loss_pct / 100) {
    return {
      action: "pass",
      reason: `round_trip_loss_${((1 - rt) * 100).toFixed(1)}pct`,
    };
  }
  // crude score: lower concentration = higher score (room to refine)
  const score = Math.max(0, 100 - analysis.holders.topNPct);
  return { action: "snipe", score };
}
