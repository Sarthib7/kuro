import { analyzeTokenSkill, type AnalyzeTokenResult } from "../skills/analyze_token.js";
import { runBrainAgents } from "../brain/run.js";
import type { BrainAgentSeed, SignalBundle } from "../brain/signals.js";
import type { Policy } from "./policy.js";
import type { SkillContext } from "../skills/types.js";

/**
 * Decider seam — splits "gather facts about a candidate" (varies between live
 * trading and backtest replay) from "judge those facts into a Trade Intent"
 * (must NOT vary). See ADR-0006 + docs/adr/0007 (pending).
 *
 *   onCandidate → Decider.enrich(seed) → judge(seed, enrichment, policy) → Trade Intent
 *
 * LiveDecider runs analyzeTokenSkill + runBrainAgents in parallel (real RPC + LLM).
 * SimDecider (in backtest/sim_decider.ts) returns whatever the harness injected.
 * Both Adapters call the same judge() — scoring/venue/signal rules in one place.
 */

export interface EnrichmentBundle {
  /** Deterministic onchain analysis; null if RPC failed or backtest has no fixture. */
  analysis: AnalyzeTokenResult | null;
  /** Brain Agent Signals; empty bundle if all agents timed out or were absent. */
  signals: SignalBundle;
}

export interface Decider {
  enrich(seed: BrainAgentSeed, ctx: SkillContext): Promise<EnrichmentBundle>;
}

export interface Decision {
  action: "snipe" | "pass";
  reason?: string;
  score?: number;
  /** Cache keys of Signals that contributed; routed back to Brain Agent caches on PnL feedback. */
  contributing_signals?: { agent: string; key: string }[];
}

/**
 * LiveDecider — real RPC + Brain Agent enrichment. Used by the autonomous loop.
 */
export class LiveDecider implements Decider {
  async enrich(seed: BrainAgentSeed, ctx: SkillContext): Promise<EnrichmentBundle> {
    const [analysisRes, signalsRes] = await Promise.allSettled([
      analyzeTokenSkill.execute({ mint: seed.mint, topN: 10 }, ctx),
      runBrainAgents(seed, ctx),
    ]);
    return {
      analysis: analysisRes.status === "fulfilled" ? analysisRes.value : null,
      signals:
        signalsRes.status === "fulfilled"
          ? signalsRes.value
          : { signals: [], by_agent: {} },
    };
  }
}

/**
 * judge — pure function. Same logic for live trading + backtest. Edit here and
 * both paths pick it up automatically. Never call analyze/brain/RPC from inside;
 * those belong to Decider.enrich.
 */
export function judge(
  seed: BrainAgentSeed,
  enrichment: EnrichmentBundle,
  policy: Policy,
): Decision {
  // --- venue-aware skips ---
  // Meteora DAMM v2 + DBC have anti-sniper Fee Scheduler + Rate Limiter;
  // block-0 buys are penalized. V1 skips entirely; V1.5 will add wait_then_snipe.
  if (seed.source === "meteora_damm_v2" || seed.source === "meteora_dbc") {
    return { action: "pass", reason: `meteora_anti_sniper_v1_skip:${seed.source}` };
  }

  const analysis = enrichment.analysis;
  if (!analysis) {
    return { action: "pass", reason: "analysis_missing" };
  }

  // --- deterministic gates ---
  if (policy.require_route && analysis.flags.includes("no_jupiter_route")) {
    return { action: "pass", reason: "no_route" };
  }
  if (
    policy.require_honeypot_pass &&
    analysis.flags.includes("sell_simulation_failed_possible_honeypot")
  ) {
    return { action: "pass", reason: "honeypot_sell_sim_failed" };
  }
  if (policy.require_renounced_mint && !analysis.authorities.mintRenounced) {
    return { action: "pass", reason: "mint_authority_not_renounced" };
  }
  if (policy.require_renounced_freeze && !analysis.authorities.freezeRenounced) {
    return { action: "pass", reason: "freeze_authority_not_renounced" };
  }
  if (analysis.holders.topNPct > policy.max_top10_pct) {
    return {
      action: "pass",
      reason: `top_holders_${analysis.holders.topNPct.toFixed(1)}pct`,
    };
  }
  const rt = analysis.honeypotSim?.roundTripSolRetained;
  if (rt !== undefined && rt < 1 - policy.max_round_trip_loss_pct / 100) {
    return {
      action: "pass",
      reason: `round_trip_loss_${((1 - rt) * 100).toFixed(1)}pct`,
    };
  }

  // --- signal-based gates ---
  const signals = enrichment.signals;
  const dw = signals.by_agent.dev_wallet;
  if (dw && dw.confidence >= 0.6 && dw.reputation_band === "rug_magnet") {
    return { action: "pass", reason: "dev_wallet_rug_magnet" };
  }
  const nv = signals.by_agent.narrative;
  if (nv && nv.confidence >= 0.6 && nv.sentiment_band === "skeptical") {
    return { action: "pass", reason: "narrative_skeptical" };
  }

  // --- scoring: base + signal boosts ---
  let score = Math.max(0, 100 - analysis.holders.topNPct);
  if (dw && dw.confidence >= 0.5) {
    if (dw.reputation_band === "legit") score += 15 * dw.confidence;
    else if (dw.reputation_band === "pumper") score += 10 * dw.confidence;
  }
  if (nv && nv.confidence >= 0.5) {
    if (nv.sentiment_band === "organic_interest") score += 10 * nv.confidence;
    else if (nv.sentiment_band === "speculative_hype") score += 5 * nv.confidence;
  }

  return {
    action: "snipe",
    score,
    contributing_signals: signals.signals.map((s) => ({
      agent: s.agent,
      key: s.cache_key,
    })),
  };
}
