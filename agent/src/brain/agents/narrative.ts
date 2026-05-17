import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import type { BrainAgent, BrainAgentSeed, NarrativeSignal as NarrativeSignalT } from "../signals.js";
import { NarrativeSignal } from "../signals.js";
import { SignalCache, fnv1a64, weekOfYearRegime } from "../cache.js";
import { oneShotJson } from "../oneshot.js";
import type { SkillContext } from "../../skills/types.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h — narrative drifts fast
const STATE_PATH = "./agent/state/cache_narrative.json";
const TIMEOUT_MS = 3500;

const METAPLEX_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const LlmReply = z.object({
  themes: z.array(z.string().max(40)).max(8),
  sentiment_band: z.enum([
    "speculative_hype",
    "organic_interest",
    "neutral",
    "skeptical",
    "unknown",
  ]),
  mention_velocity_band: z.enum(["rising_fast", "rising", "flat", "fading", "unknown"]),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(280),
});
type LlmReply = z.infer<typeof LlmReply>;

const SYSTEM_PROMPT =
  "You extract narrative themes from Solana token metadata. You produce structured analytics, NEVER trade recommendations. " +
  "Themes = short tags (e.g. 'AI', 'agent', 'trump', 'cat', 'doge-derivative'). " +
  "sentiment_band classifies the *naming pattern* not the market: speculative_hype = numeric/CAPSLOCK/ticker spam; " +
  "organic_interest = real project naming; neutral = generic; skeptical = obvious clone/scam pattern. " +
  "mention_velocity_band: leave 'unknown' unless socials provided. " +
  "If name+symbol missing, return all-unknown with low confidence.";

export class NarrativeAgent implements BrainAgent<BrainAgentSeed, NarrativeSignalT> {
  name = "narrative";
  private cache = new SignalCache<NarrativeSignalT>({
    agent: this.name,
    ttl_ms: TTL_MS,
    min_uses_before_eviction: 20,
    min_win_rate: 0.4,
    statePath: STATE_PATH,
  });
  private loaded = false;

  async classify(seed: BrainAgentSeed, ctx: SkillContext): Promise<NarrativeSignalT> {
    if (!this.loaded) {
      await this.cache.load();
      this.loaded = true;
    }
    const start = Date.now();

    const meta = await fetchTokenMetadata(seed.mint, ctx);
    const regime = weekOfYearRegime();
    const cacheKey = meta
      ? fnv1a64(`${meta.name}|${meta.symbol}|${regime}`)
      : fnv1a64(`mint:${seed.mint}|${regime}`);

    const hit = this.cache.get(cacheKey);
    if (hit) return hit;

    if (!meta) {
      const sig: NarrativeSignalT = {
        kind: "narrative",
        agent: this.name,
        cache_key: cacheKey.toString(),
        emitted_at: Date.now(),
        confidence: 0,
        cached: false,
        latency_ms: Date.now() - start,
        themes: [],
        sentiment_band: "unknown",
        mention_velocity_band: "unknown",
        notes: "metadata not found",
      };
      this.cache.set(cacheKey, sig);
      void this.cache.save();
      return sig;
    }

    const userPrompt = [
      `name: ${meta.name}`,
      `symbol: ${meta.symbol}`,
      `launch_source: ${seed.source}`,
      `mint: ${seed.mint}`,
    ].join("\n");

    const reply = await oneShotJson<LlmReply>({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: LlmReply,
      schemaName: "NarrativeReply",
      maxTokens: 250,
      timeoutMs: TIMEOUT_MS,
    });

    let sig: NarrativeSignalT;
    if (!reply.ok) {
      ctx.log("narrative_agent llm error", { error: reply.error, latency_ms: reply.latency_ms });
      sig = {
        kind: "narrative",
        agent: this.name,
        cache_key: cacheKey.toString(),
        emitted_at: Date.now(),
        confidence: 0,
        cached: false,
        latency_ms: Date.now() - start,
        themes: [],
        sentiment_band: "unknown",
        mention_velocity_band: "unknown",
        notes: `llm_error: ${reply.error.slice(0, 100)}`,
      };
    } else {
      sig = {
        kind: "narrative",
        agent: this.name,
        cache_key: cacheKey.toString(),
        emitted_at: Date.now(),
        confidence: reply.value.confidence,
        cached: false,
        latency_ms: Date.now() - start,
        themes: reply.value.themes,
        sentiment_band: reply.value.sentiment_band,
        mention_velocity_band: reply.value.mention_velocity_band,
        notes: reply.value.notes,
      };
    }

    this.cache.set(cacheKey, sig);
    void this.cache.save();
    return NarrativeSignal.parse(sig);
  }

  recordOutcome(_signalAgent: string, key: bigint, pnl_pct: number): void {
    this.cache.recordOutcome(key, pnl_pct);
    void this.cache.save();
  }
}

async function fetchTokenMetadata(
  mint: string,
  ctx: SkillContext,
): Promise<{ name: string; symbol: string } | null> {
  try {
    const mintPk = new PublicKey(mint);
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METAPLEX_PROGRAM.toBuffer(), mintPk.toBuffer()],
      METAPLEX_PROGRAM,
    );
    const acct = await ctx.rpc.getAccountInfo(pda, "confirmed");
    if (!acct) return null;
    return parseMetaplex(acct.data);
  } catch {
    return null;
  }
}

// Metaplex Token Metadata v1 layout (relevant prefix):
//   1  byte  key
//   32 bytes update_authority
//   32 bytes mint
//   u32 name_len + name (utf-8, padded to 32)
//   u32 symbol_len + symbol (utf-8, padded to 10)
function parseMetaplex(data: Buffer): { name: string; symbol: string } | null {
  if (data.length < 100) return null;
  try {
    let off = 1 + 32 + 32;
    const nameLen = data.readUInt32LE(off);
    off += 4;
    if (nameLen > 200 || off + nameLen > data.length) return null;
    const name = data.slice(off, off + nameLen).toString("utf8").replace(/\0+$/g, "").trim();
    off += nameLen;
    const symbolLen = data.readUInt32LE(off);
    off += 4;
    if (symbolLen > 50 || off + symbolLen > data.length) return null;
    const symbol = data.slice(off, off + symbolLen).toString("utf8").replace(/\0+$/g, "").trim();
    if (!name && !symbol) return null;
    return { name, symbol };
  } catch {
    return null;
  }
}
