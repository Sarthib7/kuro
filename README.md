<h1 align="center">kuro</h1>

<p align="center"><strong>Open, self-hosted, multichain Personal AI CFO.</strong></p>
<p align="center">Trade, snipe, analyze, and run autonomous strategies through chat — no browser wallet, no third-party backend, no closed-source CLI in the path. Starting with deep Solana coverage; multichain in the roadmap.</p>

<p align="center">
  <a href="https://claude.com/claude-code"><img src="https://img.shields.io/badge/Claude_Code-skill_compatible-blueviolet" alt="Claude Code compatible"></a>
  <a href="https://docs.openclaw.ai/tools/skills"><img src="https://img.shields.io/badge/OpenClaw-skill_compatible-blue" alt="OpenClaw compatible"></a>
  <a href="https://hermes-agent.nousresearch.com/"><img src="https://img.shields.io/badge/Hermes_Agent-skill_compatible-yellow" alt="Hermes compatible"></a>
</p>

## What it is

kuro is a **multichain Personal AI CFO** in the spirit of [Minara](https://minara.ai), with three honest differences:

1. **Open-source executor** — Minara's CLI is closed-source npm; kuro's Rust executor + TypeScript agent are fully auditable.
2. **Self-hosted, no vendor backend** — your wallet and keys never leave your machine. No login flow, no third-party trade routing.
3. **Sniper-specialized depth** — Minara is a generalist swap/perps tool; kuro is built around Jito-bundled sniping, honeypot simulation, new-pool detection, smart-money signals, and a deterministic autonomous loop.

Today, kuro is **Solana-only**. Multichain (Base / Ethereum / Arbitrum next, eventually Hyperliquid perps) is in the roadmap. The chain abstraction is being designed so the second chain is a module, not a fork.

It runs in two modes:

1. A **standalone autonomous trading agent** (`kuro autonomous`) — watches new pools on Pump.fun / PumpSwap / Raydium / Meteora, runs safety + signal checks, snipes via the Rust executor with Jito bundles, manages positions with TP/SL/max-hold exits. The whole loop runs without an LLM in the latency path.
2. A **drop-in skill** for Claude Code / OpenClaw / Hermes — drop `skills/kuro/` into your host agent's skills directory and ask in plain language: *"analyze this mint", "snipe 0.05 SOL of $BONK if safe", "enrich this dev wallet"*. The host agent reads `SKILL.md`, picks the right command, shells out to kuro.

Both modes can run at once — autonomous trading on a server, interactive analysis from your laptop.

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
| Phoenix perps | alpha | read markets/trader state; build + simulate guarded isolated market orders through the executor |
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

# Phoenix perps read-only state
npm run dev -- phoenix-markets SOL
npm run dev -- phoenix-trader

# Phoenix isolated market order dry-run (builds + simulates; does not submit)
npm run dev -- phoenix-open SOL long 0.1 10 --dry-run=true
```

## Operator docs and landing page

- Production runbook: [`docs/production.md`](docs/production.md)
- Static landing page: [`site/index.html`](site/index.html)

### Install as a Claude Code skill

```bash
mkdir -p ~/.claude/skills
cp -r skills/kuro ~/.claude/skills/kuro
```

Then ask Claude Code naturally: *"kuro, analyze $BONK"*, *"watch for new pump.fun pools"*, *"snipe 0.02 SOL of <mint>, dry-run first"*.

## Deploy to Railway

kuro is built to run as two services on [Railway](https://railway.app) — `kuro-executor` (Rust, owns the wallet) and `kuro-autonomous` (Node worker, runs the trading loop). They talk over Railway's internal network so the executor is never exposed publicly.

**One-time setup**

1. Create a Railway project. Connect this repo.
2. **Service 1 — `kuro-executor`**
   - Set service root directory to `executor/`
   - Attach a Volume mounted at `/data` (≥ 1 GB) — this holds the hot wallet and risk state
   - Set env vars:
     ```
     SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
     PORT=8080
     KURO_BIND=0.0.0.0:8080
     KURO_EXECUTOR_API_KEY=strong-random-secret
     KURO_DATA_DIR=/data
     KURO_MAX_TRADE_SOL=0.02
     KURO_DAILY_CAP_SOL=0.1
     KURO_DRAWDOWN_KILL_PCT=20
     ```
   - Deploy. The executor will auto-generate `/data/keypair.json` on first boot.
3. **Service 2 — `kuro-autonomous`**
   - Set service root directory to `agent/`
   - Attach a separate Volume mounted at `/data` (≥ 1 GB) — holds open/closed position state
   - Set env vars:
     ```
     SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
     KURO_EXECUTOR_URL=http://kuro-executor.railway.internal:8080
     KURO_EXECUTOR_API_KEY=same-secret-as-executor
     KURO_POSITIONS_PATH=/data/positions.json
     KURO_BRAIN=glm
     GLM_API_KEY=your_glm_key
     KURO_AUTONOMOUS_LIVE=false
     ```
   - Optional enrichment keys: `BIRDEYE_API_KEY`, `ZERION_API_KEY`, `GMGN_API_KEY`, `JUPITER_API_KEY`.
   - Deploy. The autonomous worker will reach the executor via internal DNS.

**Fund the wallet**

Once the executor is running, get its public key:
```bash
railway logs --service kuro-executor | grep wallet
```
…or hit `/status` from a temporary public domain. Send SOL to that address. Verify with `/status` again.

**Flip live (only after backtest validates)**

Set `KURO_AUTONOMOUS_LIVE=true` in the `kuro-autonomous` service env and redeploy. The Rust executor's per-trade / daily / drawdown caps still apply — even if the agent is jailbroken, the executor rejects oversized swaps.

**Critical**

- Do not lose either volume. The executor volume holds the keypair; the agent volume holds position state.
- Use Railway's "deploy from PR" sparingly — every deploy to the executor service restarts the process. The risk state persists across restarts (it's in the volume), but in-flight swaps don't.

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
| Phoenix | private beta | Solana perps markets, trader state, and isolated market-order transaction builders |
| Zerion | free tier | Cross-chain wallet enrichment — portfolio, Solana positions, recent txns |
| GMGN | public + paid | Smart-money / Pump.fun signals — bundle share, creator hold %, alpha-wallet buys |

## Risk caps (enforced in Rust, not in prompts)

```
KURO_MAX_TRADE_SOL=0.1           # per-trade ceiling — executor rejects above this
KURO_DAILY_CAP_SOL=1.0           # cumulative daily spend — executor rejects above this
KURO_DRAWDOWN_KILL_PCT=20.0      # if balance drops by this % from start-of-day, all trades blocked
KURO_MAX_PERP_COLLATERAL_USDC=25 # per Phoenix isolated order collateral cap
KURO_DAILY_PERP_COLLATERAL_USDC=100
KURO_PHOENIX_LIVE_ENABLED=false  # live perps stay blocked unless explicitly enabled
```

These live in the executor's state (`executor/state.json`) and survive restarts. The LLM cannot bypass them, even if its system prompt is jailbroken — the rejection happens before the swap is built.

## Roadmap

**Solana depth (gates live trading):**
- **Backtest harness** — replay historical Pump.fun launches against `policy.decide()` to validate hypothetical EV before flipping `KURO_AUTONOMOUS_LIVE=true`
- **Persistence** — SQLite in executor for positions / trades / risk (replaces JSON files)
- **Yellowstone Geyser** — gRPC streaming on Helius dedicated plan for sub-100ms new-pool detection
- **Multi-RPC `sendTransaction` race** — submit same tx to Helius + Alchemy in parallel for faster landing
- **Smart-money policy boost** — fold GMGN's alpha-wallet signal into `policy.decide()` as a size multiplier

**Multichain expansion (after Solana proves out):**
- **Chain abstraction** — `Chain` trait in Rust executor + TS data layer abstracting per-chain RPC, swap router, and explorer
- **Chain 2: Base** — Uniswap V4 + 0x routing, ERC-20 sniper, Aerodrome integration
- **Chain 3: Ethereum / Arbitrum / BSC** — share the Base implementation
- **Hyperliquid perps** — open positions, leverage, stop-out logic
- **Cross-chain bridge intent** — LiFi or Across routing for "move my position to chain X"

**AI CFO surface (Minara parity items):**
- `kuro portfolio` — cross-chain balance + position table
- `kuro transfer` / `kuro withdraw` — guarded fund-moving operations
- `kuro limit-order` — server-side limit orders via DEX-native limit-order programs
- Fiat onramp — deferred until there's a clean self-hosted path; not depending on MoonPay-style proprietary integrations

## Compatibility notes

- Skill convention follows the [Minara-AI/skills](https://github.com/Minara-AI/skills) pattern. kuro and Minara are designed to coexist: install both `~/.claude/skills/minara` and `~/.claude/skills/kuro`. Minara wins on multichain spot + perps + fiat today; kuro wins on Solana sniper depth + open source + self-hosting.
- Tested with: Claude Code (Sonnet 4.6 / Opus 4.7), GLM-4.5, Codex CLI (gpt-5-codex).
- Subprocess Codex fallback works but is degraded — native OAuth → Responses API is preferred.

## License

MIT
