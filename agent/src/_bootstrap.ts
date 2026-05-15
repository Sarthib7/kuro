import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Load the repo-root .env first, then an optional agent/.env as override.
// This lets the user keep a single .env at the repo root and still run scripts
// from inside agent/ via `npm run …`.
const here = path.dirname(fileURLToPath(import.meta.url));
const repoEnv = path.resolve(here, "../../.env");
const agentEnv = path.resolve(here, "..", ".env");

if (fs.existsSync(repoEnv)) config({ path: repoEnv });
if (fs.existsSync(agentEnv)) config({ path: agentEnv, override: true });
