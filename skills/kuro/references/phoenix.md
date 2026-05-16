# Phoenix perps

Phoenix support is Solana-only and uses `https://perp-api.phoenix.trade` by default.

## Read-only

```bash
kuro phoenix-markets
kuro phoenix-markets SOL
kuro phoenix-trader
kuro phoenix-trader <authority> --pda-index=0
```

`phoenix-trader` uses the executor wallet when `authority` is omitted.

## Build / simulate an isolated market order

```bash
kuro phoenix-open SOL long 0.1 10 --dry-run=true
```

Arguments:

- `symbol`: Phoenix market symbol, for example `SOL`. `SOL-PERP` is accepted
  by the agent and normalized to `SOL`.
- `side`: `long`, `short`, `bid`, or `ask`.
- `quantity`: base units.
- `collateral-usdc`: USDC collateral to transfer into the isolated position.

Dry-run is the default. It builds Phoenix instructions, compiles a Solana
transaction, signs it with the executor wallet, and runs RPC simulation without
submitting. Live submission requires:

- explicit user confirmation in the current turn
- `--dry-run=false`
- `KURO_PHOENIX_LIVE_ENABLED=true`
- `KURO_PHOENIX_PROGRAM_ID` pinned
- executor caps allowing the collateral amount

Phoenix is private beta and jurisdiction-restricted. Do not help users bypass
access or jurisdiction gates.
