import type { Policy } from "../autonomous/policy.js";
import type { BacktestReport, SimulatedTrade } from "./types.js";

export function buildReport(
  trades: SimulatedTrade[],
  totalLaunches: number,
  policy: Policy,
): BacktestReport {
  const sniped = trades.filter((t) => t.decision === "snipe");
  const withExit = sniped.filter(
    (t) => t.exit_reason && t.exit_reason !== "no_exit_in_window",
  );
  const wins = withExit.filter((t) => (t.pnl_sol ?? 0) > 0);
  const losses = withExit.filter((t) => (t.pnl_sol ?? 0) <= 0);
  const noExit = sniped.filter((t) => t.exit_reason === "no_exit_in_window");

  const pnlSols = sniped.map((t) => t.pnl_sol ?? 0);
  const total_pnl_sol = pnlSols.reduce((a, b) => a + b, 0);

  const rValues = sniped
    .map((t) => t.r_multiple)
    .filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const mean_r = rValues.length ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0;

  const holds = sniped
    .map((t) => t.hold_seconds ?? 0)
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  const median_hold_seconds = holds.length ? (holds[Math.floor(holds.length / 2)] ?? 0) : 0;

  const buckets = [
    { bucket: "≤ -2R", min: -Infinity, max: -2, count: 0 },
    { bucket: "-2R to -1R", min: -2, max: -1, count: 0 },
    { bucket: "-1R to 0", min: -1, max: 0, count: 0 },
    { bucket: "0 to +1R", min: 0, max: 1, count: 0 },
    { bucket: "+1R to +2R", min: 1, max: 2, count: 0 },
    { bucket: "+2R to +5R", min: 2, max: 5, count: 0 },
    { bucket: "> +5R", min: 5, max: Infinity, count: 0 },
  ];
  for (const r of rValues) {
    for (const b of buckets) {
      if (r >= b.min && r < b.max) {
        b.count++;
        break;
      }
    }
  }

  return {
    generated_at: Math.floor(Date.now() / 1000),
    policy_snapshot: {
      snipe_sol: policy.snipe_sol,
      max_slippage_bps: policy.max_slippage_bps,
      take_profit_pct: policy.take_profit_pct,
      stop_loss_pct: policy.stop_loss_pct,
      max_hold_seconds: policy.max_hold_seconds,
    },
    total_launches: totalLaunches,
    launches_with_trades: sniped.length + noExit.length,
    sniped: sniped.length,
    wins: wins.length,
    losses: losses.length,
    no_exit_in_window: noExit.length,
    total_pnl_sol,
    mean_r,
    median_hold_seconds,
    r_histogram: buckets.map((b) => ({ bucket: b.bucket, count: b.count })),
    trades,
  };
}

export function formatReport(report: BacktestReport): string {
  const lines: string[] = [];
  const fmt = (n: number, d = 4) => n.toFixed(d);
  lines.push("=== kuro backtest report ===");
  lines.push(`generated: ${new Date(report.generated_at * 1000).toISOString()}`);
  lines.push("");
  lines.push("policy:");
  lines.push(`  snipe_sol            ${report.policy_snapshot.snipe_sol}`);
  lines.push(`  max_slippage_bps     ${report.policy_snapshot.max_slippage_bps}`);
  lines.push(`  take_profit_pct      ${report.policy_snapshot.take_profit_pct}`);
  lines.push(`  stop_loss_pct        ${report.policy_snapshot.stop_loss_pct}`);
  lines.push(`  max_hold_seconds     ${report.policy_snapshot.max_hold_seconds}`);
  lines.push("");
  lines.push("aggregate:");
  lines.push(`  total launches       ${report.total_launches}`);
  lines.push(`  with trades          ${report.launches_with_trades}`);
  lines.push(`  sniped               ${report.sniped}`);
  lines.push(`  wins                 ${report.wins}`);
  lines.push(`  losses               ${report.losses}`);
  lines.push(`  no-exit-in-window    ${report.no_exit_in_window}`);
  lines.push(`  hypothetical PnL     ${fmt(report.total_pnl_sol)} SOL`);
  lines.push(`  mean R               ${fmt(report.mean_r, 3)}`);
  lines.push(`  median hold (s)      ${report.median_hold_seconds}`);
  lines.push("");
  lines.push("R distribution:");
  const maxCount = Math.max(1, ...report.r_histogram.map((b) => b.count));
  for (const b of report.r_histogram) {
    const barLen = Math.round((b.count / maxCount) * 40);
    const bar = "█".repeat(barLen);
    lines.push(`  ${b.bucket.padEnd(14)} ${b.count.toString().padStart(4)}  ${bar}`);
  }
  return lines.join("\n");
}
