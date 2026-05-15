# Autonomous mode

> Fund-moving if `KURO_AUTONOMOUS_LIVE=true`. Otherwise read-only (dry-run end-to-end).

## What it does

`kuro autonomous` starts a long-running process that:

1. Subscribes via WebSocket `logsSubscribe` to Pump.fun, PumpSwap, Raydium AMM v4, Raydium CPMM, and Meteora DLMM program logs.
2. When a new-pool / launch signature shows up, fetches the tx and extracts the new mint from the post-token-balances delta.
3. Calls `analyze_token` and, if GMGN reachable, folds in smart-money signals.
4. Runs `policy.decide()` against the analysis. Pass-gates: freeze authority renounced, no honeypot, top-10 concentration ≤ `KURO_MAX_TOP10_PCT`, round-trip loss ≤ `KURO_MAX_ROUND_TRIP_LOSS_PCT`, no GMGN honeypot flag.
5. If the policy says snipe, calls the snipe skill → Rust executor → Jupiter swap → Jito bundle. Defaults to `dry_run=true` unless `KURO_AUTONOMOUS_LIVE=true`.
6. Persists the position to `executor/positions.json` (entry signature, sol_in, estimated out).
7. Every 15s, quotes each open position back to SOL and exits on `take_profit_pct`, `stop_loss_pct`, or `max_hold_seconds` whichever hits first.

## Command

```
kuro autonomous
```

Current entrypoint: `cd agent && npm run autonomous`. Ctrl-C to stop.

## Pre-flight checklist (the host agent should run before invoking)

1. **Check `kuro status`** — executor must be reachable on `KURO_EXECUTOR_URL` (default `http://127.0.0.1:7777`). If not, instruct the user to start the executor: `cd executor && cargo run --release`.
2. **Verify `KURO_AUTONOMOUS_LIVE`** — read from `.env`. If `false` (default), confirm with the user "running in dry-run mode; no real trades will execute". If `true`, this is a fund-moving operation — apply the **Autonomous live confirmation** flow below.
3. **Verify hot-wallet balance** — `balance_sol` from status. If below `KURO_DAILY_CAP_SOL + Jito tip headroom`, warn the user.

## Autonomous live confirmation (CRITICAL)

When `KURO_AUTONOMOUS_LIVE=true`, this is the most dangerous command kuro offers — it sniped real money based on policy decisions, unattended. Before starting:

1. Present the user a summary of the policy in plain language:
   - "Will snipe up to `KURO_SNIPE_SOL` SOL on each new pool"
   - "Capped at `KURO_MAX_TRADE_SOL` per trade and `KURO_DAILY_CAP_SOL` per day by the Rust executor"
   - "Drawdown kill-switch trips at `KURO_DRAWDOWN_KILL_PCT`"
   - "Exits on +`KURO_TAKE_PROFIT_PCT` / -`KURO_STOP_LOSS_PCT` / after `KURO_MAX_HOLD_SECONDS` seconds"
2. Ask user to confirm with structured choices: A) Start live / B) Switch to dry-run / C) Cancel.
3. Only on A do you run `kuro autonomous`.

## Stopping safely

Ctrl-C is the only stop mechanism right now. Open positions remain in `executor/positions.json` and will be exited by the next run when it boots. **Do not delete `executor/state.json` or `executor/positions.json` — that loses the daily-cap counter and the position list.**

## Observability

- `kuro positions` — JSON of open + closed positions
- `kuro status` — wallet balance, today's spent SOL, caps, drawdown lock state
- The autonomous process emits JSON-Lines on stdout: `{event: "candidate" | "snipe_result" | "exit_result", ...}`. Tail it.

## Known limitations

- WS `logsSubscribe` filters on program ID; for Pump.fun firehose volume this is fine but for absolute lowest latency, upgrade to Yellowstone Geyser (Helius dedicated plan).
- No multi-position correlation control — if 5 pump.fun memes spike together, all 5 may get sniped. Watch your daily cap.
- Exit logic is fixed-bucket (TP / SL / max-hold). No trailing stops yet.
- Sequential leg execution in `find_arb` / `execute_arb` is unsafe for competitive arb (front-running risk). It's only intended for slow / illiquid pairs.
