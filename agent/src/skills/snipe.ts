import { z } from "zod";
import { SOL_MINT } from "../data/jupiter.js";
import { ExecutorClient, type ExecutorSwapResp } from "../data/executor.js";
import type { Skill } from "./types.js";
import { analyzeTokenSkill } from "./analyze_token.js";

const inputSchema = z.object({
  mint: z.string().min(32).max(44),
  sol_amount: z.number().positive().max(10),
  max_slippage_bps: z.number().int().positive().max(5000),
  use_jito: z.boolean(),
  jito_tip_sol: z.number().nonnegative().max(0.05),
  dry_run: z.boolean(),
  skip_safety: z.boolean().optional(),
});

type SnipeInput = z.infer<typeof inputSchema>;

export interface SnipeResult {
  preflight: "passed" | { blocked_reason: string };
  swap?: ExecutorSwapResp;
}

export const snipeSkill: Skill<SnipeInput, SnipeResult> = {
  name: "snipe",
  description:
    "Buy `sol_amount` SOL of `mint` via the deterministic executor (Jito bundle when use_jito). Re-runs analyze_token safety gates (honeypot sim, freeze authority, route presence) unless skip_safety. Default dry_run=true.",
  inputSchema,
  async execute(input, ctx) {
    if (!input.skip_safety) {
      const analysis = await analyzeTokenSkill.execute(
        { mint: input.mint, topN: 10 },
        ctx,
      );
      if (analysis.flags.includes("sell_simulation_failed_possible_honeypot")) {
        return { preflight: { blocked_reason: "honeypot_sell_sim_failed" } };
      }
      if (analysis.flags.includes("no_jupiter_route")) {
        return { preflight: { blocked_reason: "no_route" } };
      }
      if (!analysis.authorities.freezeRenounced) {
        return { preflight: { blocked_reason: "freeze_authority_not_renounced" } };
      }
    }

    const exec = new ExecutorClient();
    const swap = await exec.swap({
      input_mint: SOL_MINT,
      output_mint: input.mint,
      in_amount_lamports: Math.floor(input.sol_amount * 1e9),
      max_slippage_bps: input.max_slippage_bps,
      use_jito: input.use_jito,
      jito_tip_lamports: Math.floor(input.jito_tip_sol * 1e9),
      dry_run: input.dry_run,
    });
    return { preflight: "passed", swap };
  },
};
