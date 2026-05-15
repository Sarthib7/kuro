import type { z } from "zod";
import type { Connection } from "@solana/web3.js";

export interface SkillContext {
  rpc: Connection;
  env: NodeJS.ProcessEnv;
  log: (msg: string, data?: unknown) => void;
}

export interface Skill<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  execute(input: I, ctx: SkillContext): Promise<O>;
}

export type AnySkill = Skill<unknown, unknown>;
