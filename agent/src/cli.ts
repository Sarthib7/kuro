import "./_bootstrap.js";
import {
  analyzeTokenSkill,
  phoenixMarketsSkill,
  phoenixTraderSkill,
  phoenixSignalSkill,
  phoenixOpenPerpSkill,
} from "./skills/index.js";
import { makeConnection } from "./data/solana.js";
import { runAgent } from "./agent.js";
import { ExecutorClient } from "./data/executor.js";
import { startPoolWatcher } from "./watcher/pool_watcher.js";
import { runAutonomous } from "./autonomous/loop.js";
import { loadPositions } from "./autonomous/positions.js";
import { runBacktest, formatReport } from "./backtest/index.js";
import type { SkillContext } from "./skills/types.js";

function usage(): never {
  console.error(`usage:
  kuro analyze <mint> [--topN=10]            one-shot token analysis
  kuro agent "<prompt>"                      LLM agent with skills
  kuro watch                                 stream new pools + analyse each
  kuro autonomous                            hands-off mode: watch → score → snipe → exit
  kuro backtest [--limit=100] [--max-age-hours=72]
                                             historical replay against current policy
  kuro phoenix-markets [symbol]              read Phoenix perps market metadata
  kuro phoenix-signal <symbol> [--timeframe=1m] [--limit=120]
                                             read Phoenix candles + basic perp signal
  kuro phoenix-trader [authority]            read Phoenix trader state
  kuro phoenix-open <symbol> <side> <quantity> <collateral-usdc> [--dry-run=true]
                                             build/simulate a Phoenix isolated market order
  kuro positions                             show open + closed positions
  kuro status                                executor wallet + risk-cap status`);
  process.exit(1);
}

function flagValue(args: string[], name: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

function boolFlag(args: string[], name: string, fallback: boolean): boolean {
  const v = flagValue(args, name);
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
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

  if (cmd === "phoenix-markets") {
    const symbol = rest.find((a) => !a.startsWith("--"));
    const result = await phoenixMarketsSkill.execute({ symbol }, makeCtx());
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "phoenix-signal") {
    const symbol = rest.find((a) => !a.startsWith("--"));
    if (!symbol) usage();
    const result = await phoenixSignalSkill.execute(
      {
        symbol,
        timeframe: flagValue(rest, "timeframe") ?? "1m",
        limit: Number(flagValue(rest, "limit") ?? "120"),
        enable_external_source: boolFlag(rest, "external", false),
      },
      makeCtx(),
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "phoenix-trader") {
    const authority = rest.find((a) => !a.startsWith("--"));
    const pdaIndex = Number(flagValue(rest, "pda-index") ?? "0");
    const result = await phoenixTraderSkill.execute(
      { authority, pda_index: pdaIndex },
      makeCtx(),
    );
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "phoenix-open") {
    const positional = rest.filter((a) => !a.startsWith("--"));
    const [symbol, side, quantityArg, collateralArg] = positional;
    if (!symbol || !side || !quantityArg || !collateralArg) usage();
    const input = phoenixOpenPerpSkill.inputSchema.parse({
      symbol,
      side,
      quantity: Number(quantityArg),
      transfer_amount_usdc: Number(collateralArg),
      max_price_in_ticks: flagValue(rest, "max-price-in-ticks")
        ? Number(flagValue(rest, "max-price-in-ticks"))
        : undefined,
      pda_index: Number(flagValue(rest, "pda-index") ?? "0"),
      dry_run: boolFlag(rest, "dry-run", true),
    });
    const result = await phoenixOpenPerpSkill.execute(input, makeCtx());
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (cmd === "backtest") {
    const limitArg = rest.find((a) => a.startsWith("--limit="));
    const ageArg = rest.find((a) => a.startsWith("--max-age-hours="));
    const limit = limitArg ? Number(limitArg.split("=")[1]) : 100;
    const max_age_hours = ageArg ? Number(ageArg.split("=")[1]) : undefined;
    console.error(
      `[kuro] backtesting ${limit} recent pump.fun launches` +
        (max_age_hours ? ` (last ${max_age_hours}h)…` : "…"),
    );
    const report = await runBacktest({
      limit,
      max_age_hours,
      onProgress: (done, total) => {
        if (done % 10 === 0 || done === total) {
          process.stderr.write(`\r[kuro] simulated ${done}/${total}`);
        }
      },
    });
    process.stderr.write("\n");
    console.log(formatReport(report));
    console.log("\n--- full JSON report below ---");
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
