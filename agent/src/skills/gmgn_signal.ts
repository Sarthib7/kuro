import { z } from "zod";
import {
  getTokenInfo,
  getSmartMoneyBuys,
  type GmgnTokenInfo,
  type GmgnSmartMoneyBuy,
} from "../data/gmgn.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  mint: z.string().min(32).max(44),
});

type GmgnSignalInput = z.infer<typeof inputSchema>;

export interface GmgnSignalResult {
  mint: string;
  token: GmgnTokenInfo | null;
  smart_money_buys: GmgnSmartMoneyBuy[];
  smart_money_count: number;
  flags: string[];
}

export const gmgnSignalSkill: Skill<GmgnSignalInput, GmgnSignalResult> = {
  name: "gmgn_signal",
  description:
    "Smart-money + Pump.fun signals for a mint via GMGN: recent buys by high-win-rate wallets, bundle share, top10 concentration, honeypot status. Best-effort: GMGN's API has light rate limits and occasionally fails — treat as enrichment, not a hard dependency.",
  inputSchema,
  async execute(input) {
    const [token, smartMoneyBuys] = await Promise.all([
      getTokenInfo(input.mint),
      getSmartMoneyBuys(input.mint),
    ]);

    const flags: string[] = [];
    if (token?.honeypot_status === "honeypot") flags.push("gmgn_honeypot");
    if (token?.bundle_share_pct !== undefined && token.bundle_share_pct > 30) {
      flags.push(`gmgn_bundled_${token.bundle_share_pct.toFixed(0)}pct`);
    }
    if (
      token?.creator_balance_pct !== undefined &&
      token.creator_balance_pct > 10
    ) {
      flags.push(`creator_holds_${token.creator_balance_pct.toFixed(0)}pct`);
    }
    if (smartMoneyBuys.length >= 3) {
      flags.push(`smart_money_buys_${smartMoneyBuys.length}`);
    }

    return {
      mint: input.mint,
      token,
      smart_money_buys: smartMoneyBuys,
      smart_money_count: smartMoneyBuys.length,
      flags,
    };
  },
};
