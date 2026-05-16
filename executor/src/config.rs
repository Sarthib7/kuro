use anyhow::Result;
use std::env;

pub struct Config {
    pub bind_addr: String,
    pub rpc_url: String,
    pub jito_url: String,
    pub phoenix_api_url: String,
    pub phoenix_program_id: Option<String>,
    pub phoenix_live_enabled: bool,
    pub executor_api_key: Option<String>,
    pub keypair_path: String,
    pub state_path: String,
    pub max_trade_sol: f64,
    pub daily_cap_sol: f64,
    pub max_perp_collateral_usdc: f64,
    pub daily_perp_collateral_usdc: f64,
    pub drawdown_kill_pct: f64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        // In container envs (Railway, fly.io, etc.) we bind to 0.0.0.0; locally
        // we default to loopback. KURO_BIND wins, then $PORT, then a Railway
        // fallback, otherwise local loopback.
        let bind_addr = env::var("KURO_BIND").unwrap_or_else(|_| {
            if let Ok(port) = env::var("PORT") {
                format!("0.0.0.0:{}", port.trim())
            } else if env::var("RAILWAY_ENVIRONMENT").is_ok() {
                "0.0.0.0:8080".into()
            } else {
                "127.0.0.1:7777".into()
            }
        });

        // Persistent state goes under KURO_DATA_DIR if set (Railway volume mount),
        // otherwise alongside the executor binary in ./executor/. Individual
        // path overrides still win (KURO_KEYPAIR_PATH / KURO_STATE_PATH).
        let data_dir = env::var("KURO_DATA_DIR").unwrap_or_else(|_| "./executor".into());
        let phoenix_live_enabled = env::var("KURO_PHOENIX_LIVE_ENABLED")
            .map(|s| s == "1" || s.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

        Ok(Self {
            bind_addr,
            rpc_url: env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.mainnet-beta.solana.com".into()),
            jito_url: env::var("JITO_BLOCK_ENGINE_URL")
                .unwrap_or_else(|_| "https://mainnet.block-engine.jito.wtf/api/v1/bundles".into()),
            phoenix_api_url: env::var("PHOENIX_API_URL")
                .unwrap_or_else(|_| "https://perp-api.phoenix.trade".into()),
            phoenix_program_id: env::var("KURO_PHOENIX_PROGRAM_ID")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            phoenix_live_enabled,
            executor_api_key: env::var("KURO_EXECUTOR_API_KEY")
                .ok()
                .map(|s| s.trim().to_owned())
                .filter(|s| !s.is_empty()),
            keypair_path: env::var("KURO_KEYPAIR_PATH")
                .unwrap_or_else(|_| format!("{}/keypair.json", data_dir)),
            state_path: env::var("KURO_STATE_PATH")
                .unwrap_or_else(|_| format!("{}/state.json", data_dir)),
            max_trade_sol: env::var("KURO_MAX_TRADE_SOL")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.02),
            daily_cap_sol: env::var("KURO_DAILY_CAP_SOL")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.1),
            max_perp_collateral_usdc: env::var("KURO_MAX_PERP_COLLATERAL_USDC")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(25.0),
            daily_perp_collateral_usdc: env::var("KURO_DAILY_PERP_COLLATERAL_USDC")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(100.0),
            drawdown_kill_pct: env::var("KURO_DRAWDOWN_KILL_PCT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(20.0),
        })
    }
}
