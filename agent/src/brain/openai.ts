import OpenAI from "openai";
import type { Brain, BrainConfig, BrainInput, BrainStep } from "./types.js";

export interface OpenAIBrainOptions extends BrainConfig {
  api_key: string;
  base_url?: string;
  model: string;
  label?: string;
}

/**
 * OpenAI-compatible brain. Works for OpenAI, GLM (Zhipu), DeepSeek, Together,
 * Groq, vLLM-served models — anything that speaks the chat-completions schema
 * with native function-calling support.
 */
export class OpenAIBrain implements Brain {
  name: string;
  private client: OpenAI;
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  private system: string;
  private tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  private model: string;
  private max_tokens: number;

  constructor(opts: OpenAIBrainOptions) {
    this.name = opts.label ?? "openai";
    this.client = new OpenAI({
      apiKey: opts.api_key,
      baseURL: opts.base_url,
    });
    this.system = opts.system;
    this.tools = opts.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema as Record<string, unknown>,
      },
    }));
    this.model = opts.model;
    this.max_tokens = opts.max_tokens ?? 4096;
  }

  async step(input: BrainInput): Promise<BrainStep> {
    if (input.type === "user_text") {
      this.messages.push({ role: "user", content: input.text });
    } else {
      for (const r of input.results) {
        this.messages.push({
          role: "tool",
          tool_call_id: r.id,
          content: r.output,
        });
      }
    }
    const res = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.max_tokens,
      messages: [{ role: "system", content: this.system }, ...this.messages],
      tools: this.tools,
    });
    const choice = res.choices[0];
    if (!choice) throw new Error(`${this.name} brain: empty choices in response`);
    const msg = choice.message;
    this.messages.push(msg);
    return {
      text: msg.content ?? "",
      tool_calls: (msg.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: safeJsonParse(tc.function.arguments),
      })),
    };
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
