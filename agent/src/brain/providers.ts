/**
 * Provider registry — single source of truth for LLM provider configuration.
 *
 * Both the multi-step Brain factory (index.ts) and the single-shot Brain Agent
 * helper (oneshot.ts) resolve credentials through this Module. Adding a new
 * OpenAI-compat provider = one entry in SPECS. Auditing "what env vars does
 * kuro need" = read this file.
 *
 * Anthropic + Codex keep their own auth internals (Anthropic SDK, Codex OAuth
 * or subprocess) — the registry knows their `api_key_env` for validation but
 * does not own how they wire up. See docs/key-management.md.
 */

export type BrainKind =
  | "anthropic"
  | "openai"
  | "glm"
  | "codex"
  | "cerebras"
  | "groq";

export interface ProviderCreds {
  kind: BrainKind;
  api_key: string;
  base_url?: string;
  model: string;
  label: string;
}

interface ProviderSpec {
  kind: BrainKind;
  api_key_env: string; // "" = no key needed (codex OAuth path)
  base_url_env: string; // "" = use SDK default
  default_base_url?: string;
  default_model: string;
  /** Brain Agents (oneShotJson) require this true. Anthropic + Codex use other protocols. */
  openai_compat: boolean;
}

const SPECS: Record<BrainKind, ProviderSpec> = {
  anthropic: {
    kind: "anthropic",
    api_key_env: "ANTHROPIC_API_KEY",
    base_url_env: "",
    default_model: "claude-sonnet-4-6",
    openai_compat: false,
  },
  openai: {
    kind: "openai",
    api_key_env: "OPENAI_API_KEY",
    base_url_env: "OPENAI_BASE_URL",
    default_model: "gpt-4o-mini",
    openai_compat: true,
  },
  glm: {
    kind: "glm",
    api_key_env: "GLM_API_KEY",
    base_url_env: "GLM_BASE_URL",
    default_base_url: "https://open.bigmodel.cn/api/paas/v4/",
    default_model: "glm-4.5",
    openai_compat: true,
  },
  codex: {
    kind: "codex",
    api_key_env: "",
    base_url_env: "",
    default_model: "",
    openai_compat: false,
  },
  cerebras: {
    kind: "cerebras",
    api_key_env: "CEREBRAS_API_KEY",
    base_url_env: "CEREBRAS_BASE_URL",
    default_base_url: "https://api.cerebras.ai/v1",
    default_model: "qwen-3-32b",
    openai_compat: true,
  },
  groq: {
    kind: "groq",
    api_key_env: "GROQ_API_KEY",
    base_url_env: "GROQ_BASE_URL",
    default_base_url: "https://api.groq.com/openai/v1",
    default_model: "llama-3.3-70b-versatile",
    openai_compat: true,
  },
};

const KIND_VALUES = Object.keys(SPECS) as BrainKind[];

export function resolveBrainKind(): BrainKind {
  const v = (process.env.KURO_BRAIN ?? "glm").toLowerCase();
  if (!KIND_VALUES.includes(v as BrainKind)) {
    throw new Error(
      `unknown KURO_BRAIN: ${v} (expected: ${KIND_VALUES.join(" | ")})`,
    );
  }
  return v as BrainKind;
}

export interface ResolveOptions {
  /** Throw if the resolved provider is not OpenAI-compat (Brain Agent caller). */
  requireOpenAICompat?: boolean;
}

export function resolveProvider(
  kind?: BrainKind,
  opts: ResolveOptions = {},
): ProviderCreds {
  const k = kind ?? resolveBrainKind();
  const spec = SPECS[k];
  if (opts.requireOpenAICompat && !spec.openai_compat) {
    throw new Error(
      `Brain Agent requires an OpenAI-compat provider; '${k}' is not. ` +
        `Set KURO_BRAIN to one of: ${KIND_VALUES.filter((kk) => SPECS[kk].openai_compat).join(" | ")}.`,
    );
  }
  let api_key = "";
  if (spec.api_key_env) {
    const v = process.env[spec.api_key_env];
    if (!v) throw new Error(`KURO_BRAIN=${k} but ${spec.api_key_env} is not set`);
    api_key = v;
  }
  const base_url = spec.base_url_env
    ? process.env[spec.base_url_env] ?? spec.default_base_url
    : spec.default_base_url;
  return {
    kind: k,
    api_key,
    base_url,
    model: process.env.KURO_MODEL ?? spec.default_model,
    label: k,
  };
}

/** Used by config audits ("what's actually wired up?"). */
export function isProviderConfigured(kind: BrainKind): boolean {
  const spec = SPECS[kind];
  if (!spec.api_key_env) return true;
  return Boolean(process.env[spec.api_key_env]);
}

export function listProviderKinds(): readonly BrainKind[] {
  return KIND_VALUES;
}
