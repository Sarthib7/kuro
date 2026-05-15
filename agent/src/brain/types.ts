export interface BrainToolSpec {
  name: string;
  description: string;
  input_schema: unknown;
}

export interface BrainToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface BrainStep {
  text: string;
  tool_calls: BrainToolCall[];
}

export type BrainInput =
  | { type: "user_text"; text: string }
  | {
      type: "tool_results";
      results: { id: string; output: string; is_error?: boolean }[];
    };

export interface BrainConfig {
  system: string;
  tools: BrainToolSpec[];
  model?: string;
  max_tokens?: number;
}

export interface Brain {
  name: string;
  step(input: BrainInput): Promise<BrainStep>;
}
