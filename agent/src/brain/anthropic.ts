import Anthropic from "@anthropic-ai/sdk";
import type { Brain, BrainConfig, BrainInput, BrainStep } from "./types.js";

export class AnthropicBrain implements Brain {
  name = "anthropic";
  private client = new Anthropic();
  private messages: Anthropic.MessageParam[] = [];
  private system: string;
  private tools: Anthropic.Tool[];
  private model: string;
  private max_tokens: number;

  constructor(cfg: BrainConfig) {
    this.system = cfg.system;
    this.tools = cfg.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool["input_schema"],
    }));
    this.model = cfg.model ?? process.env.KURO_MODEL ?? "claude-sonnet-4-6";
    this.max_tokens = cfg.max_tokens ?? 4096;
  }

  async step(input: BrainInput): Promise<BrainStep> {
    if (input.type === "user_text") {
      this.messages.push({ role: "user", content: input.text });
    } else {
      this.messages.push({
        role: "user",
        content: input.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.id,
          content: r.output,
          is_error: r.is_error,
        })),
      });
    }
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: this.max_tokens,
      system: this.system,
      tools: this.tools,
      messages: this.messages,
    });
    this.messages.push({ role: "assistant", content: res.content });
    return {
      text: res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n"),
      tool_calls: res.content
        .filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use")
        .map((c) => ({ id: c.id, name: c.name, arguments: c.input })),
    };
  }
}
