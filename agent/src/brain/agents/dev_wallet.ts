import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { BrainAgent, BrainAgentSeed, DevWalletSignal as DevWalletSignalT } from "../signals.js";
import { DevWalletSignal } from "../signals.js";
import { SignalCache, fnv1a64 } from "../cache.js";
import { oneShotJson } from "../oneshot.js";
import type { SkillContext } from "../../skills/types.js";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d
const STATE_PATH = "./agent/state/cache_dev_wallet.json";
const TIMEOUT_MS = 3500;
const RECENT_TX_LIMIT = 50;

const LlmReply = z.object({
  reputation_band: z.enum(["rug_magnet", "pumper", "mixed", "legit", "unknown"]),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(280),
});
type LlmReply = z.infer<typeof LlmReply>;

const SYSTEM_PROMPT =
  "You classify Solana token creator reputations. You produce structured analytics — NEVER trade recommendations. " +
  "Use only the supplied facts. If facts are thin, return reputation_band='unknown' with low confidence. " +
  "rug_magnet: creator's prior tokens consistently went to zero. pumper: prior tokens showed strong early pumps. " +
  "mixed: results vary. legit: clean history, real project signals. unknown: insufficient evidence.";

export class DevWalletAgent implements BrainAgent<BrainAgentSeed, DevWalletSignalT> {
  name = "dev_wallet";
  private cache = new SignalCache<DevWalletSignalT>({
    agent: this.name,
    ttl_ms: TTL_MS,
    min_uses_before_eviction: 20,
    min_win_rate: 0.4,
    statePath: STATE_PATH,
  });
  private loaded = false;

  async classify(seed: BrainAgentSeed, ctx: SkillContext): Promise<DevWalletSignalT> {
    if (!this.loaded) {
      await this.cache.load();
      this.loaded = true;
    }
    const start = Date.now();

    const creator = await fetchCreatorPubkey(seed.signature, ctx);
    const cacheKey = creator ? fnv1a64(`creator:${creator}`) : fnv1a64(`mint:${seed.mint}`);

    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

    if (!creator) {
      const sig: DevWalletSignalT = {
        kind: "dev_wallet",
        agent: this.name,
        cache_key: cacheKey.toString(),
        emitted_at: Date.now(),
        confidence: 0,
        cached: false,
        latency_ms: Date.now() - start,
        creator_pubkey: "",
        prior_tokens_count: 0,
        prior_rug_rate: 0,
        prior_winner_rate: 0,
        reputation_band: "unknown",
        notes: "creator not extractable from launch tx",
      };
      this.cache.set(cacheKey, sig);
      void this.cache.save();
      return sig;
    }

    const activity = await fetchCreatorActivity(creator, ctx);

    const userPrompt = [
      `creator_pubkey: ${creator}`,
      `launch_source: ${seed.source}`,
      `mint: ${seed.mint}`,
      `recent_signatures_count: ${activity.recent_sig_count}`,
      `oldest_seen_age_days: ${activity.oldest_age_days?.toFixed(1) ?? "unknown"}`,
      `failed_tx_ratio: ${activity.failed_ratio.toFixed(2)}`,
    ].join("\n");

    const reply = await oneShotJson<LlmReply>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: LlmReply,
      schemaName: "DevWalletReply",
      maxTokens: 200,
      timeoutMs: TIMEOUT_MS,
    });

    let sig: DevWalletSignalT;
    if (!reply.ok) {
      ctx.log("dev_wallet_agent llm error", { error: reply.error, latency_ms: reply.latency_ms });
      sig = {
        kind: "dev_wallet",
        agent: this.name,
        cache_key: cacheKey.toString(),
        emitted_at: Date.now(),
        confidence: 0,
        cached: false,
        latency_ms: Date.now() - start,
        creator_pubkey: creator,
        prior_tokens_count: 0,
        prior_rug_rate: 0,
        prior_winner_rate: 0,
        reputation_band: "unknown",
        notes: `llm_error: ${reply.error.slice(0, 100)}`,
      };
    } else {
      sig = {
        kind: "dev_wallet",
        agent: this.name,
        cache_key: cacheKey.toString(),
        emitted_at: Date.now(),
        confidence: reply.value.confidence,
        cached: false,
        latency_ms: Date.now() - start,
        creator_pubkey: creator,
        prior_tokens_count: 0, // wired in V1.5 via Helius DAS
        prior_rug_rate: 0,
        prior_winner_rate: 0,
        reputation_band: reply.value.reputation_band,
        notes: reply.value.notes,
      };
    }

    this.cache.set(cacheKey, sig);
    void this.cache.save();
    return DevWalletSignal.parse(sig);
  }

  recordOutcome(_signalAgent: string, key: bigint, pnl_pct: number): void {
    this.cache.recordOutcome(key, pnl_pct);
    void this.cache.save();
  }
}

async function fetchCreatorPubkey(
  signature: string,
  ctx: SkillContext,
): Promise<string | null> {
  try {
    const tx = await ctx.rpc.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) return null;
    const signer = tx.transaction.message.accountKeys.find((k) => k.signer);
    if (!signer) return null;
    const pk = signer.pubkey instanceof PublicKey ? signer.pubkey.toBase58() : String(signer.pubkey);
    return pk;
  } catch {
    return null;
  }
}

interface CreatorActivity {
  recent_sig_count: number;
  oldest_age_days: number | null;
  failed_ratio: number;
}

async function fetchCreatorActivity(creator: string, ctx: SkillContext): Promise<CreatorActivity> {
  try {
    const sigs = await ctx.rpc.getSignaturesForAddress(new PublicKey(creator), {
      limit: RECENT_TX_LIMIT,
    });
    if (sigs.length === 0) {
      return { recent_sig_count: 0, oldest_age_days: null, failed_ratio: 0 };
    }
    const failed = sigs.filter((s) => s.err).length;
    const oldest = sigs[sigs.length - 1]?.blockTime;
    const oldest_age_days = oldest ? (Date.now() / 1000 - oldest) / 86400 : null;
    return {
      recent_sig_count: sigs.length,
      oldest_age_days,
      failed_ratio: failed / sigs.length,
    };
  } catch {
    return { recent_sig_count: 0, oldest_age_days: null, failed_ratio: 0 };
  }
}
