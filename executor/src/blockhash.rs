use parking_lot::RwLock;
use solana_sdk::hash::Hash;
use std::sync::Arc;
use std::time::Duration;

/// Recent blockhash cached for the Jito tip tx. Refreshed every ~2s by a
/// background task so the snipe hot path never round-trips for it.
#[derive(Clone, Default)]
pub struct BlockhashCache(Arc<RwLock<Option<Hash>>>);

impl BlockhashCache {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn get(&self) -> Option<Hash> {
        *self.0.read()
    }
    pub fn set(&self, h: Hash) {
        *self.0.write() = Some(h);
    }
}

pub fn spawn_refresher(
    cache: BlockhashCache,
    rpc: Arc<solana_client::nonblocking::rpc_client::RpcClient>,
) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_millis(2000));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            tick.tick().await;
            match rpc.get_latest_blockhash().await {
                Ok(h) => cache.set(h),
                Err(e) => tracing::warn!(error = %e, "blockhash refresh failed"),
            }
        }
    });
}
