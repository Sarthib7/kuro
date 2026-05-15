import "./_bootstrap.js";
import { analyzeTokenSkill } from "./skills/index.js";
import { makeConnection } from "./data/solana.js";
import { runAgent } from "./agent.js";
import { ExecutorClient } from "./data/executor.js";
import { startPoolWatcher } from "./watcher/pool_watcher.js";
import { runAutonomous } from "./autonomous/loop.js";
import { loadPositions } from "./autonomous/positions.js";
import type { SkillContext } from "./skills/types.js";

function usage(): never {
  console.error(`usage:
  kuro analyze <mint> [--topN=10]    one-shot token analysis
  kuro agent "<prompt>"              LLM agent with skills (Anthropic)
  kuro watch                         stream new pools + analyse each
  kuro autonomous                    full hands-off mode: watch → score → snipe → exit
  kuro positions                     show open + closed positions
  kuro status                        executor wallet + risk-cap status`);
  process.exit(1);
}

function makeCtx(): SkillContext {
  return {
    rpc: makeConnection(process.env.SOLANA_RPC_URL),
    env: process.env,
    log: (m, d) => console.error(`[kuro] ${m}`, d ?? ""),
  };
}

async function runForever() {
  await new Promise<never>(() => {});
}

async function main() {
  const [, , cmd, ...rest] = process.argv;

  if (cmd === "analyze") {
    const mint = rest[0];
    if (!mint) usage();
    const topNArg = rest.find((a) => a.startsWith("--topN="));
    const topN = topNArg ? Number(topNArg.split("=")[1]) : 10;
    const ctx = makeCtx();
    const input = analyzeTokenSkill.inputSchema.parse({ mint, topN });
    const result = await analyzeTokenSkill.execute(input, ctx);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "agent") {
    const prompt = rest.join(" ").trim();
    if (!prompt) usage();
    const { text, steps } = await runAgent(prompt);
    console.log(`\n${text}\n--- ${steps} agent step(s) ---`);
    return;
  }

  if (cmd === "watch") {
    const ctx = makeCtx();
    const handle = await startPoolWatcher(
      {
        rpcUrl: process.env.SOLANA_RPC_URL,
        async onCandidate(c, ctx) {
          console.log(JSON.stringify({ event: "new_pool", ...c }));
          if (!c.mint) return;
          try {
            const analysis = await analyzeTokenSkill.execute(
              { mint: c.mint, topN: 10 },
              ctx,
            );
            console.log(
              JSON.stringify({
                event: "analysis",
                signature: c.signature,
                mint: c.mint,
                flags: analysis.flags,
                top10_pct: Number(analysis.holders.topNPct.toFixed(2)),
              }),
            );
          } catch (e) {
            ctx.log("analyze_token failed", { mint: c.mint, err: String(e) });
          }
        },
      },
      ctx,
    );
    process.on("SIGINT", async () => {
      console.error("\n[kuro] stopping watcher...");
      await handle.stop();
      process.exit(0);
    });
    console.error("[kuro] watching for new pools. Ctrl-C to stop.");
    await runForever();
    return;
  }

  if (cmd === "autonomous") {
    const ctx = makeCtx();
    const handle = await runAutonomous(ctx);
    process.on("SIGINT", async () => {
      console.error("\n[kuro] stopping autonomous...");
      await handle.stop();
      process.exit(0);
    });
    console.error("[kuro] autonomous mode active. Ctrl-C to stop.");
    await runForever();
    return;
  }

  if (cmd === "positions") {
    console.log(JSON.stringify(loadPositions(), null, 2));
    return;
  }

  if (cmd === "status") {
    const r = await new ExecutorClient().status();
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
