import { analyzeTokenSkill } from "./analyze_token.js";
import { snipeSkill } from "./snipe.js";
import { findArbSkill } from "./find_arb.js";
import { executeArbSkill } from "./execute_arb.js";
import { enrichWalletSkill } from "./enrich_wallet.js";
import { gmgnSignalSkill } from "./gmgn_signal.js";
import type { AnySkill } from "./types.js";

export const skills: Record<string, AnySkill> = {
  [analyzeTokenSkill.name]: analyzeTokenSkill as unknown as AnySkill,
  [snipeSkill.name]: snipeSkill as unknown as AnySkill,
  [findArbSkill.name]: findArbSkill as unknown as AnySkill,
  [executeArbSkill.name]: executeArbSkill as unknown as AnySkill,
  [enrichWalletSkill.name]: enrichWalletSkill as unknown as AnySkill,
  [gmgnSignalSkill.name]: gmgnSignalSkill as unknown as AnySkill,
};

export {
  analyzeTokenSkill,
  snipeSkill,
  findArbSkill,
  executeArbSkill,
  enrichWalletSkill,
  gmgnSignalSkill,
};
export type { Skill, SkillContext, AnySkill } from "./types.js";
