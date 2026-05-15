import { z } from "zod";
import { getQuote, SOL_MINT, USDC_MINT } from "../data/jupiter.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  mint: z.string().min(32).max(44),
  size_sol: z.number().positive().max(10),
  min_edge_bps: z.number().int().nonnegative().max(1000),
});

type FindArbInput = z.infer<typeof inputSchema>;

export interface ArbLeg {
  input_mint: string;
  output_mint: string;
  in_amount_lamports: number;
  out_amount: string;
}

export interface ArbOpportunity {
  path: string;
  in_sol: number;
  out_sol_estimated: number;
  edge_bps: number;
  legs: ArbLeg[];
}

export interface FindArbResult {
  checked_paths: string[];
  best?: ArbOpportunity;
  candidates: ArbOpportunity[];
}

export const findArbSkill: Skill<FindArbInput, FindArbResult> = {
  name: "find_arb",
  description:
    "Search SOL → mint → USDC → SOL for a positive-edge triangle using Jupiter quotes. NOTE: end-to-end Jupiter routing already arbitrages itself, so edges found here are typically rounding-level. For real edges query direct pool quotes (Raydium/Orca/Meteora SDK) per leg.",
  inputSchema,
  async execute(input) {
    const inLamports = BigInt(Math.floor(input.size_sol * 1e9));
    const candidates: ArbOpportunity[] = [];

    const leg1 = await getQuote({ inputMint: SOL_MINT, outputMint: input.mint, amount: inLamports });
    if (leg1 && BigInt(leg1.outAmount) > 0n) {
      const leg2 = await getQuote({
        inputMint: input.mint,
        outputMint: USDC_MINT,
        amount: BigInt(leg1.outAmount),
      });
      if (leg2 && BigInt(leg2.outAmount) > 0n) {
        const leg3 = await getQuote({
          inputMint: USDC_MINT,
          outputMint: SOL_MINT,
          amount: BigInt(leg2.outAmount),
        });
        if (leg3) {
          const outSol = Number(leg3.outAmount) / 1e9;
          const edgeBps = Math.round(((outSol - input.size_sol) / input.size_sol) * 10000);
          if (edgeBps >= input.min_edge_bps) {
            candidates.push({
              path: "SOL -> mint -> USDC -> SOL",
              in_sol: input.size_sol,
              out_sol_estimated: outSol,
              edge_bps: edgeBps,
              legs: [
                {
                  input_mint: SOL_MINT,
                  output_mint: input.mint,
                  in_amount_lamports: Number(inLamports),
                  out_amount: leg1.outAmount,
                },
                {
                  input_mint: input.mint,
                  output_mint: USDC_MINT,
                  in_amount_lamports: Number(leg1.outAmount),
                  out_amount: leg2.outAmount,
                },
                {
                  input_mint: USDC_MINT,
                  output_mint: SOL_MINT,
                  in_amount_lamports: Number(leg2.outAmount),
                  out_amount: leg3.outAmount,
                },
              ],
            });
          }
        }
      }
    }

    const best = candidates.sort((a, b) => b.edge_bps - a.edge_bps)[0];
    return {
      checked_paths: ["SOL -> mint -> USDC -> SOL"],
      best,
      candidates,
    };
  },
};
