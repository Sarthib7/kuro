import { promises as fs } from "node:fs";
import path from "node:path";
import type { Signal } from "./signals.js";

/**
 * SignalCache — per-Brain-Agent L1 exact-match cache with TTL + PnL-driven eviction.
 *
 * Per ADR-0006: L2 Hamming-probe was specced for the autonomous-loop state-word
 * (packed price/liq/age bits), not per-agent inputs (creator pubkeys, name+ticker
 * hashes). For V1, agents use L1 only. Add L2 to a separate decide()-output cache
 * when that lands.
 *
 * Key is a bigint derived by the caller (e.g., FNV-64 of input). Caller is
 * responsible for incorporating a regime_tag if the cached judgment is
 * time-sensitive (narrative themes drift weekly).
 *
 * PnL feedback is the only thing that keeps a cache from compounding losses —
 * see docs/adr/0006-brain-speed-three-tier-cache.md.
 */

export interface CachedSignal<T extends Signal> {
  signal: T;
  created_at: number;
  uses: number;
  wins: number;        // pnl_pct > 0
  pnl_sum_pct: number; // running sum of pnl_pct
  last_used_at: number;
}

export interface SignalCacheOptions {
  agent: string;
  ttl_ms: number;
  min_uses_before_eviction: number;
  min_win_rate: number; // 0-1; below this after min_uses → evict
  statePath: string;
}

export class SignalCache<T extends Signal> {
  private store = new Map<bigint, CachedSignal<T>>();
  private dirty = false;
  constructor(private readonly opts: SignalCacheOptions) {}

  get(key: bigint): T | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (Date.now() - e.created_at > this.opts.ttl_ms) {
      this.store.delete(key);
      this.dirty = true;
      return undefined;
    }
    e.uses += 1;
    e.last_used_at = Date.now();
    this.dirty = true;
    return { ...e.signal, cached: true } as T;
  }

  set(key: bigint, signal: T): void {
    this.store.set(key, {
      signal: { ...signal, cached: false } as T,
      created_at: Date.now(),
      uses: 0,
      wins: 0,
      pnl_sum_pct: 0,
      last_used_at: Date.now(),
    });
    this.dirty = true;
  }

  /** Called by autonomous loop when a position contributed by this signal closes. */
  recordOutcome(key: bigint, pnl_pct: number): void {
    const e = this.store.get(key);
    if (!e) return;
    e.pnl_sum_pct += pnl_pct;
    if (pnl_pct > 0) e.wins += 1;
    // win-rate driven eviction
    if (e.uses >= this.opts.min_uses_before_eviction) {
      const winRate = e.wins / e.uses;
      if (winRate < this.opts.min_win_rate) this.store.delete(key);
    }
    this.dirty = true;
  }

  evictStale(): number {
    const now = Date.now();
    let n = 0;
    for (const [k, e] of this.store) {
      if (now - e.created_at > this.opts.ttl_ms) {
        this.store.delete(k);
        n += 1;
      }
    }
    if (n > 0) this.dirty = true;
    return n;
  }

  size(): number {
    return this.store.size;
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    await fs.mkdir(path.dirname(this.opts.statePath), { recursive: true });
    const rows: [string, CachedSignal<T>][] = [];
    for (const [k, v] of this.store) rows.push([k.toString(), v]);
    await fs.writeFile(this.opts.statePath, JSON.stringify({ agent: this.opts.agent, rows }, null, 2));
    this.dirty = false;
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.opts.statePath, "utf8");
      const parsed = JSON.parse(raw) as { agent: string; rows: [string, CachedSignal<T>][] };
      if (parsed.agent !== this.opts.agent) return; // wrong file
      for (const [k, v] of parsed.rows) this.store.set(BigInt(k), v);
    } catch {
      // missing or corrupt → start empty
    }
  }
}

/** FNV-1a 64-bit hash. Stable, no deps, ~100ns/call. Good enough for cache keys. */
export function fnv1a64(input: string | Uint8Array): bigint {
  const bytes = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= BigInt(bytes[i]!);
    h = (h * prime) & mask;
  }
  return h;
}

/** Convenience: regime tag = ISO week-of-year, useful for caches whose judgment drifts weekly. */
export function weekOfYearRegime(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}W${week.toString().padStart(2, "0")}`;
}
