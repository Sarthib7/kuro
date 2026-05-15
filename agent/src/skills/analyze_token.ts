import { z } from "zod";
import { getMintInfo, getTopHolders } from "../data/solana.js";
import { probeDepth, simulateSell, type DepthSample } from "../data/jupiter.js";
import { getTokenOverview } from "../data/birdeye.js";
import { getTokenMarket } from "../data/dexscreener.js";
import { getTokenInfo, getSmartMoneyBuys } from "../data/gmgn.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  mint: z.string().min(32).max(44),
  topN: z.number().int().positive().max(20),
});

type AnalyzeTokenInput = z.infer<typeof inputSchema>;

export interface AnalyzeTokenResult {
  mint: string;
  decimals: number;
  uiSupply: number;
  authorities: {
    mintAuthority: string | null;
    freezeAuthority: string | null;
    mintRenounced: boolean;
    freezeRenounced: boolean;
  };
  holders: {
    topNPct: number;
    top: { address: string; uiAmount: number; pct: number }[];
    totalHolders?: number;
  };
  market?: {
    source: "birdeye" | "dexscreener";
    liquidityUsd?: number;
    priceUsd?: number;
    marketCapUsd?: number;
    volume24hUsd?: number;
    primaryDex?: string;
    pairCount?: number;
  };
  depth: DepthSample[];
  honeypotSim: {
    canSell: boolean;
    tokenUiAmountTested: number;
    sellSolOut: number;
    sellPriceImpactPct: number;
    roundTripSolRetained: number;
  } | null;
  signals?: {
    gmgn?: {
      smart_money_count: number;
      bundle_share_pct?: number;
      creator_balance_pct?: number;
      honeypot_status?: "ok" | "warn" | "honeypot" | "unknown";
    };
  };
  flags: string[];
}

export const analyzeTokenSkill: Skill<AnalyzeTokenInput, AnalyzeTokenResult> = {
  name: "analyze_token",
  description:
    "Analyse a Solana SPL token: supply, mint/freeze authorities, top holders, Jupiter pool depth, and a round-trip sell-side honeypot simulation.",
  inputSchema,
  async execute(input, ctx) {
    const { mint, topN } = input;

    const mintInfo = await getMintInfo(ctx.rpc, mint);
    const allHolders = await getTopHolders(ctx.rpc, mint, mintInfo.uiSupply);
    const top = allHolders.slice(0, topN);
    const topNPct = top.reduce((acc, h) => acc + h.pct, 0);

    const [overview, dsMarket, depth, gmgnInfo, gmgnSmart] = await Promise.all([
      getTokenOverview(mint, ctx.env.BIRDEYE_API_KEY),
      getTokenMarket(mint),
      probeDepth(mint, mintInfo.decimals),
      getTokenInfo(mint),
      getSmartMoneyBuys(mint),
    ]);

    // Round-trip honeypot test: take what we'd get for 1 SOL, then try to sell it back.
    const oneSolProbe = depth.find((d) => d.solIn === 1);
    const sellAmount = oneSolProbe?.outUi ?? 0;
    const sim = sellAmount > 0 ? await simulateSell(mint, mintInfo.decimals, sellAmount) : null;

    const flags: string[] = [];
    if (mintInfo.mintAuthority) flags.push("mint_authority_not_renounced");
    if (mintInfo.freezeAuthority) flags.push("freeze_authority_not_renounced");
    if (topNPct > 50) flags.push(`top_${topN}_holders_${topNPct.toFixed(1)}pct`);
    if (depth.length === 0) flags.push("no_jupiter_route");
    if (sim && !sim.canSell) flags.push("sell_simulation_failed_possible_honeypot");
    if (sim && sim.canSell && sim.solOut < 0.7) {
      flags.push(`round_trip_loss_${((1 - sim.solOut) * 100).toFixed(1)}pct`);
    }
    if (gmgnInfo?.honeypot_status === "honeypot") flags.push("gmgn_honeypot");
    if (gmgnInfo?.bundle_share_pct !== undefined && gmgnInfo.bundle_share_pct > 30) {
      flags.push(`gmgn_bundled_${gmgnInfo.bundle_share_pct.toFixed(0)}pct`);
    }
    if (
      gmgnInfo?.creator_balance_pct !== undefined &&
      gmgnInfo.creator_balance_pct > 10
    ) {
      flags.push(`creator_holds_${gmgnInfo.creator_balance_pct.toFixed(0)}pct`);
    }
    if (gmgnSmart.length >= 3) {
      flags.push(`smart_money_buys_${gmgnSmart.length}`);
    }

    return {
      mint,
      decimals: mintInfo.decimals,
      uiSupply: mintInfo.uiSupply,
      authorities: {
        mintAuthority: mintInfo.mintAuthority,
        freezeAuthority: mintInfo.freezeAuthority,
        mintRenounced: mintInfo.mintAuthority === null,
        freezeRenounced: mintInfo.freezeAuthority === null,
      },
      holders: {
        topNPct,
        top,
        totalHolders: overview?.holder,
      },
      market: overview
        ? {
            source: "birdeye" as const,
            liquidityUsd: overview.liquidity,
            priceUsd: overview.price,
            marketCapUsd: overview.mc,
            volume24hUsd: overview.v24hUSD,
          }
        : dsMarket
          ? {
              source: "dexscreener" as const,
              liquidityUsd: dsMarket.liquidityUsd,
              priceUsd: dsMarket.priceUsd,
              marketCapUsd: dsMarket.marketCapUsd,
              volume24hUsd: dsMarket.volume24hUsd,
              primaryDex: dsMarket.primaryDex,
              pairCount: dsMarket.pairCount,
            }
          : undefined,
      depth,
      honeypotSim: sim
        ? {
            canSell: sim.canSell,
            tokenUiAmountTested: sellAmount,
            sellSolOut: sim.solOut,
            sellPriceImpactPct: sim.priceImpactPct,
            roundTripSolRetained: sim.solOut,
          }
        : null,
      signals:
        gmgnInfo || gmgnSmart.length > 0
          ? {
              gmgn: {
                smart_money_count: gmgnSmart.length,
                bundle_share_pct: gmgnInfo?.bundle_share_pct,
                creator_balance_pct: gmgnInfo?.creator_balance_pct,
                honeypot_status: gmgnInfo?.honeypot_status,
              },
            }
          : undefined,
      flags,
    };
  },
};
