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

// Decision + judge moved to ./decider.ts (Decider seam).
// Re-exported here so callers that imported Decision from policy still compile.
export type { Decision } from "./decider.js";
