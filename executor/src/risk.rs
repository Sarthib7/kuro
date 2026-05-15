use crate::config::Config;
use anyhow::Result;
use chrono::{NaiveDate, Utc};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Default, Clone, Serialize, Deserialize)]
pub struct RiskInner {
    pub day: Option<NaiveDate>,
    pub today_spent_lamports: u64,
    pub start_of_day_balance_lamports: u64,
    pub drawdown_locked: bool,
}

pub struct RiskState {
    pub state_path: String,
    pub inner: Mutex<RiskInner>,
}

impl RiskState {
    pub fn load_or_init(cfg: &Config) -> Result<Self> {
        let p = Path::new(&cfg.state_path);
        let inner = if p.exists() {
            serde_json::from_str(&fs::read_to_string(p)?).unwrap_or_default()
        } else {
            if let Some(parent) = p.parent() {
                fs::create_dir_all(parent)?;
            }
            RiskInner::default()
        };
        Ok(Self {
            state_path: cfg.state_path.clone(),
            inner: Mutex::new(inner),
        })
    }

    pub fn snapshot(&self) -> RiskInner {
        self.inner.lock().clone()
    }

    fn persist_locked(&self, inner: &RiskInner) -> Result<()> {
        fs::write(&self.state_path, serde_json::to_string_pretty(inner)?)?;
        Ok(())
    }

    fn ensure_today(&self, inner: &mut RiskInner) {
        let today = Utc::now().date_naive();
        if inner.day != Some(today) {
            inner.day = Some(today);
            inner.today_spent_lamports = 0;
            inner.drawdown_locked = false;
            inner.start_of_day_balance_lamports = 0;
        }
    }

    pub fn observe_balance(&self, balance_lamports: u64, drawdown_pct: f64) -> Result<()> {
        let mut g = self.inner.lock();
        self.ensure_today(&mut g);
        if g.start_of_day_balance_lamports == 0 {
            g.start_of_day_balance_lamports = balance_lamports;
        }
        if g.start_of_day_balance_lamports > 0 {
            let threshold = ((g.start_of_day_balance_lamports as f64)
                * (1.0 - drawdown_pct / 100.0)) as u64;
            if balance_lamports < threshold {
                g.drawdown_locked = true;
            }
        }
        let snap = g.clone();
        drop(g);
        self.persist_locked(&snap)
    }

    pub fn record_spend(&self, lamports: u64) -> Result<()> {
        let mut g = self.inner.lock();
        self.ensure_today(&mut g);
        g.today_spent_lamports = g.today_spent_lamports.saturating_add(lamports);
        let snap = g.clone();
        drop(g);
        self.persist_locked(&snap)
    }

    pub fn reset_daily(&self) -> Result<()> {
        let mut g = self.inner.lock();
        g.day = Some(Utc::now().date_naive());
        g.today_spent_lamports = 0;
        g.drawdown_locked = false;
        g.start_of_day_balance_lamports = 0;
        let snap = g.clone();
        drop(g);
        self.persist_locked(&snap)
    }
}
