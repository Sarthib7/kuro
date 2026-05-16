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
    pub today_perp_collateral_usdc: f64,
    pub max_perp_collateral_usdc: f64,
    pub daily_perp_collateral_usdc: f64,
    pub phoenix_live_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct PhoenixMarketOrderReq {
    pub symbol: String,
    pub side: String,
    pub quantity: f64,
    pub transfer_amount_usdc: f64,
    pub max_price_in_ticks: Option<u64>,
    pub num_base_lots: Option<u64>,
    pub pda_index: Option<u32>,
    pub dry_run: bool,
}

#[derive(Debug, Serialize)]
pub struct PhoenixInstructionSummary {
    pub program_id: String,
    pub key_count: usize,
    pub data_len: usize,
}

#[derive(Debug, Serialize)]
pub struct PhoenixMarketOrderResp {
    pub signature: Option<String>,
    pub authority: String,
    pub symbol: String,
    pub side: String,
    pub quantity: f64,
    pub transfer_amount_usdc: f64,
    pub estimated_liquidation_price_usd: Option<f64>,
    pub submitted_via: String,
    pub simulation_ok: Option<bool>,
    pub simulation_error: Option<String>,
    pub simulation_logs: Option<Vec<String>>,
    pub instructions: Vec<PhoenixInstructionSummary>,
    pub risk: RiskOutcome,
}
