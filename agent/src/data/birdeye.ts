const BIRDEYE_BASE = "https://public-api.birdeye.so";

export interface BirdeyeTokenOverview {
  holder?: number;
  liquidity?: number;
  price?: number;
  v24hUSD?: number;
  mc?: number;
}

export async function getTokenOverview(
  mint: string,
  apiKey?: string,
): Promise<BirdeyeTokenOverview | null> {
  if (!apiKey) return null;
  const res = await fetch(`${BIRDEYE_BASE}/defi/token_overview?address=${mint}`, {
    headers: { "X-API-KEY": apiKey, "x-chain": "solana" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: BirdeyeTokenOverview };
  return json.data ?? null;
}
