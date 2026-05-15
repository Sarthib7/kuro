use crate::{jito, jupiter, types::*, AppState};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use base64::Engine;
use serde_json::json;
use solana_sdk::{
    message::{v0, VersionedMessage},
    pubkey::Pubkey,
    system_instruction,
    transaction::VersionedTransaction,
};
use std::str::FromStr;

pub fn err(msg: impl Into<String>) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, msg.into())
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
    }))
}

pub async fn reset_daily(State(s): State<AppState>) -> impl IntoResponse {
    match s.risk.reset_daily() {
        Ok(()) => (StatusCode::OK, Json(json!({"ok": true}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))),
    }
}

pub async fn quote(
    State(s): State<AppState>,
    Json(req): Json<QuoteReq>,
) -> Result<Json<QuoteResp>, (StatusCode, String)> {
    let q = jupiter::quote(
        &s.http,
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
    let swap_tx =
        VersionedTransaction::try_new(parsed.message, &[&s.wallet.keypair])
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
        submitted_via: if req.use_jito { "jito".into() } else { "rpc".into() },
        risk: RiskOutcome::Passed,
    }))
}
