use crate::{jito, jupiter, types::*, AppState};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::json;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    message::{v0, VersionedMessage},
    pubkey::Pubkey,
    system_instruction,
    transaction::VersionedTransaction,
};
use std::str::FromStr;

pub fn err(msg: impl Into<String>) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, msg.into())
}

pub fn bad_request(msg: impl Into<String>) -> (StatusCode, String) {
    (StatusCode::BAD_REQUEST, msg.into())
}

const COMPUTE_BUDGET_PROGRAM_ID: &str = "ComputeBudget111111111111111111111111111111";
const SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";
const SPL_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const SPL_TOKEN_2022_PROGRAM_ID: &str = "TokenzQdBNbLqP5VEhdkAS6EPFQXWE2uBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const MEMO_PROGRAM_ID: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PhoenixBuildMarketOrderReq {
    authority: String,
    fee_payer: String,
    position_authority: String,
    side: String,
    symbol: String,
    quantity: f64,
    transfer_amount: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_price_in_ticks: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_base_lots: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pda_index: Option<u32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhoenixApiAccountMeta {
    pubkey: String,
    is_signer: bool,
    is_writable: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhoenixApiInstruction {
    data: Vec<u8>,
    keys: Vec<PhoenixApiAccountMeta>,
    program_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhoenixEnhancedOrderResp {
    instructions: Vec<PhoenixApiInstruction>,
    estimated_liquidation_price_usd: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct PhoenixExchangeSnapshotResp {
    exchange: PhoenixExchangeSnapshot,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhoenixExchangeSnapshot {
    program_id: String,
}

fn phoenix_url(base: &str, path: &str) -> String {
    format!(
        "{}/{}",
        base.trim_end_matches('/'),
        path.trim_start_matches('/')
    )
}

fn usdc_to_micros(amount: f64) -> Result<u64, (StatusCode, String)> {
    if !amount.is_finite() || amount <= 0.0 {
        return Err(bad_request(
            "transfer_amount_usdc must be a positive finite number",
        ));
    }
    let micros = (amount * 1_000_000.0).round();
    if micros <= 0.0 || micros > u64::MAX as f64 {
        return Err(bad_request(
            "transfer_amount_usdc is outside supported range",
        ));
    }
    Ok(micros as u64)
}

async fn phoenix_program_id(s: &AppState) -> Result<String, (StatusCode, String)> {
    if let Some(program_id) = &s.cfg.phoenix_program_id {
        return Ok(program_id.clone());
    }
    let url = phoenix_url(&s.cfg.phoenix_api_url, "/v1/exchange/snapshot");
    let snap = s
        .http
        .get(url)
        .send()
        .await
        .map_err(|e| err(format!("phoenix.snapshot send: {e}")))?
        .error_for_status()
        .map_err(|e| err(format!("phoenix.snapshot status: {e}")))?
        .json::<PhoenixExchangeSnapshotResp>()
        .await
        .map_err(|e| err(format!("phoenix.snapshot json: {e}")))?;
    Ok(snap.exchange.program_id)
}

fn allowed_phoenix_program(program_id: &str, phoenix_program_id: &str) -> bool {
    program_id == phoenix_program_id
        || program_id == COMPUTE_BUDGET_PROGRAM_ID
        || program_id == SYSTEM_PROGRAM_ID
        || program_id == SPL_TOKEN_PROGRAM_ID
        || program_id == SPL_TOKEN_2022_PROGRAM_ID
        || program_id == ASSOCIATED_TOKEN_PROGRAM_ID
        || program_id == MEMO_PROGRAM_ID
}

fn convert_phoenix_ixs(
    api_ixs: Vec<PhoenixApiInstruction>,
    phoenix_program_id: &str,
) -> Result<(Vec<Instruction>, Vec<PhoenixInstructionSummary>), (StatusCode, String)> {
    if api_ixs.is_empty() {
        return Err(err("phoenix builder returned no instructions"));
    }

    let mut saw_phoenix_program = false;
    let mut instructions = Vec::with_capacity(api_ixs.len());
    let mut summaries = Vec::with_capacity(api_ixs.len());

    for ix in api_ixs {
        if !allowed_phoenix_program(&ix.program_id, phoenix_program_id) {
            return Err(err(format!(
                "phoenix builder returned non-allowlisted program: {}",
                ix.program_id
            )));
        }
        if ix.program_id == phoenix_program_id {
            saw_phoenix_program = true;
        }
        let program_id = Pubkey::from_str(&ix.program_id)
            .map_err(|e| err(format!("parse phoenix ix program id: {e}")))?;
        let mut accounts = Vec::with_capacity(ix.keys.len());
        for key in &ix.keys {
            let pubkey = Pubkey::from_str(&key.pubkey)
                .map_err(|e| err(format!("parse phoenix ix account: {e}")))?;
            accounts.push(if key.is_writable {
                AccountMeta::new(pubkey, key.is_signer)
            } else {
                AccountMeta::new_readonly(pubkey, key.is_signer)
            });
        }
        summaries.push(PhoenixInstructionSummary {
            program_id: ix.program_id,
            key_count: ix.keys.len(),
            data_len: ix.data.len(),
        });
        instructions.push(Instruction {
            program_id,
            accounts,
            data: ix.data,
        });
    }

    if !saw_phoenix_program {
        return Err(err(
            "phoenix builder response did not include the Phoenix program",
        ));
    }

    Ok((instructions, summaries))
}

/// Liveness probe. Does NOT touch the RPC or wallet — Railway / k8s use this
/// to verify the process is up without paying for a full status query.
pub async fn healthz() -> Json<serde_json::Value> {
    Json(json!({"ok": true}))
}

pub async fn status(State(s): State<AppState>) -> Result<Json<StatusResp>, (StatusCode, String)> {
    let bal = s
        .rpc
        .get_balance(&s.wallet.pubkey())
        .await
        .map_err(|e| err(format!("rpc.get_balance: {e}")))?;
    s.risk
        .observe_balance(bal, s.cfg.drawdown_kill_pct)
        .map_err(|e| err(format!("risk.observe_balance: {e}")))?;
    let snap = s.risk.snapshot();
    Ok(Json(StatusResp {
        wallet: s.wallet.pubkey().to_string(),
        balance_sol: bal as f64 / 1e9,
        today_spent_sol: snap.today_spent_lamports as f64 / 1e9,
        max_trade_sol: s.cfg.max_trade_sol,
        daily_cap_sol: s.cfg.daily_cap_sol,
        drawdown_kill_pct: s.cfg.drawdown_kill_pct,
        drawdown_locked: snap.drawdown_locked,
        today_perp_collateral_usdc: snap.today_perp_collateral_micros as f64 / 1_000_000.0,
        max_perp_collateral_usdc: s.cfg.max_perp_collateral_usdc,
        daily_perp_collateral_usdc: s.cfg.daily_perp_collateral_usdc,
        phoenix_live_enabled: s.cfg.phoenix_live_enabled,
    }))
}

pub async fn reset_daily(State(s): State<AppState>) -> impl IntoResponse {
    match s.risk.reset_daily() {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        ),
    }
}

pub async fn quote(
    State(s): State<AppState>,
    Json(req): Json<QuoteReq>,
) -> Result<Json<QuoteResp>, (StatusCode, String)> {
    let q = jupiter::quote(
        &s.http,
        &s.cfg.jupiter_swap_api_url,
        &req.input_mint,
        &req.output_mint,
        req.in_amount_lamports,
        req.slippage_bps.unwrap_or(100),
    )
    .await
    .map_err(|e| err(format!("jupiter.quote: {e}")))?;
    Ok(Json(QuoteResp {
        in_amount: q.in_amount().to_string(),
        out_amount: q.out_amount().to_string(),
        price_impact_pct: q.price_impact_pct(),
        route_count: q.route_count(),
    }))
}

pub async fn swap(
    State(s): State<AppState>,
    Json(req): Json<SwapReq>,
) -> Result<Json<SwapResp>, (StatusCode, String)> {
    // --- risk gates (cheap, in-process) ---
    let max_lamports = (s.cfg.max_trade_sol * 1e9) as u64;
    let daily_lamports = (s.cfg.daily_cap_sol * 1e9) as u64;

    if req.in_amount_lamports > max_lamports {
        return Ok(Json(SwapResp {
            signature: None,
            in_amount: req.in_amount_lamports,
            out_amount_estimated: 0,
            submitted_via: "blocked".into(),
            risk: RiskOutcome::Blocked {
                reason: format!(
                    "per_trade_cap_exceeded: {} > {} lamports",
                    req.in_amount_lamports, max_lamports
                ),
            },
        }));
    }

    let snap = s.risk.snapshot();
    if snap.drawdown_locked {
        return Ok(Json(SwapResp {
            signature: None,
            in_amount: req.in_amount_lamports,
            out_amount_estimated: 0,
            submitted_via: "blocked".into(),
            risk: RiskOutcome::Blocked {
                reason: "drawdown_kill_switch_active".into(),
            },
        }));
    }
    if snap
        .today_spent_lamports
        .saturating_add(req.in_amount_lamports)
        > daily_lamports
    {
        return Ok(Json(SwapResp {
            signature: None,
            in_amount: req.in_amount_lamports,
            out_amount_estimated: 0,
            submitted_via: "blocked".into(),
            risk: RiskOutcome::Blocked {
                reason: format!(
                    "daily_cap_exceeded: {} spent + {} would exceed {}",
                    snap.today_spent_lamports, req.in_amount_lamports, daily_lamports
                ),
            },
        }));
    }

    // --- quote (round-trips Jupiter once) ---
    let q = jupiter::quote(
        &s.http,
        &s.cfg.jupiter_swap_api_url,
        &req.input_mint,
        &req.output_mint,
        req.in_amount_lamports,
        req.max_slippage_bps,
    )
    .await
    .map_err(|e| err(format!("jupiter.quote: {e}")))?;
    let out_est = q.out_amount();

    if req.dry_run {
        return Ok(Json(SwapResp {
            signature: None,
            in_amount: req.in_amount_lamports,
            out_amount_estimated: out_est,
            submitted_via: "dry_run".into(),
            risk: RiskOutcome::Passed,
        }));
    }

    // --- build & sign swap tx ---
    let swap_b64 = jupiter::swap_transaction_base64(
        &s.http,
        &s.cfg.jupiter_swap_api_url,
        &q,
        &s.wallet.pubkey().to_string(),
        if req.use_jito { 0 } else { 5_000 },
    )
    .await
    .map_err(|e| err(format!("jupiter.swap_transaction: {e}")))?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&swap_b64)
        .map_err(|e| err(format!("base64 decode swap tx: {e}")))?;
    let parsed: VersionedTransaction =
        bincode::deserialize(&bytes).map_err(|e| err(format!("bincode swap tx: {e}")))?;
    let swap_tx = VersionedTransaction::try_new(parsed.message, &[&s.wallet.keypair])
        .map_err(|e| err(format!("sign swap tx: {e}")))?;

    let sig = if req.use_jito {
        let tip_lamports = req.jito_tip_lamports.unwrap_or(10_000);
        let tip_account = Pubkey::from_str(jito::pick_tip_account())
            .map_err(|e| err(format!("parse tip account: {e}")))?;
        let blockhash = match s.blockhash.get() {
            Some(h) => h,
            None => s
                .rpc
                .get_latest_blockhash()
                .await
                .map_err(|e| err(format!("rpc.get_latest_blockhash: {e}")))?,
        };
        let tip_ix = system_instruction::transfer(&s.wallet.pubkey(), &tip_account, tip_lamports);
        let msg = v0::Message::try_compile(&s.wallet.pubkey(), &[tip_ix], &[], blockhash)
            .map_err(|e| err(format!("compile tip msg: {e}")))?;
        let tip_tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&s.wallet.keypair])
            .map_err(|e| err(format!("sign tip tx: {e}")))?;

        let swap_b58 = bs58::encode(
            bincode::serialize(&swap_tx).map_err(|e| err(format!("serialize swap tx: {e}")))?,
        )
        .into_string();
        let tip_b58 = bs58::encode(
            bincode::serialize(&tip_tx).map_err(|e| err(format!("serialize tip tx: {e}")))?,
        )
        .into_string();
        jito::send_bundle(&s.http, &s.cfg.jito_url, vec![swap_b58, tip_b58])
            .await
            .map_err(|e| err(format!("jito.send_bundle: {e}")))?
    } else {
        s.rpc
            .send_transaction(&swap_tx)
            .await
            .map_err(|e| err(format!("rpc.send_transaction: {e}")))?
            .to_string()
    };

    s.risk
        .record_spend(req.in_amount_lamports)
        .map_err(|e| err(format!("risk.record_spend: {e}")))?;

    Ok(Json(SwapResp {
        signature: Some(sig),
        in_amount: req.in_amount_lamports,
        out_amount_estimated: out_est,
        submitted_via: if req.use_jito {
            "jito".into()
        } else {
            "rpc".into()
        },
        risk: RiskOutcome::Passed,
    }))
}

pub async fn phoenix_isolated_market_order(
    State(s): State<AppState>,
    Json(req): Json<PhoenixMarketOrderReq>,
) -> Result<Json<PhoenixMarketOrderResp>, (StatusCode, String)> {
    let side = req.side.to_ascii_lowercase();
    if side != "bid" && side != "ask" {
        return Err(bad_request("side must be 'bid' or 'ask'"));
    }
    if req.symbol.trim().is_empty() || req.symbol.len() > 32 {
        return Err(bad_request("symbol must be non-empty and at most 32 bytes"));
    }
    if !req.quantity.is_finite() || req.quantity <= 0.0 {
        return Err(bad_request("quantity must be a positive finite number"));
    }

    let authority = s.wallet.pubkey().to_string();
    let transfer_micros = usdc_to_micros(req.transfer_amount_usdc)?;
    let max_perp_micros = (s.cfg.max_perp_collateral_usdc * 1_000_000.0) as u64;
    let daily_perp_micros = (s.cfg.daily_perp_collateral_usdc * 1_000_000.0) as u64;
    let empty_instructions = Vec::<PhoenixInstructionSummary>::new();

    if transfer_micros > max_perp_micros {
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: None,
            submitted_via: "blocked".into(),
            simulation_ok: None,
            simulation_error: None,
            simulation_logs: None,
            instructions: empty_instructions,
            risk: RiskOutcome::Blocked {
                reason: format!(
                    "per_order_perp_collateral_cap_exceeded: {} > {} micros",
                    transfer_micros, max_perp_micros
                ),
            },
        }));
    }

    let snap = s.risk.snapshot();
    if snap.drawdown_locked {
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: None,
            submitted_via: "blocked".into(),
            simulation_ok: None,
            simulation_error: None,
            simulation_logs: None,
            instructions: empty_instructions,
            risk: RiskOutcome::Blocked {
                reason: "drawdown_kill_switch_active".into(),
            },
        }));
    }
    if snap
        .today_perp_collateral_micros
        .saturating_add(transfer_micros)
        > daily_perp_micros
    {
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: None,
            submitted_via: "blocked".into(),
            simulation_ok: None,
            simulation_error: None,
            simulation_logs: None,
            instructions: empty_instructions,
            risk: RiskOutcome::Blocked {
                reason: format!(
                    "daily_perp_collateral_cap_exceeded: {} spent + {} would exceed {}",
                    snap.today_perp_collateral_micros, transfer_micros, daily_perp_micros
                ),
            },
        }));
    }
    if !req.dry_run && !s.cfg.phoenix_live_enabled {
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: None,
            submitted_via: "blocked".into(),
            simulation_ok: None,
            simulation_error: None,
            simulation_logs: None,
            instructions: empty_instructions,
            risk: RiskOutcome::Blocked {
                reason: "phoenix_live_disabled_set_KURO_PHOENIX_LIVE_ENABLED_true".into(),
            },
        }));
    }
    if !req.dry_run && s.cfg.phoenix_program_id.is_none() {
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: None,
            submitted_via: "blocked".into(),
            simulation_ok: None,
            simulation_error: None,
            simulation_logs: None,
            instructions: empty_instructions,
            risk: RiskOutcome::Blocked {
                reason: "phoenix_program_id_required_for_live".into(),
            },
        }));
    }

    let builder_req = PhoenixBuildMarketOrderReq {
        authority: authority.clone(),
        fee_payer: authority.clone(),
        position_authority: authority.clone(),
        side: side.clone(),
        symbol: req.symbol.clone(),
        quantity: req.quantity,
        transfer_amount: transfer_micros,
        max_price_in_ticks: req.max_price_in_ticks,
        num_base_lots: req.num_base_lots,
        pda_index: req.pda_index,
    };
    let url = phoenix_url(
        &s.cfg.phoenix_api_url,
        "/v1/ix/place-isolated-market-order-enhanced",
    );
    let built = s
        .http
        .post(url)
        .json(&builder_req)
        .send()
        .await
        .map_err(|e| err(format!("phoenix.place_isolated_market_order send: {e}")))?
        .error_for_status()
        .map_err(|e| err(format!("phoenix.place_isolated_market_order status: {e}")))?
        .json::<PhoenixEnhancedOrderResp>()
        .await
        .map_err(|e| err(format!("phoenix.place_isolated_market_order json: {e}")))?;

    let phoenix_program = phoenix_program_id(&s).await?;
    let (instructions, summaries) = convert_phoenix_ixs(built.instructions, &phoenix_program)?;
    let blockhash = match s.blockhash.get() {
        Some(h) => h,
        None => s
            .rpc
            .get_latest_blockhash()
            .await
            .map_err(|e| err(format!("rpc.get_latest_blockhash: {e}")))?,
    };
    let msg = v0::Message::try_compile(&s.wallet.pubkey(), &instructions, &[], blockhash)
        .map_err(|e| err(format!("compile phoenix tx msg: {e}")))?;
    let tx = VersionedTransaction::try_new(VersionedMessage::V0(msg), &[&s.wallet.keypair])
        .map_err(|e| err(format!("sign phoenix tx: {e}")))?;

    let simulation = s
        .rpc
        .simulate_transaction(&tx)
        .await
        .map_err(|e| err(format!("rpc.simulate_transaction: {e}")))?;
    let simulation_logs = simulation.value.logs;
    if let Some(sim_err) = simulation.value.err {
        let simulation_error = Some(format!("{sim_err:?}"));
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: built.estimated_liquidation_price_usd,
            submitted_via: if req.dry_run {
                "dry_run".into()
            } else {
                "blocked".into()
            },
            simulation_ok: Some(false),
            simulation_error,
            simulation_logs,
            instructions: summaries,
            risk: RiskOutcome::Blocked {
                reason: "simulation_failed".into(),
            },
        }));
    }

    if req.dry_run {
        return Ok(Json(PhoenixMarketOrderResp {
            signature: None,
            authority,
            symbol: req.symbol,
            side,
            quantity: req.quantity,
            transfer_amount_usdc: req.transfer_amount_usdc,
            estimated_liquidation_price_usd: built.estimated_liquidation_price_usd,
            submitted_via: "dry_run".into(),
            simulation_ok: Some(true),
            simulation_error: None,
            simulation_logs,
            instructions: summaries,
            risk: RiskOutcome::Passed,
        }));
    }

    let sig = s
        .rpc
        .send_transaction(&tx)
        .await
        .map_err(|e| err(format!("rpc.send_transaction phoenix: {e}")))?
        .to_string();
    s.risk
        .record_perp_collateral(transfer_micros)
        .map_err(|e| err(format!("risk.record_perp_collateral: {e}")))?;

    Ok(Json(PhoenixMarketOrderResp {
        signature: Some(sig),
        authority,
        symbol: req.symbol,
        side,
        quantity: req.quantity,
        transfer_amount_usdc: req.transfer_amount_usdc,
        estimated_liquidation_price_usd: built.estimated_liquidation_price_usd,
        submitted_via: "rpc".into(),
        simulation_ok: Some(true),
        simulation_error: None,
        simulation_logs,
        instructions: summaries,
        risk: RiskOutcome::Passed,
    }))
}
