use anyhow::Result;
use std::env;

pub struct Config {
    pub bind_addr: String,
    pub rpc_url: String,
    pub jito_url: String,
    pub keypair_path: String,
    pub state_path: String,
    pub max_trade_sol: f64,
    pub daily_cap_sol: f64,
    pub drawdown_kill_pct: f64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            bind_addr: env::var("KURO_BIND").unwrap_or_else(|_| "127.0.0.1:7777".into()),
            rpc_url: env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".into()),
            jito_url: env::var("JITO_BLOCK_ENGINE_URL")
                .unwrap_or_else(|_| "https://mainnet.block-engine.jito.wtf/api/v1/bundles".into()),
            keypair_path: env::var("KURO_KEYPAIR_PATH")
                .unwrap_or_else(|_| "./executor/keypair.json".into()),
            state_path: env::var("KURO_STATE_PATH")
                .unwrap_or_else(|_| "./executor/state.json".into()),
            max_trade_sol: env::var("KURO_MAX_TRADE_SOL")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.1),
            daily_cap_sol: env::var("KURO_DAILY_CAP_SOL")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(1.0),
            drawdown_kill_pct: env::var("KURO_DRAWDOWN_KILL_PCT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(20.0),
        })
    }
}
