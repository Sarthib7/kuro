const DEFAULT_BASE = "http://127.0.0.1:7777";

export interface ExecutorStatus {
  wallet: string;
  balance_sol: number;
  today_spent_sol: number;
  max_trade_sol: number;
  daily_cap_sol: number;
  drawdown_kill_pct: number;
  drawdown_locked: boolean;
}

export interface ExecutorQuoteResp {
  in_amount: string;
  out_amount: string;
  price_impact_pct: string;
  route_count: number;
}

export type ExecutorRiskOutcome =
  | { status: "passed" }
  | { status: "blocked"; reason: string };

export interface ExecutorSwapResp {
  signature: string | null;
  in_amount: number;
  out_amount_estimated: number;
  submitted_via: "rpc" | "jito" | "dry_run" | "blocked";
  risk: ExecutorRiskOutcome;
}

export class ExecutorClient {
  private base: string;
  constructor(base?: string) {
    this.base = base ?? process.env.KURO_EXECUTOR_URL ?? DEFAULT_BASE;
  }

  async status(): Promise<ExecutorStatus> {
    const r = await fetch(`${this.base}/status`);
    if (!r.ok) throw new Error(`executor /status failed: ${r.status} ${await r.text()}`);
    return r.json() as Promise<ExecutorStatus>;
  }

  async quote(req: {
    input_mint: string;
    output_mint: string;
    in_amount_lamports: number;
    slippage_bps?: number;
  }): Promise<ExecutorQuoteResp> {
    const r = await fetch(`${this.base}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!r.ok) throw new Error(`executor /quote failed: ${r.status} ${await r.text()}`);
    return r.json() as Promise<ExecutorQuoteResp>;
  }

  async swap(req: {
    input_mint: string;
    output_mint: string;
    in_amount_lamports: number;
    max_slippage_bps: number;
    use_jito: boolean;
    jito_tip_lamports?: number;
    dry_run: boolean;
  }): Promise<ExecutorSwapResp> {
    const r = await fetch(`${this.base}/swap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!r.ok) throw new Error(`executor /swap failed: ${r.status} ${await r.text()}`);
    return r.json() as Promise<ExecutorSwapResp>;
  }
}
