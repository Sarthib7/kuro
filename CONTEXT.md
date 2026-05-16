# Kuro Context

Kuro = open, self-hosted trading copilot + guarded strategy runner. Domain language keeps chat, strategy, wallet, execution, and risk separate.

## Language

**Copilot**:
User-directed research + trade preview surface.
_Avoid_: advisor, money manager, signal seller

**Autopilot**:
Preapproved strategy loop that trades only inside explicit scope.
_Avoid_: free-running AI trader, fully autonomous bot

**Executor**:
Local signer + transaction builder + risk gate.
_Avoid_: backend wallet, custody service

**Trading Scope**:
User-approved boundary for market, size, cap, time, venue, and strategy.
_Avoid_: permission, approval, consent

**Dry Run**:
Simulation or preview that does not submit transaction.
_Avoid_: paper trade when no portfolio state changes

**Live Trade**:
Submitted transaction that can move real funds.
_Avoid_: execution when dry-run

**Workflow**:
Trigger, condition, and action graph for trading or notification.
_Avoid_: automation, agent, script

**Strategy**:
Named trading policy with typed params and exits.
_Avoid_: prompt, vibe, idea

**Signal**:
Market, wallet, or onchain fact used by strategy.
_Avoid_: alpha unless source + method known

**Position**:
Tracked exposure created by trade or imported wallet state.
_Avoid_: holding when Kuro cannot track entry/exit

**Risk Cap**:
Hard executor limit on size, daily spend, drawdown, collateral, or venue.
_Avoid_: guideline, preference

**Hot Wallet**:
Funded local wallet used by Executor for signing.
_Avoid_: user account, custody wallet

**Sniper**:
Low-latency strategy for fresh pools and launch events.
_Avoid_: generic trading bot

**Perps Copilot**:
Perpetual-market research + preview surface.
_Avoid_: leveraged advisor

**Managed Runner**:
Hosted Kuro process operated for one user wallet with user-owned scope and caps.
_Avoid_: managed account, pooled fund

**Strategy Pack**:
Paid set of strategy templates, tests, defaults, and docs.
_Avoid_: paid alpha, guaranteed signal

**Pro Data Adapter**:
Paid integration for faster, deeper, or higher-quota market/onchain data.
_Avoid_: secret signal

## Relationships

- **Copilot** proposes; **Executor** enforces.
- **Autopilot** runs one or more **Strategies** inside one **Trading Scope**.
- **Workflow** may call **Strategy**, notify user, create **Dry Run**, or request **Live Trade**.
- **Live Trade** must pass **Risk Cap** checks inside **Executor**.
- **Hot Wallet** belongs to **Executor**, not **Copilot**.
- **Signal** can influence **Strategy**, but cannot bypass **Risk Cap**.
- **Position** must reconcile with wallet state after restart or manual user action.
- **Managed Runner** may host **Autopilot**, but **Trading Scope** and **Risk Cap** remain user-owned.
- **Strategy Pack** configures **Strategy**; it does not promise profit.

## Example Dialogue

> **Dev:** "Can Copilot buy SOL after user asks?"
> **Domain expert:** "Copilot can prepare Dry Run. Live Trade needs explicit user action or active Trading Scope. Executor still checks Risk Caps."

## Flagged Ambiguities

- "Autonomous" means **Autopilot** with scoped authority, not unlimited AI control.
- "AI CFO" is marketing; product term is **Copilot** or **Autopilot**.
- "Trade" must be split into **Dry Run** vs **Live Trade**.
- "Monetization" means software/infrastructure revenue, not profit-share or managed trading.
