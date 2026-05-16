# Architecture Opportunities

Updated: 2026-05-17

## Read

Kuro has good raw parts: Copilot skills, Autopilot loop, Executor, risk caps, Phoenix perps, arb scan.

Main friction: trading concepts leak across small Modules. Callers must know too much: env names, dry-run rules, safety gates, quote source quirks, position file semantics, Executor routes.

## 1. Deepen Trade Intent Module

Files:

- `agent/src/skills/snipe.ts`
- `agent/src/skills/execute_arb.ts`
- `agent/src/skills/phoenix_open_perp.ts`
- `agent/src/data/executor.ts`
- `executor/src/api.rs`
- `executor/src/types.rs`

Problem:

Each caller builds its own trade request shape. Dry Run, Live Trade, Jito, slippage, side, caps, and perps collateral are repeated as local knowledge. Interface is shallow: caller must understand implementation details.

Solution:

Create one Trade Intent Module in agent. Inputs: spot buy/sell, arb leg, perp order. Output: normalized Dry Run or Live Trade request + preview summary. Executor remains final risk gate.

Benefits:

- More locality: trade request rules live once.
- More leverage: Copilot, Workflow, Autopilot, CLI use same Interface.
- Tests can cover Dry Run vs Live Trade once.

## 2. Deepen Research Report Module

Files:

- `agent/src/skills/analyze_token.ts`
- `agent/src/skills/gmgn_signal.ts`
- `agent/src/skills/enrich_wallet.ts`
- `agent/src/skills/phoenix_signal.ts`
- `agent/src/data/*`

Problem:

Skills mix data fetching, scoring, flags, and output formatting. Copilot cannot easily cite source-backed research across token, wallet, and perps. Adding Pro reports will spread logic.

Solution:

Create Research Report Module. It owns source fetch, source labels, freshness, confidence, flags, and report shape. Skills become adapters.

Benefits:

- More locality: signal/flag rules live with source metadata.
- More leverage: CLI, web, agent, monetized reports use same report output.
- Tests can assert report semantics without live provider calls.

## 3. Deepen Strategy Runtime Module

Files:

- `agent/src/autonomous/loop.ts`
- `agent/src/autonomous/policy.ts`
- `agent/src/autonomous/positions.ts`
- `agent/src/watcher/pool_watcher.ts`
- `agent/src/backtest/*`

Problem:

Autopilot is one hard-coded sniper loop. Policy, watcher, entry, exit, persistence, and logging are coupled. Backtest and live loop can drift.

Solution:

Create Strategy Runtime Module. Interface: Strategy + Trading Scope + Market Event -> Decision -> Trade Intent. Live runner and backtest runner use same Strategy Interface.

Benefits:

- More locality: strategy decisions live once.
- More leverage: sniping, smart-money follower, DCA, arb can share runner.
- Tests can run strategy against historical events without Executor.

## 4. Deepen Position Store Module

Files:

- `agent/src/autonomous/positions.ts`
- `agent/src/autonomous/loop.ts`
- `docs/production.md`
- `executor/src/risk.rs`

Problem:

Position state is JSON-file mutation. No order lifecycle, no reconciliation, no partial fill model, no durable audit. Live Hosted Runner needs better semantics.

Solution:

Create Position Store Module with append-only events first, SQLite later. Track intent, dry-run, submitted tx, fill estimate, close, manual override, reconciliation.

Benefits:

- More locality: position lifecycle rules live once.
- More leverage: dashboard, backtest, audit export, Autopilot all read same state.
- Tests can cover restart/reconcile behavior.

## Recommended First Move

Pick **Strategy Runtime Module** first.

Reason:

- It unlocks sniping + arbitrage + Autopilot monetization.
- It stops live runner and backtest from drifting.
- It creates clear seam for Strategy Packs.
- It keeps Executor unchanged.

