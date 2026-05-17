import { AnthropicBrain } from "./anthropic.js";
import { OpenAIBrain } from "./openai.js";
import { CodexBrain } from "./codex.js";
import type { Brain, BrainConfig } from "./types.js";

export type BrainKind = "anthropic" | "openai" | "glm" | "codex" | "cerebras" | "groq";

export function makeBrain(cfg: BrainConfig): Brain {
  const which = (process.env.KURO_BRAIN ?? "glm").toLowerCase() as BrainKind;

  switch (which) {
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("KURO_BRAIN=anthropic but ANTHROPIC_API_KEY is not set");
      }
      return new AnthropicBrain(cfg);
    }

    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("KURO_BRAIN=openai but OPENAI_API_KEY is not set");
      return new OpenAIBrain({
        ...cfg,
        api_key: key,
        base_url: process.env.OPENAI_BASE_URL,
        model: process.env.KURO_MODEL ?? "gpt-4o",
        label: "openai",
      });
    }

    case "glm": {
      const key = process.env.GLM_API_KEY;
      if (!key) throw new Error("KURO_BRAIN=glm but GLM_API_KEY is not set");
      return new OpenAIBrain({
        ...cfg,
        api_key: key,
        base_url:
          process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/",
        model: process.env.KURO_MODEL ?? "glm-4.5",
        label: "glm",
      });
    }

    case "cerebras": {
      const key = process.env.CEREBRAS_API_KEY;
      if (!key) throw new Error("KURO_BRAIN=cerebras but CEREBRAS_API_KEY is not set");
      return new OpenAIBrain({
        ...cfg,
        api_key: key,
        base_url: process.env.CEREBRAS_BASE_URL ?? "https://api.cerebras.ai/v1",
        model: process.env.KURO_MODEL ?? "qwen-3-32b",
        label: "cerebras",
      });
    }

    case "groq": {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("KURO_BRAIN=groq but GROQ_API_KEY is not set");
      return new OpenAIBrain({
        ...cfg,
        api_key: key,
        base_url: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
        model: process.env.KURO_MODEL ?? "llama-3.3-70b-versatile",
        label: "groq",
      });
    }

    case "codex": {
      return new CodexBrain(cfg);
    }

    default:
      throw new Error(
        `unknown KURO_BRAIN: ${which} (expected: anthropic | openai | glm | codex | cerebras | groq)`,
      );
  }
}

export type { Brain, BrainConfig, BrainInput, BrainStep, BrainToolSpec } from "./types.js";
