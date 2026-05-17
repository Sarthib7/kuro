import { z } from "zod";
import type { SkillContext } from "../skills/types.js";

/**
 * Signal envelope — every Brain Agent output carries these fields.
 * Brain Agents emit Signals (analytics), never trade decisions.
 * Strategy + Risk Cap convert Signals into Trade Intent.
 * See CONTEXT.md and docs/adr/0006-brain-speed-three-tier-cache.md.
 */
export const SignalEnvelope = z.object({
  agent: z.string(),
  cache_key: z.string(), // bigint serialized; agent records this for PnL feedback routing
  emitted_at: z.number(),
  confidence: z.number().min(0).max(1),
  cached: z.boolean(),
  latency_ms: z.number(),
});

export const DevWalletSignal = SignalEnvelope.extend({
  kind: z.literal("dev_wallet"),
  creator_pubkey: z.string(),
  prior_tokens_count: z.number().int().min(0),
  prior_rug_rate: z.number().min(0).max(1),
  prior_winner_rate: z.number().min(0).max(1),
  reputation_band: z.enum(["rug_magnet", "pumper", "mixed", "legit", "unknown"]),
  notes: z.string().max(280).optional(),
});
export type DevWalletSignal = z.infer<typeof DevWalletSignal>;

export const NarrativeSignal = SignalEnvelope.extend({
  kind: z.literal("narrative"),
  themes: z.array(z.string().max(40)).max(8),
  sentiment_band: z.enum([
    "speculative_hype",
    "organic_interest",
    "neutral",
    "skeptical",
    "unknown",
  ]),
  mention_velocity_band: z.enum(["rising_fast", "rising", "flat", "fading", "unknown"]),
  notes: z.string().max(280).optional(),
});
export type NarrativeSignal = z.infer<typeof NarrativeSignal>;

export const Signal = z.discriminatedUnion("kind", [DevWalletSignal, NarrativeSignal]);
export type Signal = z.infer<typeof Signal>;

/**
 * SignalBundle — what arrives at decide() after parallel Brain Agents complete.
 * Missing agents (timeout, error, no key) are simply absent from `by_agent`.
 */
export interface SignalBundle {
  signals: Signal[];
  by_agent: { dev_wallet?: DevWalletSignal; narrative?: NarrativeSignal };
}

/**
 * Brain Agent — single-shot, structured-output LLM call producing one Signal.
 * Implementations own their own cache (see agent/src/brain/cache.ts).
 * Implementations enforce their own timeout; orchestrator wraps with hard budget.
 */
export interface BrainAgent<TInput, TSignal extends Signal> {
  name: string;
  classify(input: TInput, ctx: SkillContext): Promise<TSignal>;
  /** Feedback hook called by autonomous loop on position close. */
  recordOutcome(signalAgent: string, key: bigint, pnl_pct: number): void;
}

/**
 * Inputs handed to each Brain Agent on a fresh candidate.
 * Agents fetch their own enrichment data inside classify() in parallel
 * with analyzeTokenSkill — they receive only the seed.
 */
export interface BrainAgentSeed {
  mint: string;
  source: string;
  signature: string;
  detected_at: number;
}
