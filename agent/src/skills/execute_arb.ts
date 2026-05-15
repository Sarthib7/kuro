import { z } from "zod";
import { ExecutorClient, type ExecutorSwapResp } from "../data/executor.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  legs: z
    .array(
      z.object({
        input_mint: z.string(),
        output_mint: z.string(),
        in_amount_lamports: z.number().int().positive(),
      }),
    )
    .min(2)
    .max(4),
  max_slippage_bps: z.number().int().positive().max(500),
  dry_run: z.boolean(),
});

type ExecuteArbInput = z.infer<typeof inputSchema>;

export interface ExecuteArbResult {
  leg_results: ExecutorSwapResp[];
  aborted_at?: number;
}

export const executeArbSkill: Skill<ExecuteArbInput, ExecuteArbResult> = {
  name: "execute_arb",
  description:
    "Execute an arbitrage path leg-by-leg through the executor. Aborts on the first leg that's risk-blocked or fails. Sequential execution is only safe for slow/illiquid arb; competitive arb needs atomic bundling.",
  inputSchema,
  async execute(input) {
    const exec = new ExecutorClient();
    const results: ExecutorSwapResp[] = [];
    for (let i = 0; i < input.legs.length; i++) {
      const leg = input.legs[i]!;
      const r = await exec.swap({
        ...leg,
        max_slippage_bps: input.max_slippage_bps,
        use_jito: false,
        dry_run: input.dry_run,
      });
      results.push(r);
      if (r.risk.status === "blocked") return { leg_results: results, aborted_at: i };
      if (r.submitted_via !== "dry_run" && !r.signature)
        return { leg_results: results, aborted_at: i };
    }
    return { leg_results: results };
  },
};
