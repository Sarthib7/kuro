# Minara Research Brief

Researched: 2026-05-17

## Read

Minara = consumer AI financial OS. Not chatbot. Stack:

- Chat over crypto, stocks, RWA, DeFi, NFTs, prediction markets, news, social, macro.
- Intent -> trade preview/execution for spot + perps.
- Autopilot strategies with user-set scope.
- Workflow builder from prompts.
- Smart-wallet execution layer.
- API + x402 + Gen-0 agent ecosystem.

Kuro lesson: copy shape, not custody model. One chat surface. Many tools. Visible reasoning. Explicit scopes. Executor risk caps outside LLM.

## Minara Modules

### Trading Copilot

Perps assistant. User picks market, style, strategy. Minara returns side, entry, TP, SL, risk/reward, reasoning, prefilled order.

Signals used:

- Multi-timeframe candles.
- EMA, RSI, MACD.
- Order book depth, bid/ask imbalance.
- Funding, open interest, volatility.
- Risk/reward filter.

Venue: Hyperliquid perps.

Source: https://minara.ai/docs/features/trading-copilot

### Trading Autopilot

Autopilot = predefined strategy loop, not random LLM trading.

Rules:

- User allocates funds.
- User selects strategy.
- AI stays inside strategy.
- TP/SL + risk controls are programmatic.
- User can override.
- Autopilot stops on drawdown / low equity.

Strategies named by Minara: Sharpe Guard, Supertrend Monitor, Futures Grid. Strategy Studio planned.

Source: https://minara.ai/docs/features/trading-autopilot

### Vibe Trading

Natural language -> executable financial flow. Covers crypto, tokenized stocks, RWA, NFTs, DeFi, stablecoin-funded actions.

Source: https://minara.ai/docs/features/vibe-trading

### Agentic Workflow

Prompt -> n8n-like graph.

Nodes:

- Triggers: price, wallet activity, Polymarket odds, schedule.
- Conditions: if/else.
- Actions: email, Telegram, market order, stop-market order, AI query, code.

Examples:

- Buy ETH if ETH <= 4000 USDT.
- Buy SOL at 175, TP 200, SL 160.
- Copy wallet buys/sells with $50 each.

Sources:

- https://minara.ai/docs/features/agentic-workflow
- https://minara.ai/docs/help-center/readme/core-concepts/agentic-workflow/set-up-automated-trading
- https://minara.ai/docs/help-center/readme/core-concepts/agentic-workflow/copy-trade-on-minara

### Data Stack

Minara claims 50+ data providers. Named:

- Arkham.
- RPC providers.
- Listing/delisting feeds.
- CoinMarketCap / CoinGecko.
- CoinGlass.
- DeFiLlama.
- Glassnode.
- NFTGo.
- Virtuals, Pump.fun, Bonk.fun.
- RootData.
- Social + news.
- Polymarket.
- GoPlus.
- xStocks.
- OpenAI / Grok search.
- FMP equities.

Source: https://minara.ai/docs/technology/tools-integration

### Wallet + Execution

Minara docs describe Funding Wallet + Controller Wallet. Controller uses sharding, multisig, TEE-style controls.

Kuro should diverge: local hot wallet, self-hosted executor, hard risk caps, auditable code.

Source: https://minara.ai/docs/technology/wallet-security

### Agent API

Endpoints:

- Chat.
- Natural-language swap tx generation.
- Perp suggestion.
- Prediction market analysis.

Access: API key + x402. Gen-0 = ownable / monetizable agent endpoints.

Sources:

- https://minara.ai/docs/ecosystem/agent-api/api-reference/api-reference-api-key
- https://minara.ai/docs/ecosystem/gen-zero

### Mobile + Pricing

App Store positions Minara as Personal AI CFO. Subscriptions listed:

- Lite Monthly: $18.99.
- Starter Monthly: $48.99.
- Lite Yearly: $191.99.
- Starter Yearly: $479.99.

Source: https://apps.apple.com/us/app/minara-ai/id6754446850

## Risk Notes

Minara Terms: AI output informational, not investment advice. Autopilot can execute after explicit activation + scoped auth.

Hyperliquid restriction: US persons + Ontario, Canada persons cannot use Hyperliquid-routed features.

Source: https://minara.ai/doc/terms-of-use.pdf

SlowMist audit found:

- Incomplete tx detail display.
- Excessive default slippage.
- Missing API balance checks.
- Missing anti-phishing strategy.
- Missing AML strategy.

Source: https://static.minara.ai/audit/Minara%20AI%20-%20SlowMist%20Audit%20Report.pdf

CFTC warns AI trading bot claims are common fraud vector. Kuro docs must avoid guaranteed-return language.

Source: https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/AITradingBots.html

## Kuro Takeaways

- Build OS, not bot.
- Ship research before live execution.
- Default every trade to dry-run.
- Make Autopilot scoped, typed, reversible.
- Keep LLM out of hot path.
- Executor owns signing, caps, slippage, balance, kill switch.
- Kuro moat: open source, local keys, Solana speed, audit logs.

