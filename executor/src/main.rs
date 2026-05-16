use anyhow::Result;
use axum::{
    body::Body,
    extract::State,
    http::{header::AUTHORIZATION, Request, StatusCode},
    middleware::{from_fn_with_state, Next},
    response::Response,
    routing::{get, post},
    Router,
};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use std::{net::SocketAddr, sync::Arc};
use tracing_subscriber::EnvFilter;

mod api;
mod blockhash;
mod config;
mod jito;
mod jupiter;
mod risk;
mod types;
mod wallet;

#[derive(Clone)]
pub struct AppState {
    pub cfg: Arc<config::Config>,
    pub wallet: Arc<wallet::Wallet>,
    pub risk: Arc<risk::RiskState>,
    pub http: reqwest::Client,
    pub rpc: Arc<RpcClient>,
    pub blockhash: blockhash::BlockhashCache,
}

async fn require_executor_auth(
    State(cfg): State<Arc<config::Config>>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let Some(expected) = cfg.executor_api_key.as_deref() else {
        return Ok(next.run(req).await);
    };

    let bearer_ok = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .is_some_and(|token| token == expected);
    let header_ok = req
        .headers()
        .get("x-kuro-executor-key")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|token| token == expected);

    if bearer_ok || header_ok {
        Ok(next.run(req).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "kuro_executor=info,tower_http=warn".into()),
        )
        .init();

    let cfg = Arc::new(config::Config::from_env()?);
    let wallet = Arc::new(wallet::Wallet::load(&cfg)?);
    let risk = Arc::new(risk::RiskState::load_or_init(&cfg)?);

    let http = reqwest::Client::builder()
        .pool_idle_timeout(std::time::Duration::from_secs(90))
        .tcp_keepalive(std::time::Duration::from_secs(30))
        .timeout(std::time::Duration::from_secs(20))
        .build()?;
    let rpc = Arc::new(RpcClient::new_with_commitment(
        cfg.rpc_url.clone(),
        CommitmentConfig::confirmed(),
    ));
    let blockhash = blockhash::BlockhashCache::new();
    blockhash::spawn_refresher(blockhash.clone(), rpc.clone());

    let state = AppState {
        cfg: cfg.clone(),
        wallet: wallet.clone(),
        risk,
        http,
        rpc,
        blockhash,
    };

    let protected_routes = Router::new()
        .route("/status", get(api::status))
        .route("/quote", post(api::quote))
        .route("/swap", post(api::swap))
        .route(
            "/phoenix/isolated_market_order",
            post(api::phoenix_isolated_market_order),
        )
        .route("/risk/reset_daily", post(api::reset_daily))
        .route_layer(from_fn_with_state(cfg.clone(), require_executor_auth));

    let app = Router::new()
        .route("/healthz", get(api::healthz))
        .merge(protected_routes)
        .with_state(state);

    let addr: SocketAddr = cfg.bind_addr.parse()?;
    tracing::info!(
        %addr,
        wallet = %wallet.pubkey(),
        max_trade_sol = cfg.max_trade_sol,
        daily_cap_sol = cfg.daily_cap_sol,
        phoenix_live_enabled = cfg.phoenix_live_enabled,
        "kuro-executor up"
    );
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
