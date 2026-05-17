import { startPoolWatcher, type PoolCandidate } from "../watcher/pool_watcher.js";
import { snipeSkill } from "../skills/snipe.js";
import { ExecutorClient } from "../data/executor.js";
import { getQuote, SOL_MINT } from "../data/jupiter.js";
import {
  addOpenPosition,
  closePosition,
  loadPositions,
  type Position,
} from "./positions.js";
import { defaultPolicy, type Policy } from "./policy.js";
import { LiveDecider, judge } from "./decider.js";
import type { SkillContext } from "../skills/types.js";
import { recordOutcomeAllAgents } from "../brain/run.js";
import type { BrainAgentSeed } from "../brain/signals.js";

const liveDecider = new LiveDecider();

/**
 * Bankroll cache — refreshed at most every BANKROLL_TTL_MS via /status.
 * Live trades scale with current wallet balance (KURO_SNIPE_PCT_OF_BANKROLL)
 * so the same code works from 1 SOL to 1000 SOL without env changes.
 * Falls back to absolute snipe_sol if pct is 0 or /status is unreachable.
 */
const BANKROLL_TTL_MS = 60_000;
let cachedBankroll: { sol: number; at: number } | null = null;

async function getBankrollSol(exec: ExecutorClient): Promise<number | null> {
  if (cachedBankroll && Date.now() - cachedBankroll.at < BANKROLL_TTL_MS) {
    return cachedBankroll.sol;
  }
  try {
    const status = await exec.status();
    cachedBankroll = { sol: status.balance_sol, at: Date.now() };
    return status.balance_sol;
  } catch {
    return cachedBankroll?.sol ?? null;
  }
}

async function computeSnipeSol(policy: Policy, exec: ExecutorClient): Promise<number> {
  if (policy.snipe_pct_of_bankroll <= 0) return policy.snipe_sol;
  const bankroll = await getBankrollSol(exec);
  if (!bankroll || bankroll <= 0) return policy.snipe_sol;
  const fromPct = (bankroll * policy.snipe_pct_of_bankroll) / 100;
  const cap = (bankroll * policy.max_snipe_pct) / 100;
  return Math.min(fromPct, cap);
}

export interface AutonomousHandle {
  stop: () => Promise<void>;
}

export async function runAutonomous(
  ctx: SkillContext,
  policy: Policy = defaultPolicy(),
): Promise<AutonomousHandle> {
  const exec = new ExecutorClient();
  const status = await exec.status().catch((e) => {
    ctx.log("executor unreachable", { err: String(e) });
    return null;
  });
  if (!status) {
    throw new Error(
      "executor /status unreachable — start `cargo run --release` in executor/ first",
    );
  }
  ctx.log("autonomous starting", {
    wallet: status.wallet,
    balance_sol: status.balance_sol,
    daily_cap_sol: status.daily_cap_sol,
    max_trade_sol: status.max_trade_sol,
    dry_run: policy.dry_run,
    snipe_sol: policy.snipe_sol,
  });

  const watcher = await startPoolWatcher(
    {
      rpcUrl: process.env.SOLANA_RPC_URL,
      async onCandidate(c: PoolCandidate, ctx) {
        await onNewPool(c, policy, exec, ctx);
      },
    },
    ctx,
  );

  const exitTimer = setInterval(() => {
    void monitorOpenPositions(policy, exec, ctx);
  }, 15_000);

  return {
    async stop() {
      clearInterval(exitTimer);
      await watcher.stop();
    },
  };
}

async function onNewPool(
  c: PoolCandidate,
  policy: Policy,
  exec: ExecutorClient,
  ctx: SkillContext,
) {
  if (!c.mint) return;
  const open = loadPositions().open;
  if (open.some((o) => o.mint === c.mint)) return;

  const seed: BrainAgentSeed = {
    mint: c.mint,
    source: c.source,
    signature: c.signature,
    detected_at: c.detected_at,
  };

  // Decider.enrich runs analyze + Brain Agents in parallel; judge() is the pure
  // policy shared by live + backtest. See decider.ts + ADR-0006.
  const enrichment = await liveDecider.enrich(seed, ctx);
  if (!enrichment.analysis) {
    ctx.log("analyze failed", { mint: c.mint });
    return;
  }
  const bundle = enrichment.signals;
  const decision = judge(seed, enrichment, policy);
  console.log(
    JSON.stringify({
      event: "candidate",
      source: c.source,
      mint: c.mint,
      signature: c.signature,
      decision,
      flags: enrichment.analysis.flags,
      top10_pct: Number(enrichment.analysis.holders.topNPct.toFixed(2)),
      signals: bundle.signals.map((s) => ({
        kind: s.kind,
        confidence: s.confidence,
        cached: s.cached,
        latency_ms: s.latency_ms,
        ...(s.kind === "dev_wallet" ? { reputation: s.reputation_band } : {}),
        ...(s.kind === "narrative"
          ? { themes: s.themes, sentiment: s.sentiment_band }
          : {}),
      })),
    }),
  );
  if (decision.action !== "snipe") return;

  const sizedSol = await computeSnipeSol(policy, exec);
  const r = await snipeSkill.execute(
    {
      mint: c.mint,
      sol_amount: sizedSol,
      max_slippage_bps: policy.max_slippage_bps,
      use_jito: policy.use_jito,
      jito_tip_sol: policy.jito_tip_sol,
      dry_run: policy.dry_run,
      skip_safety: true,
    },
    ctx,
  );
  console.log(
    JSON.stringify({
      event: "snipe_result",
      mint: c.mint,
      sized_sol: sizedSol,
      result: r,
    }),
  );
  if (r.preflight !== "passed" || !r.swap || r.swap.risk.status !== "passed") return;
  if (!policy.dry_run && r.swap.signature) {
    addOpenPosition({
      mint: c.mint,
      source: c.source,
      sol_in: sizedSol,
      opened_at: Date.now(),
      entry_signature: r.swap.signature,
      in_amount_lamports: r.swap.in_amount,
      out_amount_estimated: r.swap.out_amount_estimated,
      contributing_signals: bundle.signals.map((s) => ({
        agent: s.agent,
        key: s.cache_key,
      })),
    });
  }
}

async function monitorOpenPositions(policy: Policy, exec: ExecutorClient, ctx: SkillContext) {
  const open = loadPositions().open;
  for (const pos of open) {
    try {
      await maybeExit(pos, policy, exec, ctx);
    } catch (e) {
      ctx.log("exit check failed", { mint: pos.mint, err: String(e) });
    }
  }
}

async function maybeExit(
  pos: Position,
  policy: Policy,
  exec: ExecutorClient,
  ctx: SkillContext,
) {
  const tokenAmount = BigInt(pos.out_amount_estimated);
  if (tokenAmount === 0n) return;

  const q = await getQuote({
    inputMint: pos.mint,
    outputMint: SOL_MINT,
    amount: tokenAmount,
  });
  if (!q) return;
  const currentSolOut = Number(q.outAmount) / 1e9;
  const pnlPct = ((currentSolOut - pos.sol_in) / pos.sol_in) * 100;
  const ageSec = (Date.now() - pos.opened_at) / 1000;

  let reason: "take_profit" | "stop_loss" | "max_hold" | null = null;
  if (pnlPct >= policy.take_profit_pct) reason = "take_profit";
  else if (pnlPct <= -policy.stop_loss_pct) reason = "stop_loss";
  else if (ageSec >= policy.max_hold_seconds) reason = "max_hold";
  if (!reason) return;

  ctx.log("exiting position", {
    mint: pos.mint,
    pnl_pct: Number(pnlPct.toFixed(2)),
    age_sec: Math.round(ageSec),
    reason,
  });

  const sell = await exec.swap({
    input_mint: pos.mint,
    output_mint: SOL_MINT,
    in_amount_lamports: Number(tokenAmount),
    max_slippage_bps: policy.max_slippage_bps,
    use_jito: false,
    dry_run: policy.dry_run,
  });
  console.log(
    JSON.stringify({ event: "exit_result", mint: pos.mint, reason, result: sell }),
  );
  if (sell.signature || policy.dry_run) {
    closePosition(pos.mint, {
      exit_signature: sell.signature ?? null,
      pnl_sol_estimated: currentSolOut - pos.sol_in,
      exit_reason: reason,
    });
    // PnL feedback to each contributing Brain Agent's cache — drives
    // win-rate eviction per ADR-0006. No-op if no signals contributed.
    if (pos.contributing_signals && pos.contributing_signals.length > 0) {
      recordOutcomeAllAgents(
        pos.contributing_signals.map((cs) => ({
          agent: cs.agent,
          key: BigInt(cs.key as unknown as string),
        })),
        pnlPct,
      );
    }
  }
}
