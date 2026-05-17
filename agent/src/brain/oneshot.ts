import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * One-shot structured-output LLM call used by Brain Agents.
 *
 * Brain Agents do single-shot classification, not multi-turn tool use, so we
 * bypass the conversational `Brain.step()` interface and talk to the OpenAI
 * SDK directly. Anthropic/Codex would need a different code path (tool_use
 * shape, not response_format); restrict to OpenAI-compat providers for V1.
 */

export interface OneShotResult<T> {
  ok: true;
  value: T;
  latency_ms: number;
  cached: false;
}
export interface OneShotError {
  ok: false;
  error: string;
  latency_ms: number;
}

interface ProviderCreds {
  api_key: string;
  base_url?: string;
  model: string;
  label: string;
}

function resolveProvider(): ProviderCreds {
  const which = (process.env.KURO_BRAIN ?? "glm").toLowerCase();
  switch (which) {
    case "cerebras": {
      const key = process.env.CEREBRAS_API_KEY;
      if (!key) throw new Error("Brain Agent: CEREBRAS_API_KEY missing");
      return {
        api_key: key,
        base_url: process.env.CEREBRAS_BASE_URL ?? "https://api.cerebras.ai/v1",
        model: process.env.KURO_MODEL ?? "qwen-3-32b",
        label: "cerebras",
      };
    }
    case "groq": {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new Error("Brain Agent: GROQ_API_KEY missing");
      return {
        api_key: key,
        base_url: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
        model: process.env.KURO_MODEL ?? "llama-3.3-70b-versatile",
        label: "groq",
      };
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("Brain Agent: OPENAI_API_KEY missing");
      return {
        api_key: key,
        base_url: process.env.OPENAI_BASE_URL,
        model: process.env.KURO_MODEL ?? "gpt-4o-mini",
        label: "openai",
      };
    }
    case "glm": {
      const key = process.env.GLM_API_KEY;
      if (!key) throw new Error("Brain Agent: GLM_API_KEY missing");
      return {
        api_key: key,
        base_url: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4/",
        model: process.env.KURO_MODEL ?? "glm-4.5",
        label: "glm",
      };
    }
    default:
      throw new Error(
        `Brain Agent: KURO_BRAIN=${which} not supported. Use cerebras | groq | openai | glm.`,
      );
  }
}

export async function oneShotJson<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<OneShotResult<T> | OneShotError> {
  const start = Date.now();
  let provider: ProviderCreds;
  try {
    provider = resolveProvider();
  } catch (e) {
    return { ok: false, error: String(e), latency_ms: Date.now() - start };
  }

  const client = new OpenAI({ apiKey: provider.api_key, baseURL: provider.base_url });
  const jsonSchema = zodToJsonSchema(opts.schema, { name: opts.schemaName, target: "openApi3" });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await client.chat.completions.create(
      {
        model: provider.model,
        max_tokens: opts.maxTokens ?? 400,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: opts.schemaName, schema: jsonSchema, strict: true },
        },
      },
      { signal: ctrl.signal },
    );
    const text = res.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    const validated = opts.schema.parse(parsed);
    return { ok: true, value: validated, latency_ms: Date.now() - start, cached: false };
  } catch (e) {
    return { ok: false, error: String(e), latency_ms: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}
