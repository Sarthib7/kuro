import { z } from "zod";
import {
  getPhoenixMarket,
  listPhoenixMarkets,
  type PhoenixMarket,
} from "../data/phoenix.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  symbol: z.string().min(1).max(32).optional(),
});

type PhoenixMarketsInput = z.infer<typeof inputSchema>;

export interface PhoenixMarketsResult {
  source: "phoenix";
  markets: PhoenixMarket[];
}

export const phoenixMarketsSkill: Skill<PhoenixMarketsInput, PhoenixMarketsResult> = {
  name: "phoenix_markets",
  description:
    "Read-only Phoenix perps market metadata. Pass symbol for one market, or omit it to list available markets.",
  inputSchema,
  async execute(input) {
    const markets = input.symbol
      ? [await getPhoenixMarket(input.symbol)]
      : await listPhoenixMarkets();
    return { source: "phoenix", markets };
  },
};
