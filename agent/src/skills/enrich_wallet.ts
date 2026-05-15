import { z } from "zod";
import {
  getWalletPortfolio,
  getRecentTransactions,
  getSolanaPositions,
  type ZerionPortfolioSummary,
  type ZerionRecentTx,
} from "../data/zerion.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  address: z.string().min(32).max(44),
  txn_limit: z.number().int().positive().max(50),
});

type EnrichWalletInput = z.infer<typeof inputSchema>;

export interface EnrichWalletResult {
  address: string;
  portfolio: ZerionPortfolioSummary | null;
  solana_positions: { token: string; symbol?: string; value_usd: number; quantity: number }[];
  recent_transactions: ZerionRecentTx[];
  flags: string[];
  zerion_available: boolean;
}

export const enrichWalletSkill: Skill<EnrichWalletInput, EnrichWalletResult> = {
  name: "enrich_wallet",
  description:
    "Cross-chain wallet enrichment via Zerion: portfolio total + per-chain distribution, Solana positions, recent transactions. Use on suspect dev wallets, top holders, or suspected alpha wallets. Returns nulls/empty arrays when ZERION_API_KEY is not set.",
  inputSchema,
  async execute(input) {
    const zerionAvailable = !!process.env.ZERION_API_KEY;
    const [portfolio, positions, txns] = await Promise.all([
      getWalletPortfolio(input.address),
      getSolanaPositions(input.address),
      getRecentTransactions(input.address, input.txn_limit),
    ]);

    const flags: string[] = [];
    if (portfolio && portfolio.total_usd < 100) flags.push("low_total_balance_usd");
    if (positions.length > 50) flags.push("high_token_count");
    const recentScamLooking = txns.filter((t) => t.status === "failed").length;
    if (recentScamLooking >= 3) flags.push("multiple_failed_txns");

    return {
      address: input.address,
      portfolio,
      solana_positions: positions,
      recent_transactions: txns,
      flags,
      zerion_available: zerionAvailable,
    };
  },
};
