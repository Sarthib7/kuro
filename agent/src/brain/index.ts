import { AnthropicBrain } from "./anthropic.js";
import { OpenAIBrain } from "./openai.js";
import { CodexBrain } from "./codex.js";
import { resolveProvider, type BrainKind } from "./providers.js";
import type { Brain, BrainConfig } from "./types.js";

export type { BrainKind } from "./providers.js";

export function makeBrain(cfg: BrainConfig): Brain {
  // All env/provider routing flows through the registry (see providers.ts).
  // Anthropic + Codex keep their own auth internals (Anthropic SDK / Codex OAuth);
  // for OpenAI-compat providers we hand ProviderCreds to OpenAIBrain.
  const p = resolveProvider();
  switch (p.kind) {
    case "anthropic":
      return new AnthropicBrain(cfg);
    case "codex":
      return new CodexBrain(cfg);
    case "openai":
    case "glm":
    case "cerebras":
    case "groq":
      return new OpenAIBrain({
        ...cfg,
        api_key: p.api_key,
        base_url: p.base_url,
        model: p.model,
        label: p.label,
      });
    default: {
      // Exhaustive check — registry adds + this switch must stay in sync.
      const _exhaustive: never = p.kind;
      throw new Error(`unhandled BrainKind: ${String(_exhaustive)}`);
    }
  }
}

export type { Brain, BrainConfig, BrainInput, BrainStep, BrainToolSpec } from "./types.js";
