# Kuro Monetization

Updated: 2026-05-17

## Principle

Monetize tooling, infra, support, and workflow quality.

Do not monetize user PnL.
Do not pool funds.
Do not custody funds.
Do not market guaranteed returns.

CFTC warns AI trading bot / crypto-asset schemes promising high or guaranteed returns are fraud pattern. SEC / FINRA / NASAA warn AI investment claims are fraud vector.

Sources:

- https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html
- https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/artificial-intelligence-fraud

## Best Business Model

Open-core + hosted Pro.

Free:

- CLI.
- Local Executor.
- Basic token analysis.
- Dry-run swaps.
- Basic watcher.
- Basic backtest.
- Docs.

Pro:

- Web console.
- Strategy Pack.
- Workflow builder.
- Telegram/Discord alerts.
- Better backtest reports.
- Wallet watchlists.
- Arbitrage scanner.
- Sniper dashboard.
- Audit logs.
- Multi-RPC / Helius / Jito config helpers.

Hosted Pro:

- Managed Runner per user.
- Private service network.
- User-owned hot wallet.
- User-set Trading Scope.
- Per-user caps.
- Monitoring + alerts.
- Managed updates.
- No custody beyond user-funded runner wallet.

Enterprise / Team:

- Private deploy.
- Custom strategy templates.
- SLA.
- Dedicated low-latency infra.
- Custom data adapters.
- Compliance/audit export.

## Pricing Sketch

Keep simple early:

| Plan | Price | Buyer | Includes |
|---|---:|---|---|
| OSS | Free | builders | CLI, local Executor, basic skills |
| Pro Local | $29-99/mo | power users | web console, workflows, strategy packs, reports |
| Hosted Runner | $149-499/mo | active traders | managed deployment, alerts, updates, monitoring |
| Low-Latency Pro | $500-2k/mo | serious operators | dedicated RPC/stream config, Jito tuning, faster watcher |
| Team/Enterprise | Custom | desks/builders | private deploy, support, custom adapters |

Do not take performance fee early. Creates legal/compliance load. Also hard to attribute returns.

## What To Sell First

Sell **Kuro Pro Local** first.

Reason:

- Lowest legal/compliance surface.
- No custody.
- Easy delivery.
- Good for builders/power users.
- Can ship before full hosted infra.

Paid unlock:

- `web` dashboard.
- Strategy Pack.
- Workflow templates.
- Backtest report export.
- Telegram alerts.
- Pro config wizard.

License:

- Keep Executor OSS.
- Keep core CLI OSS.
- Make web dashboard + strategy packs source-available or commercial.

## Sniping Product

Position as:

> Scoped Solana sniper with dry-run research and executor-enforced caps.

Do not position as:

> Bot that wins launches.

Features worth charging:

- New-pool stream.
- Mint/freeze authority checks.
- Holder concentration.
- Liquidity/depth checks.
- Honeypot round-trip sim.
- Bundle/creator risk.
- Smart-money boost.
- Jito tip presets.
- Max slippage.
- Max hold.
- TP/SL.
- Kill switch.
- Replay/backtest.
- Dry-run evidence log.

Packaging:

- OSS: one pool watcher + manual dry-run.
- Pro: multi-watchlist, smart-money scoring, strategy templates, alerts, backtest reports.
- Hosted: 24/7 runner + monitoring.

## Arbitrage Product

Position as:

> Scanner and executor for user-approved Solana route opportunities.

Do not overpromise.

Arb is hard:

- Edge decays fast.
- Quotes lie under latency.
- Priority fees eat margin.
- Failed txs cost time/fees.
- MEV competition.
- Private liquidity/routing matters.

Start with:

- Jupiter route scan.
- SOL -> token -> USDC -> SOL triangles.
- Min edge bps.
- Max slippage bps.
- Fee-aware net edge.
- Dry-run simulate.
- Sequential execution only.
- Audit result.

Later:

- Parallel route scan.
- Multi-RPC send race.
- Helius Sender + Priority Fee API.
- Jito bundles.
- Direct DEX adapters.
- Inventory-aware arb.
- Cross-venue arb if custody/compliance solved.

Monetize arb as tool, not profit:

- Scanner subscription.
- Hosted low-latency runner.
- Private strategy templates.
- Infrastructure setup/support.

## Hosted Runner Rules

Hosted Runner must be per-user isolated:

- One user.
- One hot wallet.
- One Trading Scope.
- No pooled funds.
- No shared strategy wallet.
- No discretionary human trading.
- No Kuro-held custody.
- Clear max loss possible: hot wallet balance.

Minimum controls:

- Per-trade cap.
- Daily cap.
- Drawdown lock.
- Slippage cap.
- Venue allowlist.
- Kill switch.
- Audit log.
- Dry-run mode.
- User-owned secrets or isolated secrets store.

## Revenue Roadmap

### Phase 1: Sell Pro Local

Build:

- Web console.
- License check.
- Strategy Pack loader.
- Telegram alerts.
- Backtest reports.

Charge: $49/mo founder plan.

### Phase 2: Sell Hosted Runner

Build:

- Railway/Fly deploy automation.
- Per-user env.
- Health monitor.
- Alerting.
- Upgrade path.

Charge: $199/mo plus user pays infra/API keys.

### Phase 3: Sell Low-Latency Tier

Build:

- Enhanced WebSockets / Laserstream setup.
- Multi-RPC.
- Helius Sender.
- Priority fee optimizer.
- Jito tuning.

Charge: $500+/mo.

### Phase 4: Sell Team Deploys

Build:

- Private dashboard.
- Multi-wallet watch.
- Exportable audit logs.
- Custom adapters.

Charge: custom.

## Landing Copy

Headline:

> Local-key trading copilot for Solana sniping and arb.

Subhead:

> Research mints, watch wallets, scan routes, dry-run trades, and run scoped strategies with a Rust Executor that caps risk outside the LLM.

CTA:

> Start Dry-Run

Proof:

- Open Executor.
- Dry-run default.
- Local hot wallet.
- Jito + Jupiter path.
- Risk caps in Rust.

## Build Next

To monetize fastest:

1. Build `web` dashboard.
2. Add license-gated Pro features.
3. Add strategy pack format.
4. Add Telegram alerts.
5. Harden backtest report.
6. Ship founder plan.

Avoid building marketplace first. Too early.

## Phoenix Starting Point

Phoenix gives Kuro paid Pro surface for perps research before live execution.

Use first:

- `/exchange/markets`: market list.
- `/exchange/market/{symbol}`: fees, funding, risk metadata.
- `/candles`: signal bundle.
- `/trader/{authority}/state`: collateral, positions, risk.
- `/trader/{authority}/trades-history`: audit/trade history.
- `/v1/ix/place-isolated-market-order-enhanced`: dry-run tx build + liquidation estimate.

Kuro command path:

- `phoenix-markets`: list/read market metadata.
- `phoenix-signal`: read candles + trend/RSI/volatility.
- `phoenix-trader`: read wallet state.
- `phoenix-open`: guarded dry-run/live isolated order via Executor.

Commercial angle:

- Free: read-only Phoenix market metadata.
- Pro: signal bundle, perps dashboard, alerts, backtest reports.
- Hosted Runner: scoped perps Autopilot after jurisdiction/access checks.
