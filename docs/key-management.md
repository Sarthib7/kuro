# Key Management

Updated: 2026-05-17

## Rules

- Never commit `.env`. Already in `.gitignore`.
- `.env.example` = template only. Empty values. Commit safe.
- Keys live in `.env` locally, in Railway env vars in prod.
- Executor signing key = `./executor/keypair.json`. Gitignored. Auto-generated first run.
- Never paste keys into chat, issues, commits, or docs.
- Rotate any key that touches a screen-share or a public log.

## Loading

`agent/src/config.ts` reads `process.env` via `cfg()`. Single source of truth for env names + defaults. Never read `process.env` directly elsewhere.

## Keys by surface

| Key | Purpose | Required when |
|---|---|---|
| `SOLANA_RPC_URL` | chain RPC | always (defaults to public) |
| `KURO_BRAIN` | provider selector | always (default `glm`) |
| `GLM_API_KEY` | Zhipu GLM | `KURO_BRAIN=glm` |
| `CEREBRAS_API_KEY` | Cerebras inference | `KURO_BRAIN=cerebras` (default after Phase 1) |
| `ANTHROPIC_API_KEY` | Claude | `KURO_BRAIN=anthropic` |
| `OPENAI_API_KEY` | GPT | `KURO_BRAIN=openai` |
| `GROQ_API_KEY` | Groq fallback | when fallback active |
| `HELIUS_API_KEY` | LaserStream + enriched RPC | Phase 2 strategy upgrade |
| `BIRDEYE_API_KEY` | token metadata | enrichment |
| `JUPITER_API_KEY` | swap routing | optional, public default works |
| `KURO_EXECUTOR_URL` | brain → executor wire | always |

## Upgrade path

- Now: GLM (paid, cheap, slow).
- Phase 1 (this week): add Cerebras. Switch default once smoke-tested.
- Profit gate: Claude Sonnet 4.6 unlocked when bankroll > 5 SOL OR monthly P/L > $500 net. Premium provider only for high-stakes L3 calls — not every decision.

## Prod (Railway)

- Set env vars in Railway service config.
- Reference: `docs/production.md` for deploy steps.
- Per-user hot wallet keypair: separate volume mount, never logged.

## What NOT to do

- No `.env` in Docker image.
- No keys in `KURO_*` defaults inside `config.ts`.
- No copy-paste of keys into AI chats including this one.
- No shared keys across users in hosted runner mode.
