import { cfg } from "../config.js";

export type PhoenixMarketStatus =
  | "uninitialized"
  | "active"
  | "postOnly"
  | "paused"
  | "closed"
  | "tombstoned";

export interface PhoenixLeverageTier {
  limitOrderRiskFactor: number;
  maxLeverage: number;
  maxSizeBaseLots: number;
}

export interface PhoenixMarket {
  assetId: number;
  baseLotsDecimals: number;
  fundingIntervalSeconds: number;
  fundingPeriodSeconds: number;
  isolatedOnly: boolean;
  leverageTiers: PhoenixLeverageTier[];
  makerFee: number;
  marketPubkey: string;
  marketStatus: PhoenixMarketStatus;
  maxFundingRatePerInterval: number;
  maxLiquidationSizeBaseLots: number | string;
  openInterestCapBaseLots: number | string;
  riskFactors: Record<string, number>;
  splinePubkey: string;
  symbol: string;
  takerFee: number;
  tickSize: number;
  commodityMetadata?: {
    isAfterHours?: boolean;
    isCommodity?: boolean;
    isReopen?: boolean;
    status?: string;
    afterHoursRadius?: unknown;
    executionPriceBand?: unknown;
    lastKnownIndexPrice?: unknown;
    markPriceBand?: unknown;
  };
  maxFundingRatePerIntervalPercentage?: number;
}

export interface PhoenixPosition {
  symbol: string;
  positionSize: string;
  entryPrice: string;
  liquidationPrice: string;
  positionValue: string;
  unrealizedPnl: string;
  stopLossPrice?: string;
  takeProfitPrice?: string;
}

export interface PhoenixTraderAccount {
  authority: string;
  traderKey: string;
  traderPdaIndex: number;
  traderSubaccountIndex: number;
  state: string;
  riskState: string;
  riskTier: string;
  collateralBalance: string;
  effectiveCollateral: string;
  initialMargin: string;
  maintenanceMargin: string;
  unrealizedPnl: string;
  positions: PhoenixPosition[];
  capabilities?: Record<string, { immediate?: boolean; viaColdActivation?: boolean }>;
}

export interface PhoenixTraderState {
  authority: string;
  pdaIndex: number;
  slot: number;
  slotIndex: number;
  traders: PhoenixTraderAccount[];
}

function phoenixBaseUrl(): string {
  return cfg().phoenixApiUrl.replace(/\/+$/, "");
}

export function normalizePhoenixSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  return upper.endsWith("-PERP") ? upper.slice(0, -5) : upper;
}

async function phoenixGet<T>(path: string): Promise<T> {
  const r = await fetch(`${phoenixBaseUrl()}${path}`);
  if (!r.ok) throw new Error(`Phoenix GET ${path} failed: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export async function listPhoenixMarkets(): Promise<PhoenixMarket[]> {
  return phoenixGet<PhoenixMarket[]>("/exchange/markets");
}

export async function getPhoenixMarket(symbol: string): Promise<PhoenixMarket> {
  return phoenixGet<PhoenixMarket>(
    `/exchange/market/${encodeURIComponent(normalizePhoenixSymbol(symbol))}`,
  );
}

export async function getPhoenixTraderState(
  authority: string,
  pdaIndex = 0,
): Promise<PhoenixTraderState> {
  const qs = new URLSearchParams({ pdaIndex: String(pdaIndex) });
  return phoenixGet<PhoenixTraderState>(
    `/trader/${encodeURIComponent(authority)}/state?${qs.toString()}`,
  );
}
