use crate::config::Config;
use anyhow::{Context, Result};
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
};
use std::{fs, path::Path};

pub struct Wallet {
    pub keypair: Keypair,
}

impl Wallet {
    pub fn load(cfg: &Config) -> Result<Self> {
        let p = Path::new(&cfg.keypair_path);
        if !p.exists() {
            tracing::warn!(
                path = %cfg.keypair_path,
                "no keypair found; generating a fresh one — fund it before swapping"
            );
            let kp = Keypair::new();
            if let Some(parent) = p.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(p, serde_json::to_string(&kp.to_bytes().to_vec())?)?;
            return Ok(Self { keypair: kp });
        }
        let raw = fs::read_to_string(p)?;
        let bytes: Vec<u8> = serde_json::from_str(&raw)?;
        let keypair = Keypair::from_bytes(&bytes).context("invalid keypair file")?;
        Ok(Self { keypair })
    }

    pub fn pubkey(&self) -> Pubkey {
        self.keypair.pubkey()
    }
}
