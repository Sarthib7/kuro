const ZERION_BASE = process.env.ZERION_BASE_URL ?? "https://api.zerion.io/v1";

function authHeader(): Record<string, string> {
  const key = process.env.ZERION_API_KEY;
  if (!key) return {};
  // Zerion uses HTTP Basic with the key as the username and blank password.
  const basic = Buffer.from(`${key}:`).toString("base64");
  return { Authorization: `Basic ${basic}` };
}

export interface ZerionPortfolioSummary {
  total_usd: number;
  by_chain: Record<string, number>;
  by_position_type: Record<string, number>;
}

export async function getWalletPortfolio(
  address: string,
): Promise<ZerionPortfolioSummary | null> {
  if (!process.env.ZERION_API_KEY) return null;
  const url = `${ZERION_BASE}/wallets/${address}/portfolio?currency=usd`;
  const r = await fetch(url, { headers: { accept: "application/json", ...authHeader() } });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    data?: {
      attributes?: {
        total?: { positions?: number };
        positions_distribution_by_chain?: Record<string, number>;
        positions_distribution_by_type?: Record<string, number>;
      };
    };
  };
  const attrs = j.data?.attributes;
  if (!attrs) return null;
  return {
    total_usd: attrs.total?.positions ?? 0,
    by_chain: attrs.positions_distribution_by_chain ?? {},
    by_position_type: attrs.positions_distribution_by_type ?? {},
  };
}

export interface ZerionRecentTx {
  hash: string;
  chain: string;
  type: string;
  status: string;
  mined_at?: string;
  value_usd?: number;
}

export async function getRecentTransactions(
  address: string,
  limit = 20,
): Promise<ZerionRecentTx[]> {
  if (!process.env.ZERION_API_KEY) return [];
  const url = `${ZERION_BASE}/wallets/${address}/transactions?currency=usd&page[size]=${limit}`;
  const r = await fetch(url, { headers: { accept: "application/json", ...authHeader() } });
  if (!r.ok) return [];
  const j = (await r.json()) as {
    data?: Array<{
      attributes?: {
        hash?: string;
        operation_type?: string;
        status?: string;
        mined_at?: string;
        transfers?: Array<{ value?: number }>;
      };
      relationships?: { chain?: { data?: { id?: string } } };
    }>;
  };
  return (j.data ?? []).map((d) => {
    const a = d.attributes ?? {};
    const transfers = a.transfers ?? [];
    const valueUsd = transfers.reduce((s, t) => s + (t.value ?? 0), 0);
    return {
      hash: a.hash ?? "",
      chain: d.relationships?.chain?.data?.id ?? "",
      type: a.operation_type ?? "",
      status: a.status ?? "",
      mined_at: a.mined_at,
      value_usd: valueUsd > 0 ? valueUsd : undefined,
    };
  });
}

export async function getSolanaPositions(address: string): Promise<
  { token: string; symbol?: string; value_usd: number; quantity: number }[]
> {
  if (!process.env.ZERION_API_KEY) return [];
  const url = `${ZERION_BASE}/wallets/${address}/positions?currency=usd&filter[chain_ids]=solana&page[size]=50`;
  const r = await fetch(url, { headers: { accept: "application/json", ...authHeader() } });
  if (!r.ok) return [];
  const j = (await r.json()) as {
    data?: Array<{
      attributes?: {
        fungible_info?: { symbol?: string; implementations?: Array<{ address?: string }> };
        value?: number;
        quantity?: { numeric?: string };
      };
    }>;
  };
  return (j.data ?? []).map((d) => {
    const a = d.attributes ?? {};
    const impl = a.fungible_info?.implementations?.[0];
    return {
      token: impl?.address ?? "",
      symbol: a.fungible_info?.symbol,
      value_usd: a.value ?? 0,
      quantity: Number(a.quantity?.numeric ?? 0),
    };
  });
}
