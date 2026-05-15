import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type {
  Brain,
  BrainConfig,
  BrainInput,
  BrainStep,
  BrainToolSpec,
} from "./types.js";

interface CodexAuthFile {
  tokens?: {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
  };
  OPENAI_API_KEY?: string | null;
}

type ResponsesInputItem =
  | {
      type: "message";
      role: "user" | "assistant" | "system";
      content: Array<{ type: "input_text" | "output_text"; text: string }>;
    }
  | { type: "function_call_output"; call_id: string; output: string }
  | {
      type: "function_call";
      call_id: string;
      name: string;
      arguments: string;
    };

const DEFAULT_AUTH_PATH = join(homedir(), ".codex", "auth.json");

/**
 * Reuses your `codex login` OAuth tokens (from ~/.codex/auth.json) to call the
 * OpenAI Responses API directly — same pattern Pi / OpenClaw / Hermes-style
 * runners use to piggyback on a Codex/ChatGPT subscription. Native function-
 * calling, no subprocess.
 *
 * Modes (`KURO_CODEX_MODE`):
 *   - "oauth"      (default) — Responses API w/ Bearer access_token
 *   - "subprocess" — fallback: spawn `codex exec` and parse <<TOOL>> markers
 *
 * On 401: re-run `codex login` (the CLI auto-refreshes; we don't).
 */
export class CodexBrain implements Brain {
  name = "codex";
  private mode: "oauth" | "subprocess";
  private authPath: string;
  private model: string;
  private system: string;

  // OAuth-mode state
  private input: ResponsesInputItem[] = [];
  private responsesTools: Array<{
    type: "function";
    name: string;
    description: string;
    parameters: unknown;
  }>;

  // Subprocess-mode state
  private cmd: string;
  private extraArgs: string[];
  private subprocessHistory: string[] = [];
  private subprocessSystem: string;

  constructor(cfg: BrainConfig) {
    const modeEnv = (process.env.KURO_CODEX_MODE ?? "oauth").toLowerCase();
    this.mode = modeEnv === "subprocess" ? "subprocess" : "oauth";
    this.authPath = process.env.KURO_CODEX_AUTH_PATH ?? DEFAULT_AUTH_PATH;
    this.system = cfg.system;
    this.model = cfg.model ?? process.env.KURO_MODEL ?? "gpt-5-codex";

    this.responsesTools = cfg.tools.map((t) => ({
      type: "function" as const,
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    }));

    this.cmd = process.env.KURO_CODEX_CMD ?? "codex";
    this.extraArgs = (process.env.KURO_CODEX_ARGS ?? "")
      .split(/\s+/)
      .filter(Boolean);
    this.subprocessSystem = `${cfg.system}

You have access to these skills:
${formatTools(cfg.tools)}

When you want to call a skill, output a line in EXACTLY this format and nothing else on that line:
<<TOOL>>{"id":"unique","name":"<skill>","arguments":{...}}<<END>>

Multiple calls per turn allowed (one per line). Final answer = plain text without markers.`;
  }

  async step(input: BrainInput): Promise<BrainStep> {
    return this.mode === "oauth" ? this.stepOAuth(input) : this.stepSubprocess(input);
  }

  // ---------- OAuth / Responses API ----------
  private async stepOAuth(input: BrainInput): Promise<BrainStep> {
    if (input.type === "user_text") {
      this.input.push({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: input.text }],
      });
    } else {
      for (const r of input.results) {
        this.input.push({
          type: "function_call_output",
          call_id: r.id,
          output: r.output,
        });
      }
    }

    const auth = await this.loadAuth();
    const client = new OpenAI({
      apiKey: auth.access_token,
      defaultHeaders: {
        ...(auth.account_id ? { "chatgpt-account-id": auth.account_id } : {}),
        originator: "kuro",
      },
    });

    // openai sdk >=4.55 exposes responses.create; type-assert minimally.
    const responses = (
      client as unknown as {
        responses: {
          create: (params: unknown) => Promise<{
            output?: Array<Record<string, unknown>>;
            error?: { message: string };
          }>;
        };
      }
    ).responses;

    const res = await responses.create({
      model: this.model,
      instructions: this.system,
      input: this.input,
      tools: this.responsesTools,
      store: false,
    });

    if (res.error) throw new Error(`Codex Responses API: ${res.error.message}`);

    const items = res.output ?? [];
    const textParts: string[] = [];
    const tool_calls: BrainStep["tool_calls"] = [];

    for (const item of items) {
      const t = item["type"] as string | undefined;
      if (t === "message") {
        const content = item["content"] as
          | Array<{ type: string; text: string }>
          | undefined;
        for (const c of content ?? []) {
          if (c.type === "output_text" || c.type === "summary_text") {
            textParts.push(c.text);
          }
        }
        this.input.push({
          type: "message",
          role: "assistant",
          content: (content ?? [])
            .filter((c) => c.type === "output_text")
            .map((c) => ({ type: "output_text" as const, text: c.text })),
        });
      } else if (t === "function_call") {
        const call_id = String(item["call_id"] ?? item["id"] ?? "");
        const name = String(item["name"] ?? "");
        const argsRaw = String(item["arguments"] ?? "{}");
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(argsRaw);
        } catch {
          // leave as {}
        }
        tool_calls.push({ id: call_id, name, arguments: parsed });
        this.input.push({
          type: "function_call",
          call_id,
          name,
          arguments: argsRaw,
        });
      }
    }

    return { text: textParts.join("\n"), tool_calls };
  }

  private async loadAuth(): Promise<{
    access_token: string;
    account_id?: string;
  }> {
    let raw: string;
    try {
      raw = await readFile(this.authPath, "utf-8");
    } catch {
      throw new Error(
        `Codex auth file not found at ${this.authPath}. Run \`codex login\` first, or set KURO_CODEX_MODE=subprocess for the CLI fallback.`,
      );
    }
    const parsed = JSON.parse(raw) as CodexAuthFile;
    const access_token = parsed.tokens?.access_token;
    if (!access_token) {
      throw new Error(
        `No access_token in ${this.authPath}. Re-run \`codex login\` to refresh.`,
      );
    }
    return { access_token, account_id: parsed.tokens?.account_id };
  }

  // ---------- Subprocess fallback ----------
  private async stepSubprocess(input: BrainInput): Promise<BrainStep> {
    const userMsg =
      input.type === "user_text"
        ? input.text
        : `Previous tool results:\n${input.results
            .map((r) => `[${r.id}${r.is_error ? " ERROR" : ""}]\n${r.output}`)
            .join("\n\n")}`;
    this.subprocessHistory.push(`USER:\n${userMsg}`);

    const prompt = [
      `SYSTEM:\n${this.subprocessSystem}`,
      ...this.subprocessHistory,
      "ASSISTANT:",
    ].join("\n\n");

    const out = await runCodexSubprocess(this.cmd, this.extraArgs, prompt);
    this.subprocessHistory.push(`ASSISTANT:\n${out}`);
    return parseToolMarkers(out);
  }
}

function formatTools(tools: BrainToolSpec[]): string {
  return tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  arguments-schema: ${JSON.stringify(
          t.input_schema,
        )}`,
    )
    .join("\n");
}

const TOOL_RE = /<<TOOL>>(\{[\s\S]*?\})<<END>>/g;

function parseToolMarkers(text: string): BrainStep {
  const tool_calls: BrainStep["tool_calls"] = [];
  let m: RegExpExecArray | null;
  while ((m = TOOL_RE.exec(text)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (obj && typeof obj === "object" && typeof obj["name"] === "string") {
        tool_calls.push({
          id:
            typeof obj["id"] === "string"
              ? (obj["id"] as string)
              : `call_${tool_calls.length}`,
          name: obj["name"] as string,
          arguments: obj["arguments"] ?? {},
        });
      }
    } catch {
      // malformed marker — ignore
    }
  }
  return { text: text.replace(TOOL_RE, "").trim(), tool_calls };
}

function runCodexSubprocess(
  cmd: string,
  extraArgs: string[],
  prompt: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, ["exec", ...extraArgs], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", (e) =>
      reject(
        new Error(
          `spawn ${cmd}: ${e.message} — is the codex CLI installed and on PATH?`,
        ),
      ),
    );
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr || stdout}`));
      else resolve(stdout);
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}
