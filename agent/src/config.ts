/**
 * Centralised, typed view over environment configuration.
 *
 * Everywhere else in the codebase imports `cfg()` instead of touching
 * `process.env` directly — this keeps key names, defaults, and parsing in one
 * file and makes it easy to audit which env vars actually affect kuro.
 *
 * Treat the returned object as immutable.
 */

export interface KuroConfig {
  // --- chain / rpc ---
  rpcUrl: string;

  // --- brain selection ---
  brain: "glm" | "anthropic" | "openai" | "codex";
  model?: string;

  // --- brain credentials ---
  anthropicApiKey?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  glmApiKey?: string;
  glmBaseUrl: string;
  codexAuthPath?: string;
  codexMode: "oauth" | "subprocess";
  codexCmd: string;
  codexArgs: string[];

  // --- data enrichment ---
  birdeyeApiKey?: string;
  heliusApiKey?: string;
  zerionApiKey?: string;
  gmgnApiKey?: string;
  gmgnBaseUrl: string;
  jupiterApiKey?: string;
  jupiterBaseUrl?: string;
  phoenixApiUrl: string;

  // --- executor / autonomous ---
  executorUrl: string;
  autonomousLive: boolean;
  positionsPath: string;
  snipeSol: number;
  maxSlippageBps: number;
  maxTop10Pct: number;
  maxRoundTripLossPct: number;
  requireRenouncedFreeze: boolean;
  requireRenouncedMint: boolean;
  useJito: boolean;
  jitoTipSol: number;
  takeProfitPct: number;
  stopLossPct: number;
  maxHoldSeconds: number;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

function str(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

let cached: KuroConfig | undefined;

export function cfg(): KuroConfig {
  if (cached) return cached;
  const brain = (process.env.KURO_BRAIN ?? "glm").toLowerCase() as KuroConfig["brain"];
  const codexMode = (process.env.KURO_CODEX_MODE ?? "oauth").toLowerCase() as
    | "oauth"
    | "subprocess";
  cached = {
    rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com",

    brain,
    model: str("KURO_MODEL"),

    anthropicApiKey: str("ANTHROPIC_API_KEY"),
    openaiApiKey: str("OPENAI_API_KEY"),
    openaiBaseUrl: str("OPENAI_BASE_URL"),
    glmApiKey: str("GLM_API_KEY"),
    glmBaseUrl: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/",
    codexAuthPath: str("KURO_CODEX_AUTH_PATH"),
    codexMode: codexMode === "subprocess" ? "subprocess" : "oauth",
    codexCmd: process.env.KURO_CODEX_CMD ?? "codex",
    codexArgs: (process.env.KURO_CODEX_ARGS ?? "").split(/\s+/).filter(Boolean),

    birdeyeApiKey: str("BIRDEYE_API_KEY"),
    heliusApiKey: str("HELIUS_API_KEY"),
    zerionApiKey: str("ZERION_API_KEY"),
    gmgnApiKey: str("GMGN_API_KEY"),
    gmgnBaseUrl: process.env.GMGN_BASE_URL ?? "https://gmgn.ai",
    jupiterApiKey: str("JUPITER_API_KEY"),
    jupiterBaseUrl: str("JUPITER_BASE_URL"),
    phoenixApiUrl: process.env.PHOENIX_API_URL ?? "https://perp-api.phoenix.trade",

    executorUrl: process.env.KURO_EXECUTOR_URL ?? "http://127.0.0.1:7777",
    autonomousLive: bool("KURO_AUTONOMOUS_LIVE", false),
    positionsPath: process.env.KURO_POSITIONS_PATH ?? "./executor/positions.json",
    snipeSol: num("KURO_SNIPE_SOL", 0.02),
    maxSlippageBps: num("KURO_MAX_SLIPPAGE_BPS", 1500),
    maxTop10Pct: num("KURO_MAX_TOP10_PCT", 60),
    maxRoundTripLossPct: num("KURO_MAX_ROUND_TRIP_LOSS_PCT", 25),
    requireRenouncedFreeze: bool("KURO_REQUIRE_RENOUNCED_FREEZE", true),
    requireRenouncedMint: bool("KURO_REQUIRE_RENOUNCED_MINT", false),
    useJito: bool("KURO_USE_JITO", true),
    jitoTipSol: num("KURO_JITO_TIP_SOL", 0.0002),
    takeProfitPct: num("KURO_TAKE_PROFIT_PCT", 50),
    stopLossPct: num("KURO_STOP_LOSS_PCT", 30),
    maxHoldSeconds: num("KURO_MAX_HOLD_SECONDS", 600),
  };
  return cached;
}

// Reset the cache; only used by tests / hot-reload scripts.
export function _resetConfigCache(): void {
  cached = undefined;
}
