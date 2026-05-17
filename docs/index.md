# Kuro Docs Index

Updated: 2026-05-17

## Start Here

- [Positioning](positioning.md): wedge, ICP, copy.
- [Monetization](monetization.md): free/pro tiers, fees, hosted runner.
- [Roadmap](kuro-minara-roadmap.md): product phases.
- [Brain Speed Roadmap](brain-speed-roadmap.md): 1-week impl plan for 3-tier cache.
- [Key Management](key-management.md): env vars, secrets, provider keys.
- [Architecture Opportunities](architecture-opportunities.md): deepening plan.
- [Live API](live-api.md): Railway Executor API.
- [Production](production.md): deploy + live gates.

## Research

- [Minara Research](minara-research.md): Minara breakdown.
- [Minara Landscape](minara-landscape.html): competitor matrix.

## Decisions

- [ADR Index](adr/README.md)

Accepted:

- Sniper + Arbitrage = Strategies under one Autopilot.
- Trading Scope owns size.
- Position Mode defaults single Position per market per Strategy.
- Blocked Decision = audit + alert, no implicit retry.
- Strategy Packs ship defaults; live needs activated Trading Scope.
- Free Copilot = normal-user tier.
- Pro = skills/use-case packs.
- Phoenix Perps = core Pro use case.
- Hosted Runner = per-user Hot Wallet + Funding Address / QR.
- Withdrawal = P0, defaults to Login Wallet.
- Wallet-login only. No KYC by default.
- Execution Fee = visible, protocol-supported.
- Brain decisions use 3-tier cache (L1 Map + L2 Hamming + L3 LLM); default LLM Cerebras-hosted.

