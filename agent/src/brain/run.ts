import type { SkillContext } from "../skills/types.js";
import type { BrainAgentSeed, SignalBundle, Signal } from "./signals.js";
import { DevWalletAgent } from "./agents/dev_wallet.js";
import { NarrativeAgent } from "./agents/narrative.js";

/**
 * Brain Agent orchestrator — run all Brain Agents in parallel against a seed,
 * with per-agent timeouts that never block the snipe decision path.
 *
 * Per ADR-0006: Brain Agents are best-effort enrichment. If any agent times out
 * or errors, the orchestrator returns whatever completed; decide() must accept
 * partial SignalBundles and degrade gracefully to pure-policy logic.
 *
 * Singletons — caches are per-instance, share across calls so L1 hits accumulate.
 */
const devWalletAgent = new DevWalletAgent();
const narrativeAgent = new NarrativeAgent();

const HARD_BUDGET_MS = 4000;

export async function runBrainAgents(
  seed: BrainAgentSeed,
  ctx: SkillContext,
): Promise<SignalBundle> {
  const start = Date.now();

  const results = await Promise.allSettled([
    withBudget(devWalletAgent.classify(seed, ctx), HARD_BUDGET_MS, "dev_wallet", ctx),
    withBudget(narrativeAgent.classify(seed, ctx), HARD_BUDGET_MS, "narrative", ctx),
  ]);

  const bundle: SignalBundle = { signals: [], by_agent: {} };

  for (const r of results) {
    if (r.status !== "fulfilled" || r.value === null) continue;
    const sig = r.value;
    bundle.signals.push(sig);
    if (sig.kind === "dev_wallet") bundle.by_agent.dev_wallet = sig;
    if (sig.kind === "narrative") bundle.by_agent.narrative = sig;
  }

  ctx.log("brain_agents complete", {
    elapsed_ms: Date.now() - start,
    got: bundle.signals.map((s) => s.kind),
  });

  return bundle;
}

async function withBudget<T>(
  p: Promise<T>,
  budgetMs: number,
  label: string,
  ctx: SkillContext,
): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        ctx.log(`brain_agent ${label} timed out`, { budget_ms: budgetMs });
        resolve(null);
      }, budgetMs),
    ),
  ]);
}

export function recordOutcomeAllAgents(
  contributingKeys: { agent: string; key: bigint }[],
  pnl_pct: number,
): void {
  for (const { agent, key } of contributingKeys) {
    if (agent === "dev_wallet") devWalletAgent.recordOutcome(agent, key, pnl_pct);
    if (agent === "narrative") narrativeAgent.recordOutcome(agent, key, pnl_pct);
  }
}

export type { Signal };
