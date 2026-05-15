use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct QuoteReq {
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount_lamports: u64,
    pub slippage_bps: Option<u16>,
}

#[derive(Debug, Serialize)]
pub struct QuoteResp {
    pub in_amount: String,
    pub out_amount: String,
    pub price_impact_pct: String,
    pub route_count: usize,
}

#[derive(Debug, Deserialize)]
pub struct SwapReq {
    pub input_mint: String,
    pub output_mint: String,
    pub in_amount_lamports: u64,
    pub max_slippage_bps: u16,
    pub use_jito: bool,
    pub jito_tip_lamports: Option<u64>,
    pub dry_run: bool,
}

#[derive(Debug, Serialize)]
pub struct SwapResp {
    pub signature: Option<String>,
    pub in_amount: u64,
    pub out_amount_estimated: u64,
    pub submitted_via: String,
    pub risk: RiskOutcome,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum RiskOutcome {
    Passed,
    Blocked { reason: String },
}

#[derive(Debug, Serialize)]
pub struct StatusResp {
    pub wallet: String,
    pub balance_sol: f64,
    pub today_spent_sol: f64,
    pub max_trade_sol: f64,
    pub daily_cap_sol: f64,
    pub drawdown_kill_pct: f64,
    pub drawdown_locked: bool,
}
