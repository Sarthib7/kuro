import { analyzeTokenSkill } from "./analyze_token.js";
import { snipeSkill } from "./snipe.js";
import { findArbSkill } from "./find_arb.js";
import { executeArbSkill } from "./execute_arb.js";
import { enrichWalletSkill } from "./enrich_wallet.js";
import { gmgnSignalSkill } from "./gmgn_signal.js";
import { phoenixMarketsSkill } from "./phoenix_markets.js";
import { phoenixTraderSkill } from "./phoenix_trader.js";
import { phoenixOpenPerpSkill } from "./phoenix_open_perp.js";
import { phoenixSignalSkill } from "./phoenix_signal.js";
import type { AnySkill } from "./types.js";

export const skills: Record<string, AnySkill> = {
  [analyzeTokenSkill.name]: analyzeTokenSkill as unknown as AnySkill,
  [snipeSkill.name]: snipeSkill as unknown as AnySkill,
  [findArbSkill.name]: findArbSkill as unknown as AnySkill,
  [executeArbSkill.name]: executeArbSkill as unknown as AnySkill,
  [enrichWalletSkill.name]: enrichWalletSkill as unknown as AnySkill,
  [gmgnSignalSkill.name]: gmgnSignalSkill as unknown as AnySkill,
  [phoenixMarketsSkill.name]: phoenixMarketsSkill as unknown as AnySkill,
  [phoenixTraderSkill.name]: phoenixTraderSkill as unknown as AnySkill,
  [phoenixSignalSkill.name]: phoenixSignalSkill as unknown as AnySkill,
  [phoenixOpenPerpSkill.name]: phoenixOpenPerpSkill as unknown as AnySkill,
};

export {
  analyzeTokenSkill,
  snipeSkill,
  findArbSkill,
  executeArbSkill,
  enrichWalletSkill,
  gmgnSignalSkill,
  phoenixMarketsSkill,
  phoenixTraderSkill,
  phoenixSignalSkill,
  phoenixOpenPerpSkill,
};
export type { Skill, SkillContext, AnySkill } from "./types.js";
