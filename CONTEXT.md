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

**Position Mode**:
Trading Scope rule that defines whether a Strategy may hold one Position or scale into multiple entries for same market.
_Avoid_: duplicate handling

**Risk Cap**:
Hard executor limit on size, daily spend, drawdown, collateral, or venue.
_Avoid_: guideline, preference

**Blocked Decision**:
Trade Intent rejected by Executor or policy before funds move.
_Avoid_: failed trade

**Retry Policy**:
Trading Scope rule that permits bounded retry after a Blocked Decision or failed submission.
_Avoid_: keep trying

**Hot Wallet**:
Funded local wallet used by Executor for signing.
_Avoid_: user account, custody wallet

**Funding Address**:
Public address of a per-user Hot Wallet shown for deposits.
_Avoid_: deposit account, custody account

**Login Wallet**:
Wallet used only for authentication and account ownership.
_Avoid_: trading wallet

**Withdrawal**:
User-directed transfer from Hot Wallet back to user-selected address.
_Avoid_: strategy exit, payout

**Sniper**:
Low-latency strategy for fresh pools and launch events.
_Avoid_: generic trading bot

**Arbitrage Strategy**:
Strategy that seeks price mismatch across routes or venues, then emits a fee-aware Trade Intent.
_Avoid_: guaranteed arb bot, risk-free profit

**Arbitrage Scanner**:
Dry Run first route search that estimates edge without claiming executable profit.
_Avoid_: profit engine

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

**Infra Plan**:
Commercial packaging of RPC, stream, routing, alerting, and support responsibilities.
_Avoid_: backend tier

**Execution Fee**:
Explicit per-trade fee charged by Kuro for routing or hosted execution.
_Avoid_: hidden spread

**Privacy-First Access**:
Product posture that minimizes identity collection and does not require KYC by default.
_Avoid_: anonymous managed account

**Manual Trade**:
User-confirmed Live Trade created from Copilot preview outside Autopilot.
_Avoid_: strategy trade

## Relationships

- **Copilot** proposes; **Executor** enforces.
- **Manual Trade** is user-confirmed and outside **Autopilot**.
- **Autopilot** runs one or more **Strategies** inside one **Trading Scope**.
- **Sniper** and **Arbitrage Strategy** are both **Strategies** under **Autopilot**.
- **Arbitrage Scanner** may use aggregated quotes; production **Arbitrage Strategy** needs direct venue adapters.
- **Strategy** may recommend action, but **Trading Scope** owns size.
- **Workflow** may call **Strategy**, notify user, create **Dry Run**, or request **Live Trade**.
- **Live Trade** must pass **Risk Cap** checks inside **Executor**.
- **Blocked Decision** is audited and alerted; retry requires explicit **Retry Policy**.
- **Hot Wallet** belongs to **Executor**, not **Copilot**.
- **Funding Address** funds exactly one per-user **Hot Wallet**; it is never pooled.
- **Login Wallet** authenticates user; **Hot Wallet** executes trades.
- **Withdrawal** bypasses **Strategy** and pauses affected **Autopilot** runs first.
- **Withdrawal** defaults to **Login Wallet**; custom destination requires confirmation.
- **Signal** can influence **Strategy**, but cannot bypass **Risk Cap**.
- **Position** must reconcile with wallet state after restart or manual user action.
- **Position Mode** defaults to one open **Position** per market per **Strategy**, unless **Trading Scope** explicitly allows scaling.
- **Managed Runner** may host **Autopilot**, but **Trading Scope** and **Risk Cap** remain user-owned.
- **Strategy Pack** configures **Strategy**; it does not promise profit.
- **Strategy Pack** may include conservative defaults, but **Live Trade** requires activated **Trading Scope**.
- **Infra Plan** decides whether user supplies provider keys or Kuro manages infra.
- **Execution Fee** must be shown before **Live Trade** and may be waived or reduced by paid plan.
- **Execution Fee** must use protocol-supported fee route, not hidden transfer.
- **Privacy-First Access** applies by default; venue/legal restrictions still apply.

## Example Dialogue

> **Dev:** "Can Copilot buy SOL after user asks?"
> **Domain expert:** "Copilot can prepare Dry Run. Live Trade needs explicit user action or active Trading Scope. Executor still checks Risk Caps."

## Flagged Ambiguities

- "Autonomous" means **Autopilot** with scoped authority, not unlimited AI control.
- "AI CFO" is marketing; product term is **Copilot** or **Autopilot**.
- "Trade" must be split into **Dry Run** vs **Live Trade**.
- "Monetization" means software/infrastructure revenue, not profit-share or managed trading.
- "Multiple entries" must be modeled by **Position Mode**, not accidental duplicate buys.
