# Brain Speed via Three-Tier Decision Cache

Accepted. Brain emits Intent via L1 (`Map<bigint, CachedIntent>` exact) → L2 (Hamming-1 probe over decision bits) → L3 (LLM call). State-word from intent grammar = cache key. No embeddings — state already discrete. Default LLM = Cerebras-hosted open-weight model. Premium = Anthropic Sonnet with `cache_control` on prefix.

## Tiers

| Tier | Mechanism | Latency | Hit @100k |
|---|---|---|---|
| L1 | exact `state_word` match | ~100ns | ~30% |
| L2 | Hamming-1 probe (8-12 decision bits) | ~5-10μs | +45% |
| L3 | LLM, prompt-cached, structured JSON | p50 600-800ms | 25% novel |

Cache key = `(state_word_u64, regime_tag)`. `regime_tag` = `week_of_year` or volatility bucket. Segregates March-meta from May-meta.

## Consequences

- New module `agent/src/brain/cache.ts`.
- Brain provider abstraction extends to `cerebras`, `groq`.
- Prompt structure required: `[stable_prefix | per_token_payload]` so providers can cache prefix.
- Every brain call wrapped in JSON schema matching Intent enum. Hard 200-token cap.
- PnL feedback loop required: executor reports outcome → brain cache evicts losers.
- Mandatory invalidation: rolling win-rate <threshold → evict; 24-72h TTL on memecoin entries. Without this, cache compounds losses faster than it saves latency.
- LLM stays off hot path (per [feedback_speed](../../README.md)). Executor never blocks on L3.
