export interface HistoricalLaunch {
  mint: string;
  symbol?: string;
  name?: string;
  /** unix seconds */
  created_at: number;
  /** approx market cap in SOL at the time we fetched the listing (current, not at launch) */
  current_market_cap_sol?: number;
  /** whether the bonding curve has completed and migrated to PumpSwap */
  complete?: boolean;
}

export interface Trade {
  /** unix seconds */
  ts: number;
  sol_amount_lamports: number;
  token_amount_raw: number;
  is_buy: boolean;
  signature?: string;
  user?: string;
}

export interface PricePoint {
  ts: number;
  sol_per_token: number;
}

export interface SimulatedTrade {
  mint: string;
  symbol?: string;
  decision: "snipe" | "skip";
  skip_reason?: string;
  entry_ts?: number;
  entry_sol_per_token?: number;
  exit_ts?: number;
  exit_sol_per_token?: number;
  exit_reason?: "take_profit" | "stop_loss" | "max_hold" | "no_exit_in_window";
  /** R-multiple: how many times the at-risk SOL we made/lost */
  r_multiple?: number;
  /** raw P&L in SOL on a single position of KURO_SNIPE_SOL */
  pnl_sol?: number;
  hold_seconds?: number;
}

export interface BacktestReport {
  generated_at: number;
  policy_snapshot: {
    snipe_sol: number;
    max_slippage_bps: number;
    take_profit_pct: number;
    stop_loss_pct: number;
    max_hold_seconds: number;
  };
  total_launches: number;
  launches_with_trades: number;
  sniped: number;
  wins: number;
  losses: number;
  no_exit_in_window: number;
  total_pnl_sol: number;
  mean_r: number;
  median_hold_seconds: number;
  r_histogram: { bucket: string; count: number }[];
  trades: SimulatedTrade[];
}
