# Kuro Monetization

Updated: 2026-05-17

## Principle

Monetize tooling, infra, support, and workflow quality.

Do not monetize user PnL.
Do not pool funds.
Do not custody funds.
Do not market guaranteed returns.
Do respect privacy-first DeFi access. No KYC by default.

CFTC warns AI trading bot / crypto-asset schemes promising high or guaranteed returns are fraud pattern. SEC / FINRA / NASAA warn AI investment claims are fraud vector.

Sources:

- https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html
- https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/artificial-intelligence-fraud

## Best Business Model

Open-core + hosted Pro.

Free:

- Normal-user Copilot.
- Basic token analysis.
- Basic wallet/status view.
- Dry-run swaps.
- Docs.
- Hosted manual live trade may charge Execution Fee.
- No hosted Autopilot.
- No hosted Sniper.
- No hosted Arbitrage Scanner.
- No advanced skills/use-case packs.

Pro:

- Web console.
- Strategy Pack.
- Skill/use-case packs.
- Workflow builder.
- Telegram/Discord alerts.
- Better backtest reports.
- Wallet watchlists.
- Arbitrage scanner.
- Sniper dashboard.
- Audit logs.
- Multi-RPC / Helius / Jito config helpers.
- Hosted Autopilot.
- Hosted Sniper.

Core Pro packs:

- Sniper Pack.
- Arbitrage Scanner Pack.
- Phoenix Perps Pack.
- Wallet Watch Pack.
- TP/SL Pack.
- Telegram Alerts.

Advanced add-ons later:

- Low-Latency Sniper Pack.
- Direct DEX Arb Pack.
- Team Watchlists.
- Custom Strategy Pack.

Hosted Pro:

- Managed Runner per user.
- Private service network.
- User-owned hot wallet.
- User-set Trading Scope.
- Per-user caps.
- Monitoring + alerts.
- Managed updates.
- No custody beyond user-funded runner wallet.

Infra packaging:

- Pro Local: user supplies keys.
- Hosted Runner Basic: user supplies keys by default.
- Low-Latency Pro: Kuro-managed infra bundle.
- Enterprise: dedicated infra + support.

Enterprise / Team:

- Private deploy.
- Custom strategy templates.
- SLA.
- Dedicated low-latency infra.
- Custom data adapters.
- Compliance/audit export.

Privacy posture:

- Self-hosted: no KYC.
- Pro Local: no KYC.
- Hosted Runner: no KYC by default.
- Collect only account/payment data required to operate product.
- Respect venue/legal restrictions, especially perps.

Account posture:

- Wallet-login only.
- Login Wallet signs auth challenge.
- Hosted Runner creates separate Hot Wallet.
- Email not required for product use.
- Optional contacts can come later for alerts/billing, but not as identity anchor.
- Withdrawal defaults to Login Wallet.
- Custom withdrawal address requires confirmation.

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

Execution Fee policy:

- Free tier may charge explicit per-trade Execution Fee.
- Paid plans may waive or reduce Execution Fee as perk.
- Hosted Runner uses subscription first; Execution Fee optional.
- Every Execution Fee must show before Live Trade.
- No hidden spread.
- Fee collection must use protocol-supported fee route.
- If route cannot show/support fee cleanly, charge zero or block fee route.

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
- Skill/use-case packs.
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

- OSS: local pool watcher + manual dry-run.
- Free hosted: no Sniper.
- Pro: hosted Sniper, multi-watchlist, smart-money scoring, strategy templates, alerts, backtest reports.
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
- One Funding Address / QR.
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

Hosted onboarding:

1. Kuro creates isolated runner.
2. Runner creates Hot Wallet.
3. UI shows Funding Address + QR.
4. User funds only max acceptable loss.
5. User selects Strategy Pack.
6. User activates Trading Scope.
7. Executor trades only inside caps.

Withdrawal is P0:

- User can withdraw anytime.
- UI shows balance, Funding Address, QR, and withdraw action.
- Withdrawal pauses affected Autopilot runs first.
- Withdrawal bypasses Strategy logic.

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
