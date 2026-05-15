import "./_bootstrap.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { skills } from "./skills/index.js";
import { makeConnection } from "./data/solana.js";
import { makeBrain, type BrainInput, type BrainToolSpec } from "./brain/index.js";
import type { SkillContext } from "./skills/types.js";

const MAX_STEPS = 10;

const SYSTEM = `You are kuro, an autonomous Solana trading agent.

Workflow rules — non-negotiable:
- ALWAYS call analyze_token before recommending or sniping any mint.
- Default snipe.dry_run=true and execute_arb.dry_run=true. Only set dry_run=false if the user has explicitly authorised a live trade in this turn.
- If analyze_token flags include 'sell_simulation_failed_possible_honeypot', 'freeze_authority_not_renounced', or top-10 holders > 50%, refuse to snipe and explain.
- The Rust executor enforces per-trade / per-day / drawdown caps. Don't try to bypass them.
- find_arb is exploratory; only call execute_arb when edge_bps is meaningful AND the user has authorised it.

Be terse. Report results, not narration.`;

export interface AgentRun {
  text: string;
  steps: number;
  brain: string;
}

export async function runAgent(prompt: string): Promise<AgentRun> {
  const ctx: SkillContext = {
    rpc: makeConnection(process.env.SOLANA_RPC_URL),
    env: process.env,
    log: (m, d) => console.error(`[kuro] ${m}`, d ?? ""),
  };

  const toolSpecs: BrainToolSpec[] = Object.values(skills).map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: zodToJsonSchema(s.inputSchema, { target: "openApi3" }),
  }));

  const brain = makeBrain({ system: SYSTEM, tools: toolSpecs });
  let nextInput: BrainInput = { type: "user_text", text: prompt };

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await brain.step(nextInput);
    if (res.tool_calls.length === 0) {
      return { text: res.text, steps: step + 1, brain: brain.name };
    }
    const results = await Promise.all(
      res.tool_calls.map(async (tc) => {
        const skill = skills[tc.name];
        try {
          if (!skill) throw new Error(`unknown skill: ${tc.name}`);
          const input = skill.inputSchema.parse(tc.arguments);
          const output = await skill.execute(input, ctx);
          return { id: tc.id, output: JSON.stringify(output) };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return { id: tc.id, output: `error: ${msg}`, is_error: true };
        }
      }),
    );
    nextInput = { type: "tool_results", results };
  }
  return { text: "[agent stopped: max_steps reached]", steps: MAX_STEPS, brain: brain.name };
}
