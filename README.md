<h1 align="center">kuro</h1>

<p align="center">An autonomous Solana trading agent. Sniper, arbitrage, and analysis — with the LLM kept out of the hot path.</p>

<p align="center">
  <a href="https://claude.com/claude-code"><img src="https://img.shields.io/badge/Claude_Code-skill_compatible-blueviolet" alt="Claude Code compatible"></a>
  <a href="https://docs.openclaw.ai/tools/skills"><img src="https://img.shields.io/badge/OpenClaw-skill_compatible-blue" alt="OpenClaw compatible"></a>
  <a href="https://hermes-agent.nousresearch.com/"><img src="https://img.shields.io/badge/Hermes_Agent-skill_compatible-yellow" alt="Hermes compatible"></a>
</p>

## What it is

kuro is two things bolted together:

1. A **standalone Solana trading bot** (`kuro autonomous`) — watches new pools on Pump.fun / PumpSwap / Raydium / Meteora, runs safety + signal checks, snipes via a deterministic Rust executor with Jito bundles, manages positions with TP/SL/max-hold exits. The whole loop runs without an LLM in the latency path.
2. A **drop-in skill** for Claude Code / OpenClaw / Hermes — drop `skills/kuro/` into your host agent's skills directory and ask in plain language: *"analyze this mint", "snipe 0.05 SOL of $BONK if safe", "what does kuro think about this dev wallet?"*. The host agent reads `SKILL.md`, picks the right command, shells out to kuro.

You can run either mode. Or both at once — autonomous trading on its own machine, interactive analysis from your laptop.

## Architecture

```
┌─ Skill mode (Claude Code / OpenClaw / Hermes) ─┐
│  Host agent reads skills/kuro/SKILL.md         │
│  → picks a command → shells out to kuro CLI    │
└────────────────┬───────────────────────────────┘
                 │
┌────────────────▼───────────────┐    ┌──────────────────────────────┐
│  agent/  (TypeScript)          │    │  executor/  (Rust hot path)  │
│  • skills/      kuro commands  │ ─→ │  • Jupiter v6 quote + swap   │
│  • autonomous/  event loop     │    │  • Jito bundle submission    │
│  • watcher/     new-pool sub   │    │  • Risk caps (per-trade,     │
│  • brain/       multi-LLM      │    │    daily, drawdown)          │
│  • data/        external APIs  │    │  • 2s blockhash cache        │
└────────────────────────────────┘    └────────────┬─────────────────┘
                                                   │
                                              hot wallet
```

**Why split TS + Rust?** The LLM (Claude / GLM / Codex / Anthropic) can take 200–1000ms per call. That's a death sentence for sniping. The Rust executor owns the wallet and signs+sends trades in <100ms. The LLM decides *what* to trade; the executor decides *how* fast.

## Status

| Phase | Status | What works |
|---|---|---|
| 1 — Analysis | done | `analyze_token` (authorities, top holders, depth, round-trip honeypot sim), DexScreener market data, optional Birdeye |
| 2 — Sniper | done | `snipe` skill → Rust executor → Jupiter swap → Jito bundle, with re-checked safety gates |
| 2.5 — Watcher | done | `kuro watch` streams Pump.fun / PumpSwap / Raydium / Meteora new-pool events |
| 3 — Arbitrage | done (sketch) | SOL → mint → USDC → SOL triangle scan via Jupiter; sequential execution |
| Autonomy | done | `kuro autonomous` ties watcher + analyze + snipe + position monitor (TP/SL/max-hold) |
| Multi-brain | done | GLM (default), Anthropic, Codex (OAuth), OpenAI-compat |
| Persistence | next | SQLite in executor for positions/trades/risk |
| Geyser | next | Replace WS `logsSubscribe` with Yellowstone gRPC for sub-100ms detection |

## Quick start

```bash
# 1) Clone, set env
git clone https://github.com/Sarthib7/kuro.git
cd kuro
cp .env.example .env
# fill SOLANA_RPC_URL (Helius recommended), GLM_API_KEY, optionally BIRDEYE/ZERION/GMGN

# 2) Build + run the Rust executor (terminal 1)
cd executor && cargo run --release
# auto-generates ./executor/keypair.json — FUND IT before flipping live

# 3) Use kuro (terminal 2)
cd agent && npm install

# read-only token analysis
npm run analyze -- 9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump

# watch new pools (Ctrl-C to stop)
npm run watch

# LLM-driven interactive (uses brain selected by KURO_BRAIN)
npm run agent -- "is this mint a honeypot: <mint>"

# autonomous trading loop (dry-run unless KURO_AUTONOMOUS_LIVE=true)
npm run autonomous

# show open + closed positions
npm run positions
```

### Install as a Claude Code skill

```bash
mkdir -p ~/.claude/skills
cp -r skills/kuro ~/.claude/skills/kuro
```

Then ask Claude Code naturally: *"kuro, analyze $BONK"*, *"watch for new pump.fun pools"*, *"snipe 0.02 SOL of <mint>, dry-run first"*.

## Brain providers (`KURO_BRAIN`)

`kuro agent` and any future LLM-assisted policy decisions go through a pluggable brain abstraction.

| Provider | Setting | Notes |
|---|---|---|
| **GLM** (Zhipu) | `KURO_BRAIN=glm` + `GLM_API_KEY` | Default. Native function-calling. OpenAI-compatible endpoint. |
| **Anthropic** | `KURO_BRAIN=anthropic` + `ANTHROPIC_API_KEY` | Claude models. Native function-calling. |
| **Codex** (OAuth) | `KURO_BRAIN=codex` after `codex login` | Reads `~/.codex/auth.json`, calls OpenAI Responses API directly with your ChatGPT subscription. Same fidelity as native APIs. |
| **OpenAI-compat** | `KURO_BRAIN=openai` + `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`) | Works with DeepSeek / Together / Groq / vLLM / any OpenAI-compat endpoint. |

Skill mode (running inside Claude Code etc.) doesn't use this — the host agent is the brain.

## Data layer

All optional; `analyze_token` degrades gracefully when a key is missing.

| Source | Cost | Used for |
|---|---|---|
| Solana RPC | depends on RPC provider | Mint info, top holders, transaction parsing. Helius strongly recommended over public RPC. |
| Jupiter (public) | free | Quote + swap routes + price-impact sampling for depth + honeypot sim |
| Jupiter Pro | paid | Optional. Higher RPS via `JUPITER_API_KEY` → `api.jup.ag/swap/v1` |
| DexScreener | free | Default for price / liquidity / market cap / 24h volume |
| Birdeye | paid | Optional. Adds total holder count; takes priority over DexScreener if `BIRDEYE_API_KEY` set |
| Helius | paid | Webhooks + Yellowstone Geyser gRPC for sub-100ms new-pool detection (planned) |
| Zerion | free tier | Cross-chain wallet enrichment — portfolio, Solana positions, recent txns |
| GMGN | public + paid | Smart-money / Pump.fun signals — bundle share, creator hold %, alpha-wallet buys |

## Risk caps (enforced in Rust, not in prompts)

```
KURO_MAX_TRADE_SOL=0.1           # per-trade ceiling — executor rejects above this
KURO_DAILY_CAP_SOL=1.0           # cumulative daily spend — executor rejects above this
KURO_DRAWDOWN_KILL_PCT=20.0      # if balance drops by this % from start-of-day, all trades blocked
```

These live in the executor's state (`executor/state.json`) and survive restarts. The LLM cannot bypass them, even if its system prompt is jailbroken — the rejection happens before the swap is built.

## Roadmap

- **Persistence** — SQLite in executor for positions / trades / risk (replaces JSON files)
- **Yellowstone Geyser** — gRPC streaming on Helius dedicated plan for sub-100ms new-pool detection
- **Multi-RPC `sendTransaction` race** — submit same tx to Helius + Alchemy in parallel for faster landing
- **Pre-created ATAs** — skip in-line associated-token-account creation on the snipe hot path
- **Smart-money policy boost** — fold GMGN's alpha-wallet signal into `policy.decide()` as a size multiplier
- **Backtest harness** — replay historical pump.fun firehose against the current policy

## Compatibility notes

- The `Minara-AI/skills` pattern is what this SKILL follows. kuro is **Solana-only**; Minara covers EVM + perps + fiat onramp. Use both together: Minara for non-Solana stuff, kuro for Solana sniping/arb/autonomous.
- Tested with: Claude Code (Sonnet 4.6 / Opus 4.7), GLM-4.5, Codex CLI (gpt-5-codex).
- Subprocess Codex fallback works but is degraded — native OAuth → Responses API is preferred.

## License

MIT
