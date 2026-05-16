import { z } from "zod";
import {
  getPhoenixCandles,
  getPhoenixMarket,
  normalizePhoenixSymbol,
  type PhoenixCandle,
  type PhoenixMarket,
} from "../data/phoenix.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  symbol: z.string().min(1).max(32),
  timeframe: z.string().min(1).max(16).optional(),
  limit: z.number().int().min(20).max(500).optional(),
  enable_external_source: z.boolean().optional(),
});

type PhoenixSignalInput = z.infer<typeof inputSchema>;

export interface PhoenixSignalResult {
  source: "phoenix";
  symbol: string;
  timeframe: string;
  candles: number;
  market: Pick<
    PhoenixMarket,
    | "symbol"
    | "marketStatus"
    | "tickSize"
    | "makerFee"
    | "takerFee"
    | "fundingIntervalSeconds"
    | "maxFundingRatePerIntervalPercentage"
  >;
  signal: {
    last_price: number;
    mark_price?: number;
    change_pct: number;
    volatility_pct: number;
    ema_fast: number;
    ema_slow: number;
    rsi: number;
    bias: "long" | "short" | "neutral";
    confidence: "low" | "medium";
    reasons: string[];
    risks: string[];
  };
  recent: PhoenixCandle[];
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  return values.slice(1).reduce((acc, v) => v * k + acc * (1 - k), values[0]!);
}

function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  const window = values.slice(-period - 1);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < window.length; i++) {
    const delta = window[i]! - window[i - 1]!;
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export const phoenixSignalSkill: Skill<PhoenixSignalInput, PhoenixSignalResult> = {
  name: "phoenix_signal",
  description:
    "Read-only Phoenix perps signal bundle from candles and market metadata. Use before any Phoenix perp suggestion. Does not place trades.",
  inputSchema,
  async execute(input) {
    const symbol = normalizePhoenixSymbol(input.symbol);
    const timeframe = input.timeframe ?? "1m";
    const limit = input.limit ?? 120;
    const [market, candles] = await Promise.all([
      getPhoenixMarket(symbol),
      getPhoenixCandles({
        symbol,
        timeframe,
        limit,
        enableExternalSource: input.enable_external_source,
      }),
    ]);

    if (candles.length < 20) {
      throw new Error(`Phoenix returned too few candles for signal: ${candles.length}`);
    }

    const closes = candles.map((c) => c.close);
    const first = closes[0]!;
    const last = closes[closes.length - 1]!;
    const mark = candles[candles.length - 1]!.markClose;
    const fast = ema(closes, 12);
    const slow = ema(closes, 26);
    const rsiValue = rsi(closes);
    const returns = closes.slice(1).map((v, i) => pct(v, closes[i]!));
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance =
      returns.reduce((acc, v) => acc + (v - mean) ** 2, 0) / Math.max(1, returns.length - 1);
    const volatilityPct = Math.sqrt(variance);

    const reasons: string[] = [];
    const risks: string[] = [];
    let bias: PhoenixSignalResult["signal"]["bias"] = "neutral";

    if (fast > slow && rsiValue < 72) {
      bias = "long";
      reasons.push("ema_fast_above_ema_slow");
    } else if (fast < slow && rsiValue > 28) {
      bias = "short";
      reasons.push("ema_fast_below_ema_slow");
    } else {
      reasons.push("mixed_trend");
    }

    if (rsiValue >= 70) risks.push("rsi_overbought");
    if (rsiValue <= 30) risks.push("rsi_oversold");
    if (market.marketStatus !== "active") risks.push(`market_not_active:${market.marketStatus}`);
    if (volatilityPct > 1.5) risks.push("high_short_window_volatility");

    return {
      source: "phoenix",
      symbol,
      timeframe,
      candles: candles.length,
      market: {
        symbol: market.symbol,
        marketStatus: market.marketStatus,
        tickSize: market.tickSize,
        makerFee: market.makerFee,
        takerFee: market.takerFee,
        fundingIntervalSeconds: market.fundingIntervalSeconds,
        maxFundingRatePerIntervalPercentage: market.maxFundingRatePerIntervalPercentage,
      },
      signal: {
        last_price: round(last),
        mark_price: mark === undefined ? undefined : round(mark),
        change_pct: round(pct(last, first)),
        volatility_pct: round(volatilityPct),
        ema_fast: round(fast),
        ema_slow: round(slow),
        rsi: round(rsiValue, 2),
        bias,
        confidence: risks.length === 0 && reasons[0] !== "mixed_trend" ? "medium" : "low",
        reasons,
        risks,
      },
      recent: candles.slice(-5),
    };
  },
};

