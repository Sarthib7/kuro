# Production Runbook

Hosted Kuro path. Default = dry-run + analysis-first. Live trading needs explicit env change + funded hot wallet.

## Status

Ready:

- Hosted dry-run.
- Read-only analysis.
- Market watching.
- Backtests.
- Phoenix tx simulation.

Not ready:

- Fully unattended live trading until gates pass.

## Services

Run two services:

1. `kuro-executor`: Rust service. Owns hot wallet. Signs txs. Enforces caps.
2. `kuro-autonomous`: Node worker. Watches pools. Analyzes candidates. Calls Executor.
3. `kuro-ui`: static browser console. Host separately on Vercel or Cloudflare Pages.

Prefer private executor networking for worker-only operation. If the browser UI
will call the executor directly, expose the executor URL only with
`KURO_EXECUTOR_API_KEY` set and `KURO_ALLOWED_ORIGINS` restricted to the exact
UI origins. Without the API key, anyone can call `/swap`.

## Railway

One Railway project. Two services.

### `kuro-executor`

Root: `executor/`

Volume:

- Mount: `/data`
- Size: >= 1 GB
- Holds: `keypair.json`, `state.json`

Env:

```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
JUPITER_SWAP_API_URL=https://lite-api.jup.ag/swap/v1
PORT=8080
KURO_BIND=0.0.0.0:8080
KURO_EXECUTOR_API_KEY=strong-random-secret
KURO_ALLOWED_ORIGINS=https://YOUR-KURO-UI.vercel.app,https://YOUR-KURO-UI.pages.dev
KURO_DATA_DIR=/data
KURO_MAX_TRADE_SOL=0.02
KURO_DAILY_CAP_SOL=0.1
KURO_DRAWDOWN_KILL_PCT=20
KURO_MAX_PERP_COLLATERAL_USDC=25
KURO_DAILY_PERP_COLLATERAL_USDC=100
KURO_PHOENIX_LIVE_ENABLED=false
KURO_PHOENIX_PROGRAM_ID=
```

Build:

- Builder: Dockerfile.
- Dockerfile path: `Dockerfile`.
- Health path: `/healthz`.

### `kuro-ui`

Root: `site/`

Deploy as a static site on Vercel or Cloudflare Pages. The UI calls the Railway
executor URL entered in the browser, so the executor must include the UI origin
in `KURO_ALLOWED_ORIGINS`.

Vercel:

```bash
cd site
vercel --prod
```

Cloudflare Pages:

```bash
cd site
npx wrangler pages deploy . --project-name kuro-ui
```

### `kuro-autonomous`

Root: `agent/`

Volume:

- Mount: `/data`
- Size: >= 1 GB
- Holds: `positions.json`

Env:

```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
KURO_EXECUTOR_URL=http://kuro-executor.railway.internal:8080
KURO_EXECUTOR_API_KEY=same-secret-as-executor
KURO_POSITIONS_PATH=/data/positions.json
KURO_BRAIN=glm
GLM_API_KEY=YOUR_KEY
KURO_AUTONOMOUS_LIVE=false
KURO_SNIPE_SOL=0.01
KURO_MAX_SLIPPAGE_BPS=1500
KURO_USE_JITO=true
KURO_JITO_TIP_SOL=0.0002
```

Optional:

```bash
BIRDEYE_API_KEY=
ZERION_API_KEY=
GMGN_API_KEY=
JUPITER_API_KEY=
PHOENIX_API_URL=https://perp-api.phoenix.trade
```

Start:

```bash
npx tsx src/cli.ts autonomous
```

## Local Dry-Run

1. Env:

   ```bash
   cp .env.example .env
   ```

2. Executor:

   ```bash
   cd executor
   cargo run --release
   ```

3. Agent:

   ```bash
   cd agent
   npm install
   npm run analyze -- 9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump
   npm run dev -- phoenix-markets SOL
   npm run dev -- phoenix-open SOL long 0.1 10 --dry-run=true
   ```

4. Keep live off:

   ```bash
   KURO_AUTONOMOUS_LIVE=false
   ```

## Live Gates

Do not set `KURO_AUTONOMOUS_LIVE=true` until:

- Executor private network only.
- Executor volume backed up or intentionally disposable.
- Hot wallet funded only with max acceptable loss.
- `npm run typecheck` passes in `agent/`.
- `cargo test` passes in `executor/`.
- Backtest shows positive expectancy for current policy.
- 24h dry-run autonomous logs show no unexpected trade intents.
- RPC quota covers watcher, analysis, simulation, sends.
- Alerts exist for crash, drawdown lock, failed tx bursts.

Phoenix live perps also need:

- Jurisdiction + private beta access valid.
- `KURO_PHOENIX_PROGRAM_ID` pinned from trusted exchange snapshot.
- `KURO_PHOENIX_LIVE_ENABLED=true`.
- Per-order + daily USDC collateral caps sized deliberately.

## P0 Before Unattended Live

- SQLite for positions/trades/risk.
- Private executor networking or an authenticated gateway; bearer key auth is only the baseline.
- Health checks for both services.
- Structured logs + alerts.
- Backtest acceptance threshold + persisted reports.
- Integration tests for Executor dry-run routes.

## P1 Before Public Beta

- Web onboarding + docs site.
- Operator dashboard: wallet, caps, dry-run intents, positions.
- Kill switch without redeploy.
- Multi-RPC send race + confirmation tracking.
- Position reconciliation after restart.
