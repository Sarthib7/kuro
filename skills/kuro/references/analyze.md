# Analyze a Solana token

> Read-only. Always safe to run without confirmation.

## Command

```
kuro analyze <mint> [--topN=10]
```

Current entrypoint (until `kuro` bin ships): `cd agent && npm run analyze -- <mint>`.

## What it returns

JSON on stdout with:

| Field | Meaning |
|---|---|
| `mint`, `decimals`, `uiSupply` | Basic SPL token info |
| `authorities.mintRenounced` | `true` if the mint authority is null. Required for renounced tokens. |
| `authorities.freezeRenounced` | `true` if the freeze authority is null. **A non-renounced freeze authority lets the dev brick your tokens — treat as a hard red flag for memes.** |
| `holders.topNPct` | % of supply held by the top N (default 10) accounts |
| `holders.top[]` | Per-address balance + % |
| `market.source` | `"birdeye"` if `BIRDEYE_API_KEY` set, else `"dexscreener"` |
| `market.liquidityUsd`, `priceUsd`, `marketCapUsd`, `volume24hUsd` | Pool stats |
| `depth[]` | Jupiter quote impact at 0.1 / 1 / 10 SOL — shows how much slippage a buy of that size eats |
| `honeypotSim.canSell` | Round-trip test: bought tokens for 1 SOL, can you sell them back? |
| `honeypotSim.sellSolOut` | SOL you'd recover from selling. **< 0.7 SOL → significant tax/slippage/honeypot risk** |
| `signals.gmgn` | If GMGN reachable: bundle share %, creator balance %, smart-money buy count |
| `flags[]` | Human-readable issue list (see below) |

## Flags to act on

| Flag | Severity | Meaning |
|---|---|---|
| `sell_simulation_failed_possible_honeypot` | **block** | Sell quote failed — almost certainly a honeypot. Refuse any snipe. |
| `freeze_authority_not_renounced` | **block** (memes) | Dev can freeze your account. Refuse meme snipe; OK for established tokens. |
| `gmgn_honeypot` | **block** | GMGN's heuristics flagged honeypot. Refuse. |
| `no_jupiter_route` | **block** | No tradeable route — you'd be sniping into a dead pool. |
| `round_trip_loss_NN.Npct` (NN > 20) | **warn** | Heavy round-trip loss; could be tax or thin liquidity. |
| `top_10_holders_NN.Npct` (NN > 60) | **warn** | Concentration risk — top wallets can dump on you. |
| `gmgn_bundled_NNpct` (NN > 30) | **warn** | A single bundler took >30% at launch. Common rug pattern. |
| `creator_holds_NNpct` (NN > 10) | **warn** | Creator still holds >10% of supply. |
| `mint_authority_not_renounced` | **note** | Mint authority can mint more. Acceptable for some projects, red flag for memes. |
| `smart_money_buys_N` (positive!) | **bullish** | N smart-money wallets recently bought. Not a green-light but a tailwind. |

## Output contract for the host agent

Present results as a compact table or bullet list, NOT a JSON dump. Highlight:

1. Block-level flags (refuse trade if asked)
2. Top-3 concerning warns
3. Depth at 1 SOL (price impact %)
4. Honeypot round-trip retained SOL
5. Any positive signals (smart money)

End with: *"What would you like to do?"* — do not auto-suggest a snipe unless the user asked.
