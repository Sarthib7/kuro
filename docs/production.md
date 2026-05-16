# Production Runbook

This is the operational path for running kuro as a hosted agent. The default
posture is dry-run and analysis-first; live trading requires explicit env
changes plus funded wallets.

## Production status

kuro is ready for hosted dry-run, read-only analysis, market watching, backtests,
and Phoenix transaction simulation. It is not ready for fully unattended live
trading until the launch gates below are complete.

## Services

Run kuro as two separate services:

1. `kuro-executor`: Rust service that owns the hot wallet, signs transactions,
   enforces caps, and exposes private HTTP endpoints.
2. `kuro-autonomous`: Node worker that watches pools, analyzes candidates, and
   calls the executor.

Do not expose the executor publicly. It should only be reachable by the agent
over private service networking.

## Railway setup

Create one Railway project with two services.

### kuro-executor

Root directory: `executor/`

Required volume:

- Mount path: `/data`
- Size: at least 1 GB
- Holds `keypair.json` and `state.json`

Required env:

```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
KURO_BIND=0.0.0.0:7777
KURO_DATA_DIR=/data
KURO_MAX_TRADE_SOL=0.02
KURO_DAILY_CAP_SOL=0.1
KURO_DRAWDOWN_KILL_PCT=20
KURO_MAX_PERP_COLLATERAL_USDC=25
KURO_DAILY_PERP_COLLATERAL_USDC=100
KURO_PHOENIX_LIVE_ENABLED=false
KURO_PHOENIX_PROGRAM_ID=
```

Build config:

- Builder: Dockerfile
- Dockerfile path: `Dockerfile`
- Health check path: `/healthz`

### kuro-autonomous

Root directory: `agent/`

Required volume:

- Mount path: `/data`
- Size: at least 1 GB
- Holds `positions.json`

Required env:

```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
KURO_EXECUTOR_URL=http://kuro-executor.railway.internal:7777
KURO_POSITIONS_PATH=/data/positions.json
KURO_BRAIN=glm
GLM_API_KEY=YOUR_KEY
KURO_AUTONOMOUS_LIVE=false
KURO_SNIPE_SOL=0.01
KURO_MAX_SLIPPAGE_BPS=1500
KURO_USE_JITO=true
KURO_JITO_TIP_SOL=0.0002
```

Optional env:

```bash
BIRDEYE_API_KEY=
ZERION_API_KEY=
GMGN_API_KEY=
JUPITER_API_KEY=
PHOENIX_API_URL=https://perp-api.phoenix.trade
```

Start command:

```bash
npx tsx src/cli.ts autonomous
```

## Local dry-run onboarding

1. Copy env:

   ```bash
   cp .env.example .env
   ```

2. Start executor:

   ```bash
   cd executor
   cargo run --release
   ```

3. In another shell, install and run agent commands:

   ```bash
   cd agent
   npm install
   npm run analyze -- 9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump
   npm run dev -- phoenix-markets SOL
   npm run dev -- phoenix-open SOL long 0.1 10 --dry-run=true
   ```

4. Keep `KURO_AUTONOMOUS_LIVE=false` until backtests and dry-run logs are clean.

## Live trading gates

Do not set `KURO_AUTONOMOUS_LIVE=true` until all of these are true:

- Executor is on a private network only.
- Executor volume is backed up or intentionally disposable.
- Hot wallet is funded with only the maximum amount you are willing to lose.
- `npm run typecheck` passes in `agent/`.
- `cargo test` passes in `executor/`.
- Backtest report shows positive expectancy for the current policy.
- At least 24 hours of dry-run autonomous logs have no unexpected trade intents.
- RPC provider has enough quota for watcher, analysis, simulation, and sends.
- Alerting exists for crashes, drawdown lock, and failed transaction bursts.

For Phoenix live perps, also require:

- Jurisdiction and private beta access are valid.
- `KURO_PHOENIX_PROGRAM_ID` is pinned from a trusted exchange snapshot.
- `KURO_PHOENIX_LIVE_ENABLED=true`.
- Per-order and daily USDC collateral caps are deliberately sized.

## Remaining production work

P0 before live unattended trading:

- Replace JSON position/risk state with SQLite and transaction history.
- Add auth or hard private networking enforcement around executor endpoints.
- Add deployment health checks for both services.
- Add structured logs and alerting.
- Add a backtest acceptance threshold and persist reports.
- Add integration tests for executor dry-run routes.

P1 before public beta:

- Add web onboarding and docs site.
- Add operator dashboard for wallet, caps, dry-run intents, and positions.
- Add kill-switch controls that do not require redeploy.
- Add multi-RPC send race and confirmation tracking.
- Add position reconciliation after restarts.
