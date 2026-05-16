# Kuro Roadmap Against Minara

Researched: 2026-05-17

## Target

Kuro = open, self-hosted AI trading copilot + guarded Autopilot.

- Copilot: research, explain, simulate, preview.
- Autopilot: run scoped strategies.
- Executor: sign, submit, enforce caps.
- Workflow: prompt -> trigger/condition/action graph.

No investment advice. User-directed tool.

## Current Kuro

Already built:

- Solana token analysis.
- New-pool watcher.
- Autonomous sniper loop.
- Rust executor with Jupiter + Jito.
- Per-trade, daily, drawdown, perps collateral caps.
- Multi-brain LLM abstraction.
- Phoenix perps alpha.
- Backtest command.

Gap: product shell. Need portfolio context, richer research, workflows, strategy registry, notifications, persistence, web UI.

## Gap Matrix

| Capability | Minara | Kuro Now | Priority |
|---|---|---|---|
| Financial chat | markets + onchain + news + DeFi | CLI agent | P0 |
| Token research | multi-source report | safety flags | P0 |
| Wallet research | portfolio + smart money | enrichment skill | P0 |
| Spot execution | intent -> swap | snipe + arb | P0 |
| Perps copilot | long/short plan | Phoenix alpha | P1 |
| Autopilot | scoped strategies | sniper loop | P1 |
| Workflow builder | prompt -> graph | missing | P1 |
| Notifications | Telegram/email | missing | P1 |
| Backtesting | Strategy Studio planned | command exists | P1 |
| Persistence | history + strategy state | JSON state | P1 |
| Web/mobile | app | static site | P2 |
| API | chat/swap/perps/x402 | CLI/skill | P2 |
| Agent marketplace | Gen-0 | missing | P3 |

## Phase 1: Kuro Desk

Goal: Minara-like copilot, no unattended live trading.

Build:

- Web console: chat, token panel, wallet panel, positions, risk status, execution preview.
- Source-backed research reports.
- Tool calls: token analysis, wallet enrichment, Jupiter quotes, DexScreener, GMGN, Birdeye, Helius.
- Confirm-before-live spot swaps.
- Tx preview: route, in/out, slippage, fees, price impact, balance, risk cap result.

Done when:

- "Analyze this mint" -> structured report.
- "Buy 0.05 SOL if safe" -> dry-run preview by default.
- LLM cannot bypass Executor caps.

## Phase 2: Workflow IR

Goal: prompts become inspectable workflows.

Workflow model:

- Triggers: price, wallet activity, schedule, new pool, portfolio drawdown.
- Conditions: liquidity, holder concentration, authority state, volume, age, smart-money count, risk score.
- Actions: notify, dry-run trade, live trade, set TP/SL, stop workflow.
- State: draft, deployed, paused, stopped, failed, last run, next run.

Do JSON IR first. Visual builder later.

## Phase 3: Guarded Autopilot

Goal: strategy runs inside explicit Trading Scope.

Build:

- Strategy registry.
- Typed params.
- Allowed mints/markets.
- Max position, daily cap, drawdown cap, slippage cap.
- TP/SL/max hold.
- Paper mode + backtest required before live.
- Manual override reconciliation.
- Kill switch in UI + Executor.

First strategies:

- Pump.fun safety sniper.
- Smart-money convergence follower.
- DCA ladder.
- TP/SL rebalancer.

## Phase 4: Perps Copilot

Goal: Minara-style long/short preview, dry-run first.

Build:

- Perps market reader.
- Signals: OHLCV, trend, RSI, MACD, EMA, funding, OI, liquidity, volatility.
- Suggestion schema: side, entry, invalidation, TP, SL, confidence, reasons, risks.
- Venue + jurisdiction gate before live.

## Phase 5: API + Agent Surface

Goal: other agents call Kuro safely.

Build:

- Local HTTP API: chat, token analysis, wallet analysis, workflow create, quote dry-run, execution preview.
- API keys + scopes.
- Audit log per call.
- x402/pay-per-call later.

## Architecture

Keep split:

- TypeScript agent: planning, workflows, UI, data adapters, memory, LLM.
- Rust Executor: signing, tx build, caps, balance checks, slippage, kill switch, audit log.

Add modules:

- `agent/src/workflows`
- `agent/src/research`
- `agent/src/strategies`
- `agent/src/notifications`
- `agent/src/memory`
- `web` or upgraded `site`

## Solana Infra

Use Helius + direct protocol APIs:

- DAS: token metadata, wallet balances, asset search.
- Enhanced Transactions: parsed history + trade verification.
- Webhooks: wallet activity + workflow triggers.
- Sender + Priority Fee API: landing + fee estimates.
- Standard WebSockets: MVP confirmations.
- Enhanced WebSockets / Laserstream: production low-latency streams.
- Wallet API: portfolio, identity, transfers, funding source.

Adapters required. Missing paid key -> degrade to public RPC/Jupiter/DexScreener.

## Guardrails

- No guaranteed-return claims.
- Dry-run default.
- Live trade needs explicit user action or active Trading Scope.
- Executor re-checks balance, caps, slippage, token safety, venue.
- Every autonomous action gets audit record.
- Untrusted market/news/social text cannot instruct Executor.
- Perps respect venue + jurisdiction restrictions.

## Positioning

Do not sell "Minara cheaper."

Sell:

- Open source.
- Self-hosted.
- Local keys.
- Solana-first speed.
- Rust Executor risk caps.
- Source-backed research.
- Backtested Autopilot.

Canonical positioning doc: [positioning.md](positioning.md).
