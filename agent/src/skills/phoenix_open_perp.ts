import { z } from "zod";
import { ExecutorClient, type ExecutorPhoenixMarketOrderResp } from "../data/executor.js";
import { getPhoenixMarket, normalizePhoenixSymbol } from "../data/phoenix.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  symbol: z.string().min(1).max(32),
  side: z.enum(["bid", "ask", "long", "short"]),
  quantity: z.number().positive(),
  transfer_amount_usdc: z.number().positive().max(1_000_000),
  max_price_in_ticks: z.number().int().nonnegative().optional(),
  pda_index: z.number().int().nonnegative().max(255).optional(),
  dry_run: z.boolean().optional(),
});

type PhoenixOpenPerpInput = z.infer<typeof inputSchema>;

export interface PhoenixOpenPerpResult {
  preflight: "passed" | { blocked_reason: string };
  market_status?: string;
  order?: ExecutorPhoenixMarketOrderResp;
}

function normalizeSide(side: PhoenixOpenPerpInput["side"]): "bid" | "ask" {
  if (side === "long") return "bid";
  if (side === "short") return "ask";
  return side;
}

export const phoenixOpenPerpSkill: Skill<PhoenixOpenPerpInput, PhoenixOpenPerpResult> = {
  name: "phoenix_open_perp",
  description:
    "Build and optionally submit a guarded Phoenix isolated market order through the Rust executor. Defaults dry_run=true. Live orders require explicit user authorization and executor-side Phoenix live enablement.",
  inputSchema,
  async execute(input) {
    const symbol = normalizePhoenixSymbol(input.symbol);
    const market = await getPhoenixMarket(symbol);
    if (market.marketStatus !== "active") {
      return {
        preflight: { blocked_reason: `market_not_active:${market.marketStatus}` },
        market_status: market.marketStatus,
      };
    }

    const exec = new ExecutorClient();
    const order = await exec.phoenixIsolatedMarketOrder({
      symbol,
      side: normalizeSide(input.side),
      quantity: input.quantity,
      transfer_amount_usdc: input.transfer_amount_usdc,
      max_price_in_ticks: input.max_price_in_ticks,
      pda_index: input.pda_index ?? 0,
      dry_run: input.dry_run ?? true,
    });

    return { preflight: "passed", market_status: market.marketStatus, order };
  },
};
