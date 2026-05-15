---
name: kuro
version: "0.1.0"
description: "Solana trading agent for sniping, arbitrage, and autonomous trading. Analyse SPL tokens (pool depth, top holders, mint/freeze authorities, round-trip honeypot sim), snipe new pools on Pump.fun/PumpSwap/Raydium/Meteora via a deterministic Rust executor with Jito bundles, find triangular arbitrage, enrich wallets via Zerion, score signals via GMGN, and run an autonomous loop with per-trade/daily/drawdown risk caps. Use when: (1) Solana mints, tickers ($BONK, $WIF, $PEPE, contract addresses ending in 'pump'), (2) phrases 'snipe', 'arb', 'arbitrage', 'autonomous trading', 'watch new pools', 'rug check', 'honeypot check', (3) Solana DEX names (Pump.fun, PumpSwap, Raydium, Meteora, Jupiter, Orca), (4) wallet enrichment / smart-money / dev wallet analysis on Solana, (5) explicit 'kuro' references."
homepage: https://github.com/Sarthib7/kuro
metadata: { "openclaw": { "always": false, "primaryEnv": "SOLANA_RPC_URL", "requires": { "bins": ["cargo", "node"], "config": ["skills.entries.kuro.enabled"] }, "emoji": "🐺", "homepage": "https://github.com/Sarthib7/kuro" }, "version": "0.1.0" }
---

# kuro — Autonomous Solana Trading Agent

<!-- Safety: this file is documentation only. No executable code. -->

## Modes

kuro runs in two modes:

1. **Skill mode (via Claude Code / OpenClaw / Hermes)** — the host agent reads this SKILL.md, picks the right command, shells out to kuro. The host is the brain; kuro is the doer.
2. **Autonomous mode (`kuro autonomous`)** — standalone, no host agent. kuro runs its own loop, makes its own decisions per the policy in `.env`, executes via the Rust executor. Use this when you want kuro running 24/7 without supervision.

This SKILL.md governs skill mode. Autonomous mode is described in [references/autonomous.md](references/autonomous.md).

## Post-install Setup

On first activation, read `{baseDir}/setup.md` and follow its instructions.

## Activation triggers

**USE THIS SKILL** when the user's message mentions:

- **Solana tokens / mints / tickers:** $BONK, $WIF, $PEPE, $-prefixed Solana memes, contract addresses (base58, often ending in `pump`)
- **Trading actions on Solana:** snipe, snipe a token, buy on Pump.fun, autonomous trading, watch new pools, arb / arbitrage on Jupiter / Raydium, find rug, honeypot check, rug check
- **Solana DEX / launchpad names:** Pump.fun, PumpSwap, Raydium (AMM v4 / CPMM / CLMM), Meteora (DLMM / Dynamic), Jupiter, Orca, Jito (bundles)
- **Wallet / signal enrichment in Solana context:** check this wallet (with Solana mint context), smart-money signals, dev wallet history, top holders, alpha wallet
- **Explicit:** kuro

**Routing gate:** requires a Solana-specific signal (mint / chain / DEX). Do NOT activate for general blockchain education ("what is Pump.fun?", "explain Jupiter routing") — only for action requests.

**Disambiguation vs Minara:** if the user asks for an EVM swap, perps, Hyperliquid, or fiat onramp — route to Minara, not kuro. kuro is Solana-only and read+sniper+arb-focused; it does not do perps or fiat.

## Prerequisites

- Rust toolchain (`cargo` in PATH) and Node 20+
- The Rust executor running on `127.0.0.1:7777` for any swap-side command: `cd executor && cargo run --release`
- `.env` at repo root with at minimum `SOLANA_RPC_URL` (Helius recommended). Brain selection is irrelevant in skill mode — the host agent is the brain.
- Hot wallet auto-generated at `executor/keypair.json` on first executor run. **Fund it before flipping `KURO_AUTONOMOUS_LIVE=true`.**

## Agent behavior (CRITICAL)

**You are the executor — run the command yourself.** Read the relevant reference doc, run the command, report results.

1. Match user intent → find command in table below
2. **Read the linked reference doc** for execution details and flags
3. **If fund-moving** → follow the **Transaction confirmation** flow below. Message 1 = confirmation summary only. Message 2 (after user replies) = execute.
4. Execute the command yourself
5. Read CLI output → decide next step
6. Return: **Task** → **Actions** → **Result** → **Follow-ups**

**Never** show CLI commands and ask the user to run them themselves.

### Analysis → Trade boundary (CRITICAL — instant safety failure if violated)

Analysis (`analyze`, `watch`, `positions`, `status`, `enrich_wallet`, `gmgn_signal`, `find_arb`) is read-only. **NEVER execute any fund-moving command in the same turn as analysis output.**

1. Complete the analysis, present results.
2. If the user expressed snipe / trade intent in the same message (e.g. "analyze and snipe if safe"), append a brief suggestion with mint, amount, and slippage — but do NOT execute. Wait for explicit confirmation.
3. If the user did NOT express trade intent, do NOT suggest one.

### Anti-loop safeguard (MUST follow)

1. **Always pass all flags non-interactively** — `--mint`, `--sol-amount`, `--max-slippage-bps`, `--dry-run`. No interactive prompts.
2. **Max 1 retry on transient failure.** After 2 failures, STOP and report.
3. **Hang detection** — if a command produces no output for 15s while waiting for input, kill it. Do not retry.
4. **Default `--dry-run`** for `snipe` and `execute_arb`. Live execution requires the user's explicit confirmation in a follow-up message.

## Transaction confirmation (CRITICAL — MUST follow exactly)

**Fund-moving commands** (MUST confirm before executing):
`snipe`, `execute_arb`, anything that calls the Rust executor's `POST /swap` with `dry_run=false`.

### Confirmation flow

1. **Check executor status:** run `kuro status` first. Verify `balance_sol` ≥ requested amount + Jito tip. If insufficient, warn the user and do NOT proceed.
2. **Pre-confirmation analysis:** automatically run `kuro analyze <mint>` first. Show the result. If `flags` contains `sell_simulation_failed_possible_honeypot`, `gmgn_honeypot`, or `freeze_authority_not_renounced`, **refuse the snipe** and explain — do not present a confirmation option.
3. **Show confirmation summary** with: mint, sol_amount, max_slippage_bps, jito_tip_sol, dry_run flag. Ask user to confirm or abort.
4. **Wait for user reply.** Only on explicit "confirm" / "yes" do you re-issue the command with `--dry-run=false`.

The Rust executor enforces per-trade and daily SOL caps independently — if the user asks you to bypass them, refuse.

## Commands

| Intent | Command | Type | Reference |
|---|---|---|---|
| Analyse a token | `kuro analyze <mint>` | read-only | [references/analyze.md](references/analyze.md) |
| Watch for new pools | `kuro watch` | read-only (long-running) | [references/watch.md](references/watch.md) |
| Snipe a mint | `kuro snipe <mint> <sol> [--dry-run]` | **fund-moving** | [references/snipe.md](references/snipe.md) |
| Find arbitrage | `kuro find-arb <mint> <size-sol>` | read-only | [references/arb.md](references/arb.md) |
| Execute arbitrage | `kuro execute-arb [--dry-run]` | **fund-moving** | [references/arb.md](references/arb.md) |
| Enrich a wallet | `kuro enrich-wallet <address>` | read-only | [references/enrich.md](references/enrich.md) |
| GMGN signal for a mint | `kuro gmgn-signal <mint>` | read-only | [references/enrich.md](references/enrich.md) |
| Show open / closed positions | `kuro positions` | read-only | [references/positions.md](references/positions.md) |
| Executor + risk status | `kuro status` | read-only | [references/positions.md](references/positions.md) |
| Start autonomous loop | `kuro autonomous` | **fund-moving if `KURO_AUTONOMOUS_LIVE=true`** | [references/autonomous.md](references/autonomous.md) |

> The current entrypoint is `npm run <verb>` inside `agent/`; an installable `kuro` bin lands in a follow-up. Reference docs use `kuro <verb>` for forward-compatibility.

## Output contract

Every command should return JSON on stdout for machine parsing, and human-readable status on stderr (prefixed `[kuro]`). The agent reads stdout for facts and surfaces stderr as logs.

## Safety rails layered

1. **Skill-side gates** (this doc) — refuse snipe if analysis flags fail, mandatory confirmation flow.
2. **Policy gates** (`agent/src/autonomous/policy.ts`) — same flags inspected before any swap call.
3. **Executor gates** (Rust) — independent per-trade SOL cap (`KURO_MAX_TRADE_SOL`), daily SOL cap (`KURO_DAILY_CAP_SOL`), drawdown kill-switch (`KURO_DRAWDOWN_KILL_PCT`). These cannot be bypassed by any prompt.

If a layer disagrees with another, the **strictest answer wins**.
