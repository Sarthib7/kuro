use anyhow::{anyhow, Result};
use serde::Serialize;
use serde_json::Value;

fn endpoint(base: &str, path: &str) -> String {
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub struct JupQuote(pub Value);

impl JupQuote {
    pub fn in_amount(&self) -> u64 {
        self.0
            .get("inAmount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    }
    pub fn out_amount(&self) -> u64 {
        self.0
            .get("outAmount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    }
    pub fn price_impact_pct(&self) -> String {
        self.0
            .get("priceImpactPct")
            .and_then(|v| v.as_str())
            .unwrap_or("0")
            .to_string()
    }
    pub fn route_count(&self) -> usize {
        self.0
            .get("routePlan")
            .and_then(|v| v.as_array())
            .map(|a| a.len())
            .unwrap_or(0)
    }
}

pub async fn quote(
    http: &reqwest::Client,
    swap_api_base: &str,
    input_mint: &str,
    output_mint: &str,
    amount: u64,
    slippage_bps: u16,
) -> Result<JupQuote> {
    let url = reqwest::Url::parse_with_params(
        &endpoint(swap_api_base, "quote"),
        &[
            ("inputMint", input_mint),
            ("outputMint", output_mint),
            ("amount", &amount.to_string()),
            ("slippageBps", &slippage_bps.to_string()),
            ("onlyDirectRoutes", "false"),
        ],
    )?;
    let v: Value = http
        .get(url)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(JupQuote(v))
}

#[derive(Serialize)]
struct SwapBody<'a> {
    #[serde(rename = "quoteResponse")]
    quote_response: &'a Value,
    #[serde(rename = "userPublicKey")]
    user_public_key: String,
    #[serde(rename = "wrapAndUnwrapSol")]
    wrap_and_unwrap_sol: bool,
    #[serde(rename = "dynamicComputeUnitLimit")]
    dynamic_compute_unit_limit: bool,
    #[serde(rename = "prioritizationFeeLamports")]
    prioritization_fee_lamports: u64,
}

pub async fn swap_transaction_base64(
    http: &reqwest::Client,
    swap_api_base: &str,
    quote: &JupQuote,
    user_pubkey: &str,
    priority_lamports: u64,
) -> Result<String> {
    let body = SwapBody {
        quote_response: &quote.0,
        user_public_key: user_pubkey.to_string(),
        wrap_and_unwrap_sol: true,
        dynamic_compute_unit_limit: true,
        prioritization_fee_lamports: priority_lamports,
    };
    let v: Value = http
        .post(endpoint(swap_api_base, "swap"))
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    v.get("swapTransaction")
        .and_then(|s| s.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow!("jupiter /swap missing swapTransaction in response: {v}"))
}
