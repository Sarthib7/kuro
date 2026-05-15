import { Connection, PublicKey, type Logs } from "@solana/web3.js";
import type { SkillContext } from "../skills/types.js";

export type PoolSource =
  | "pumpfun"
  | "pumpswap"
  | "raydium_amm_v4"
  | "raydium_cpmm"
  | "meteora_dlmm";

const PROGRAMS: Record<PoolSource, PublicKey> = {
  pumpfun: new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"),
  pumpswap: new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA"),
  raydium_amm_v4: new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
  raydium_cpmm: new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"),
  meteora_dlmm: new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo"),
};

// Substrings in program logs that signal a launch / pool init.
const SIGNALS: Record<PoolSource, RegExp[]> = {
  pumpfun: [/Instruction:\s*Create/],
  pumpswap: [/Instruction:\s*CreatePool/, /Instruction:\s*InitializePool/],
  raydium_amm_v4: [/initialize2/i],
  raydium_cpmm: [/Instruction:\s*Initialize/],
  meteora_dlmm: [/Instruction:\s*InitializeLbPair/],
};

export interface PoolCandidate {
  source: PoolSource;
  signature: string;
  detected_at: number;
  mint?: string;
}

export interface WatcherHandle {
  stop: () => Promise<void>;
}

export interface WatcherOptions {
  rpcUrl?: string;
  sources?: PoolSource[];
  onCandidate: (c: PoolCandidate, ctx: SkillContext) => Promise<void>;
}

export async function startPoolWatcher(
  opts: WatcherOptions,
  ctx: SkillContext,
): Promise<WatcherHandle> {
  const conn = opts.rpcUrl ? new Connection(opts.rpcUrl, "confirmed") : ctx.rpc;
  const sources = opts.sources ?? (Object.keys(PROGRAMS) as PoolSource[]);
  const subs: number[] = [];

  for (const source of sources) {
    const programId = PROGRAMS[source];
    const signals = SIGNALS[source];
    const subId = conn.onLogs(
      programId,
      async (logs: Logs) => {
        if (logs.err) return;
        if (!signals.some((re) => logs.logs.some((l) => re.test(l)))) return;
        const mint = await tryExtractNewMint(conn, logs.signature);
        const candidate: PoolCandidate = {
          source,
          signature: logs.signature,
          detected_at: Date.now(),
          mint,
        };
        try {
          await opts.onCandidate(candidate, ctx);
        } catch (e) {
          ctx.log(`onCandidate error for ${logs.signature}`, e);
        }
      },
      "confirmed",
    );
    subs.push(subId);
    ctx.log("pool_watcher subscribed", { source, programId: programId.toBase58() });
  }

  return {
    async stop() {
      for (const id of subs) {
        try {
          await conn.removeOnLogsListener(id);
        } catch {
          // ignore
        }
      }
    },
  };
}

async function tryExtractNewMint(
  conn: Connection,
  signature: string,
): Promise<string | undefined> {
  try {
    const tx = await conn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) return undefined;
    const post = tx.meta?.postTokenBalances ?? [];
    const pre = tx.meta?.preTokenBalances ?? [];
    const preMints = new Set(pre.map((b) => b.mint));
    return post.find((b) => !preMints.has(b.mint))?.mint;
  } catch {
    return undefined;
  }
}

export const POOL_SOURCES = Object.keys(PROGRAMS) as PoolSource[];
