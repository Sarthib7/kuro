const GMGN_BASE = process.env.GMGN_BASE_URL ?? "https://gmgn.ai";

const COMMON_HEADERS: Record<string, string> = {
  accept: "application/json",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
};

function authHeaders(): Record<string, string> {
  const key = process.env.GMGN_API_KEY;
  if (!key) return {};
  return { authorization: `Bearer ${key}` };
}

export interface GmgnTokenInfo {
  symbol?: string;
  name?: string;
  price_usd?: number;
  market_cap_usd?: number;
  liquidity_usd?: number;
  holder_count?: number;
  top10_share_pct?: number;
  bundle_share_pct?: number;
  creator_address?: string;
  creator_balance_pct?: number;
  is_renounced?: boolean;
  honeypot_status?: "ok" | "warn" | "honeypot" | "unknown";
}

/**
 * Best-effort token info from GMGN's public quotation endpoints. These aren't
 * formally documented; we set a browser User-Agent which currently passes their
 * Cloudflare gate. If you have a paid GMGN_API_KEY, it's sent as Bearer and
 * upgrades reliability.
 *
 * Returns null on any failure — callers must treat GMGN as best-effort
 * enrichment, not a hard dependency.
 */
export async function getTokenInfo(mint: string): Promise<GmgnTokenInfo | null> {
  const url = `${GMGN_BASE}/defi/quotation/v1/tokens/sol/${mint}`;
  try {
    const r = await fetch(url, { headers: { ...COMMON_HEADERS, ...authHeaders() } });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { token?: Record<string, unknown> } };
    const t = j.data?.token;
    if (!t) return null;
    return {
      symbol: stringField(t, "symbol"),
      name: stringField(t, "name"),
      price_usd: numberField(t, "price"),
      market_cap_usd: numberField(t, "market_cap"),
      liquidity_usd: numberField(t, "liquidity"),
      holder_count: numberField(t, "holder_count"),
      top10_share_pct: numberField(t, "top_10_holder_rate"),
      bundle_share_pct: numberField(t, "bundle_rate"),
      creator_address: stringField(t, "creator"),
      creator_balance_pct: numberField(t, "creator_balance_rate"),
      is_renounced: boolField(t, "renounced"),
      honeypot_status: parseHoneypotStatus(stringField(t, "honeypot_status")),
    };
  } catch {
    return null;
  }
}

export interface GmgnSmartMoneyBuy {
  wallet: string;
  win_rate?: number;
  realized_pnl_usd?: number;
  amount_sol?: number;
  ts?: number;
}

/**
 * Recent buys of `mint` by wallets GMGN tags as "smart money" — high-win-rate
 * traders. This is the signal that's hardest to replicate from on-chain data
 * alone, so it's where GMGN's edge lives. Best-effort, returns [] on failure.
 */
export async function getSmartMoneyBuys(mint: string): Promise<GmgnSmartMoneyBuy[]> {
  const url = `${GMGN_BASE}/defi/quotation/v1/smartmoney/sol/${mint}`;
  try {
    const r = await fetch(url, { headers: { ...COMMON_HEADERS, ...authHeaders() } });
    if (!r.ok) return [];
    const j = (await r.json()) as { data?: { list?: Array<Record<string, unknown>> } };
    return (j.data?.list ?? []).map((row) => ({
      wallet: stringField(row, "address") ?? "",
      win_rate: numberField(row, "winrate"),
      realized_pnl_usd: numberField(row, "realized_profit"),
      amount_sol: numberField(row, "amount_sol"),
      ts: numberField(row, "timestamp"),
    }));
  } catch {
    return [];
  }
}

function stringField(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
}
function numberField(o: Record<string, unknown>, k: string): number | undefined {
  const v = o[k];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
function boolField(o: Record<string, unknown>, k: string): boolean | undefined {
  const v = o[k];
  return typeof v === "boolean" ? v : undefined;
}
function parseHoneypotStatus(s?: string): GmgnTokenInfo["honeypot_status"] {
  if (!s) return undefined;
  const l = s.toLowerCase();
  if (l.includes("ok") || l === "0") return "ok";
  if (l.includes("warn")) return "warn";
  if (l.includes("honeypot") || l === "1") return "honeypot";
  return "unknown";
}
