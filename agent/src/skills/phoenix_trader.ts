import { z } from "zod";
import { ExecutorClient } from "../data/executor.js";
import { getPhoenixTraderState, type PhoenixTraderState } from "../data/phoenix.js";
import type { Skill } from "./types.js";

const inputSchema = z.object({
  authority: z.string().min(32).max(44).optional(),
  pda_index: z.number().int().nonnegative().max(255).optional(),
});

type PhoenixTraderInput = z.infer<typeof inputSchema>;

export interface PhoenixTraderResult {
  authority: string;
  state: PhoenixTraderState;
}

export const phoenixTraderSkill: Skill<PhoenixTraderInput, PhoenixTraderResult> = {
  name: "phoenix_trader",
  description:
    "Read-only Phoenix trader state: collateral, risk tier, positions, orders, and TP/SL prices. If authority is omitted, uses the executor wallet.",
  inputSchema,
  async execute(input) {
    const authority = input.authority ?? (await new ExecutorClient().status()).wallet;
    const state = await getPhoenixTraderState(authority, input.pda_index ?? 0);
    return { authority, state };
  },
};
