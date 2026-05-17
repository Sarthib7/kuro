# Brain Speed Roadmap

Updated: 2026-05-17

Target: brain p50 3s → 50ms; p99 → 700ms. LLM spend 5-10x lower.

ADR: [0006 Brain Speed Three-Tier Cache](adr/0006-brain-speed-three-tier-cache.md).

## Phase 0 — docs + keys (now)

- ADR-0006 written.
- This roadmap.
- `.env.example` lists every key + provider.
- [Key Management](key-management.md) rules.

## Phase 1 — Day 1-2: prompt restructure + Cerebras + caching

- Refactor brain prompts: `[stable_prefix | per_token_payload]`.
- Add `cerebras` provider in `agent/src/brain/`. OpenAI-compat API.
- Wire `KURO_BRAIN=cerebras`.
- Enable Anthropic `cache_control: {type: "ephemeral"}` on prefix block when `KURO_BRAIN=anthropic`.
- Measure TTFT before/after.

Done: TTFT 3s → ~700ms on cached repeat call.

## Phase 2 — Day 3-4: structured output

- Zod schema matches Intent enum (Buy, Sell, SetStop, SetTakeProfit, AbortAll, NoOp).
- Pass JSON schema to provider (Cerebras `response_format`, Anthropic `tool_use`).
- Hard token cap 200.
- Drop free-text reasoning. Use `reason_tag` enum field.
- Strip retry loops.

Done: 30% wall-clock cut. No retries on schema violation.

## Phase 3 — Day 5-6: L1+L2 cache

- New `agent/src/brain/cache.ts`.
- L1: `Map<bigint, CachedIntent>` — exact match.
- L2: Hamming-1 probe over 8-12 decision-relevant bits.
- Cache key: `(state_word_u64, regime_tag)`.
- PnL feedback hook: executor POSTs outcome → brain cache.
- TTL 24-72h on memecoin entries.
- Eviction: rolling win-rate <50% over 20 uses → evict.
- Persist: `./agent/state/intent_cache.json`.

Done: 60-75% L1+L2 hit at 10k+ decisions. Blended p50 microseconds.

## Phase 4 — Day 7: streaming + pre-warm

- Brain streams partial JSON (NDJSON or SSE).
- Executor `/prewarm` endpoint: receives `{mint, action}` → builds tx skeleton.
- On full Intent received → executor patches amounts + signs + submits.

Done: snipe critical path closed.

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
