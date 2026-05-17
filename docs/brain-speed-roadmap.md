# Brain Speed Roadmap

Updated: 2026-05-18

Target: brain p50 3s → 50ms; p99 → 700ms. LLM spend 5-10x lower.

ADR: [0006 Brain Speed Three-Tier Cache](adr/0006-brain-speed-three-tier-cache.md).

> **Status 2026-05-18:** Architecture is shipped (4 commits on main: docs, parallel
> Brain Agents + Decider seam, provider registry, dynamic sizing). Phases below
> were re-scoped during implementation — see notes per phase. Smoke + backtest
> pending; gated on user-side runs and pump.fun frontend-api recovery.

## Phase 0 — docs + keys — DONE (2026-05-17)

- ADR-0006 written.
- This roadmap.
- `.env.example` lists every key + provider.
- [Key Management](key-management.md) rules.

## Phase 1 — DONE (2026-05-17/18): provider registry + Cerebras + caching

Implemented:

- Cerebras + Groq added as OpenAI-compat brain providers.
- Single Provider registry Module (`agent/src/brain/providers.ts`) — both the
  multi-step Brain factory and the single-shot Brain Agent helper resolve via
  one `resolveProvider()` call. Adding the 7th provider is one SPECS entry.
- `agent/src/brain/oneshot.ts` does single-shot structured-output LLM calls
  (Zod schema → JSON schema via `zod-to-json-schema` → OpenAI `response_format`).
- Anthropic prompt caching: env flag `ANTHROPIC_PROMPT_CACHE=true` (consumer-side
  wiring lands in V1.5 when Anthropic premium path is unlocked).

Re-scoped: the "restructure agent-mode prompts into `[stable_prefix | per_token_payload]`"
move was deferred — V1 Brain Agents do single-shot calls (no agent-mode prompt
to restructure). When agent-mode Anthropic usage scales up, redo this work as a
separate prompt-engineering pass.

## Phase 2 — DONE (2026-05-18): structured output

Implemented:

- Brain Agents emit structured Signals via Zod-validated JSON schema (`oneShotJson`).
- Token cap 200-250 per agent.
- No retry loops — invalid LLM output → error path returns "unknown" Signal with
  low confidence, caller degrades to pure-policy `judge()`.

Re-scoped: the Intent enum lives in [[kuro-intent-grammar-2026-05-17]] as the
V2 design for autopilot intents; V1 uses Signal types (DevWalletSignal +
NarrativeSignal) since the brain in V1 is enrichment, not direct intent emission.
Intent enum lands when V2 Copilot mode is built.

## Phase 3 — DONE (2026-05-18): per-Brain-Agent L1 cache + PnL feedback

Implemented:

- `agent/src/brain/cache.ts` — generic `SignalCache<T>` with `Map<bigint, CachedSignal<T>>` L1.
- Cache key per agent: FNV-1a 64 over the agent's narrow input (creator pubkey
  for dev_wallet; name+symbol+week_of_year for narrative).
- TTL: 7 days for dev_wallet, 24h for narrative.
- Eviction: rolling win-rate <0.4 after ≥20 uses → evict.
- PnL feedback: `Position.contributing_signals[]` → `recordOutcomeAllAgents` on close.
- Persist: `./agent/state/cache_<agent>.json`.

Re-scoped: L2 Hamming-1 probe was specced for packed semantic state-words
(price/liq/age bits), not for hash-based keys (creator pubkey, name+symbol hash).
Per-agent caches are L1-only. L2 Hamming is the right shape for a future
`decide()`-output cache — defer until that's needed.

## Phase 4 — DEFERRED: streaming + executor pre-warm

Not landed this session. Brain Agents are off the snipe hot path (analyze and
agents run in parallel via `Promise.allSettled` with hard per-agent timeout),
so streaming + pre-warm only matter if/when an agent decision genuinely needs
to influence tx construction before the full response lands. Revisit if smoke
shows the parallel race is the bottleneck.

## Bonus Phase — DONE (2026-05-18): Decider seam + dynamic sizing

Implemented but not in original roadmap — surfaced during
`/improve-codebase-architecture` pass:

- **Decider seam** (`agent/src/autonomous/decider.ts`) — splits enrichment
  (varies between live + backtest) from `judge()` (pure shared function).
  `LiveDecider` runs real RPC + Brain Agents; `SimDecider` returns injected
  fixtures. Eliminates live ↔ backtest drift risk.
- **Dynamic position sizing** (`KURO_SNIPE_PCT_OF_BANKROLL` + `KURO_MAX_SNIPE_PCT`)
  — same code scales 1 SOL to 1000 SOL via live wallet balance × pct (60s cache).
  Absolute `KURO_SNIPE_SOL` is the fallback when pct=0.

## Pending (user-side)

- Smoke-test V1 dry-run for 2-4h (needs CEREBRAS_API_KEY or KURO_BRAIN=glm).
- Run backtest once pump.fun `frontend-api` recovers (Cloudflare 530 at session close).
- DECISION POINT: edge confirmed? Gates the Rust port.

## Out of scope (future phases)

- Phase 5: local SGLang + FP8 Qwen 7B fine-tuned. Requires 10k+ labeled decisions.
- Custom CUDA kernels. Not portable for solo.
- Model routing layer (cheap classifier in front of big model). Add if L3 volume grows.

## Provider stack

| Use | Provider | Model | TTFT p50 | Notes |
|---|---|---|---|---|
| Default | Cerebras | GLM-4.6 / Qwen3 32B | 600-800ms | 1M tok/day free |
| Fallback | Groq | Llama 3.3 70B spec-dec | 600-870ms | vendor resilience |
| Premium | Anthropic | Sonnet 4.6 + cache | 500ms+ | 90% cost cut on prefix |
| Future | local SGLang | FP8 Qwen 7B fine-tuned | <300ms | needs fine-tune data |

Avoid: Grok 4 (18s TTFT), GPT-5 thinking modes (hidden reasoning seconds).

## Five free wins (already baked into phases)

1. Prefix caching of stable context (Phase 1).
2. Structured output + token cap (Phase 2).
3. Streaming + executor pre-warm (Phase 4).
4. Model routing (Phase 5 if needed).
5. LLM off hot path (already enforced).
