import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { resolveProvider } from "./providers.js";

/**
 * One-shot structured-output LLM call used by Brain Agents.
 *
 * Brain Agents do single-shot classification, not multi-turn tool use, so we
 * bypass the conversational `Brain.step()` interface and talk to the OpenAI
 * SDK directly. Provider resolution flows through the registry (providers.ts)
 * which enforces openai_compat at call time.
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

export async function oneShotJson<T>(opts: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<OneShotResult<T> | OneShotError> {
  const start = Date.now();
  let provider;
  try {
    provider = resolveProvider(undefined, { requireOpenAICompat: true });
  } catch (e) {
    return { ok: false, error: String(e), latency_ms: Date.now() - start };
  }
  if (!provider.api_key) {
    return { ok: false, error: "Brain Agent: provider api_key empty", latency_ms: Date.now() - start };
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
