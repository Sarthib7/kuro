# Live Executor API

Current live URL:

```bash
https://kuro-production-281c.up.railway.app
```

This is Executor API, not web UI.

## Current Status

Checked: 2026-05-17

```json
{
  "wallet": "6HMA3pGo33fF93EpdSRxx3V8e9p13qYGcFk8LJpgmAhT",
  "balance_sol": 0.0,
  "max_trade_sol": 0.1,
  "daily_cap_sol": 1.0,
  "drawdown_locked": false,
  "phoenix_live_enabled": false
}
```

## Critical Security

Do not fund the wallet unless protected routes require auth.

Set:

```bash
KURO_EXECUTOR_API_KEY=strong-random-secret
```

Then call protected routes with:

```bash
-H "Authorization: Bearer $KURO_EXECUTOR_API_KEY"
```

Protected routes:

- `/status`
- `/quote`
- `/swap`
- `/phoenix/isolated_market_order`
- `/risk/reset_daily`

Public route:

- `/healthz`

Current Railway production has `KURO_EXECUTOR_API_KEY` set. Unauthenticated
calls to `/status` should return `401`.

## Browser UI

The minimal console in `site/` is a static app. Host it separately on Vercel or
Cloudflare Pages, then set the executor's CORS allowlist:

```bash
KURO_ALLOWED_ORIGINS=https://YOUR-KURO-UI.vercel.app,https://YOUR-KURO-UI.pages.dev
```

The UI stores two values only in the local browser:

- Executor URL: `https://kuro-production-281c.up.railway.app`
- Executor key: `KURO_EXECUTOR_API_KEY`

The UI is not a wallet and does not custody funds. It calls the protected
executor routes with a bearer token.

## Health

```bash
curl https://kuro-production-281c.up.railway.app/healthz
```

Expected:

```json
{"ok":true}
```

## Status

```bash
curl https://kuro-production-281c.up.railway.app/status
```

With auth:

```bash
curl https://kuro-production-281c.up.railway.app/status \
  -H "Authorization: Bearer $KURO_EXECUTOR_API_KEY"
```

## Quote

SOL -> USDC quote for `0.001 SOL`:

```bash
curl -X POST https://kuro-production-281c.up.railway.app/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KURO_EXECUTOR_API_KEY" \
  -d '{
    "input_mint": "So11111111111111111111111111111111111111112",
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "in_amount_lamports": 1000000,
    "slippage_bps": 100
  }'
```

## Dry-Run Swap

Dry-run only. Does not submit transaction.

```bash
curl -X POST https://kuro-production-281c.up.railway.app/swap \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KURO_EXECUTOR_API_KEY" \
  -d '{
    "input_mint": "So11111111111111111111111111111111111111112",
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "in_amount_lamports": 1000000,
    "max_slippage_bps": 100,
    "use_jito": false,
    "dry_run": true
  }'
```

## Live Swap

Only after auth + funding + dry-run checks:

```json
{
  "dry_run": false,
  "use_jito": true,
  "jito_tip_lamports": 200000
}
```

Executor still enforces:

- Per-trade cap.
- Daily cap.
- Drawdown lock.

## Phoenix Dry-Run Perp

Phoenix live is disabled by env. Dry-run can still build/simulate if Phoenix account/access works.

```bash
curl -X POST https://kuro-production-281c.up.railway.app/phoenix/isolated_market_order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KURO_EXECUTOR_API_KEY" \
  -d '{
    "symbol": "SOL",
    "side": "bid",
    "quantity": 0.01,
    "transfer_amount_usdc": 10,
    "pda_index": 0,
    "dry_run": true
  }'
```

## Use From Local Agent

Set:

```bash
export KURO_EXECUTOR_URL=https://kuro-production-281c.up.railway.app
export KURO_EXECUTOR_API_KEY=strong-random-secret
```

Then:

```bash
cd agent
npm run status
npm run agent -- "show executor status"
npm run agent -- "dry-run 0.001 SOL to USDC"
```

## Jupiter Endpoint

Executor defaults to Jupiter Lite Swap API:

```bash
JUPITER_SWAP_API_URL=https://lite-api.jup.ag/swap/v1
```
