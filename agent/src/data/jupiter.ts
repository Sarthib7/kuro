// Public quote endpoint by default; if JUPITER_API_KEY is set we route to the
// Pro endpoint (api.jup.ag/swap/v1) with the key as an x-api-key header — drop-in
// upgrade for higher RPS when you eventually pay for Pro.
function jupQuoteUrl(): string {
  if (process.env.JUPITER_API_KEY) {
    return process.env.JUPITER_BASE_URL
      ? `${process.env.JUPITER_BASE_URL.replace(/\/$/, "")}/swap/v1/quote`
      : "https://api.jup.ag/swap/v1/quote";
  }
  return "https://quote-api.jup.ag/v6/quote";
}

function jupHeaders(): Record<string, string> {
  const key = process.env.JUPITER_API_KEY;
  return key ? { "x-api-key": key } : {};
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface JupQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
}

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps?: number;
}): Promise<JupQuote | null> {
  const url = new URL(jupQuoteUrl());
  url.searchParams.set("inputMint", params.inputMint);
  url.searchParams.set("outputMint", params.outputMint);
  url.searchParams.set("amount", params.amount.toString());
  url.searchParams.set("slippageBps", String(params.slippageBps ?? 100));
  url.searchParams.set("onlyDirectRoutes", "false");
  const res = await fetch(url, { headers: jupHeaders() });
  if (!res.ok) return null;
  return (await res.json()) as JupQuote;
}

export interface DepthSample {
  solIn: number;
  outUi: number;
  priceImpactPct: number;
}

export async function probeDepth(
  mint: string,
  decimals: number,
  solSizes: number[] = [0.1, 1, 10],
): Promise<DepthSample[]> {
  const out: DepthSample[] = [];
  for (const sol of solSizes) {
    const q = await getQuote({
      inputMint: SOL_MINT,
      outputMint: mint,
      amount: BigInt(Math.floor(sol * 1e9)),
    });
    if (!q) continue;
    out.push({
      solIn: sol,
      outUi: Number(q.outAmount) / 10 ** decimals,
      priceImpactPct: Number(q.priceImpactPct) * 100,
    });
  }
  return out;
}

export interface SellSim {
  canSell: boolean;
  solOut: number;
  priceImpactPct: number;
}

export async function simulateSell(
  mint: string,
  decimals: number,
  tokenUiAmount: number,
): Promise<SellSim | null> {
  const raw = BigInt(Math.floor(tokenUiAmount * 10 ** decimals));
  if (raw <= 0n) return null;
  const q = await getQuote({ inputMint: mint, outputMint: SOL_MINT, amount: raw });
  if (!q) return { canSell: false, solOut: 0, priceImpactPct: 100 };
  return {
    canSell: true,
    solOut: Number(q.outAmount) / 1e9,
    priceImpactPct: Number(q.priceImpactPct) * 100,
  };
}
