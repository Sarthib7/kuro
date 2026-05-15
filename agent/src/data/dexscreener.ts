const DS_BASE = "https://api.dexscreener.com";

interface DsPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  pairCreatedAt?: number;
}

export interface DsMarketSummary {
  liquidityUsd: number;
  priceUsd?: number;
  marketCapUsd?: number;
  volume24hUsd?: number;
  primaryDex?: string;
  pairCount: number;
  oldestPairCreatedAt?: number;
}

/**
 * Free, no-key replacement for the paid Birdeye token-overview endpoint.
 * Sums liquidity across all Solana pairs and reports the deepest pool's
 * price / mcap / volume.
 */
export async function getTokenMarket(mint: string): Promise<DsMarketSummary | null> {
  const r = await fetch(`${DS_BASE}/latest/dex/tokens/${mint}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { pairs?: DsPair[] };
  const pairs = (j.pairs ?? []).filter((p) => p.chainId === "solana");
  if (pairs.length === 0) return null;

  const primary = pairs.reduce((a, b) =>
    (a.liquidity?.usd ?? 0) >= (b.liquidity?.usd ?? 0) ? a : b,
  );
  const totalLiq = pairs.reduce((sum, p) => sum + (p.liquidity?.usd ?? 0), 0);
  const oldest = pairs
    .map((p) => p.pairCreatedAt)
    .filter((t): t is number => typeof t === "number")
    .reduce<number | undefined>((min, t) => (min === undefined || t < min ? t : min), undefined);

  return {
    liquidityUsd: totalLiq,
    priceUsd: primary.priceUsd ? Number(primary.priceUsd) : undefined,
    marketCapUsd: primary.marketCap ?? primary.fdv,
    volume24hUsd: primary.volume?.h24,
    primaryDex: primary.dexId,
    pairCount: pairs.length,
    oldestPairCreatedAt: oldest,
  };
}
