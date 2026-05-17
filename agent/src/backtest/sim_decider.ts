import type { Decider, EnrichmentBundle } from "../autonomous/decider.js";
import type { BrainAgentSeed } from "../brain/signals.js";
import type { SkillContext } from "../skills/types.js";

/**
 * SimDecider — backtest Adapter at the Decider seam.
 *
 * Returns whatever EnrichmentBundle the harness pre-recorded or synthesized
 * for the given seed (mint as the lookup key). Falls back to an empty bundle
 * — judge() then passes with reason "analysis_missing", letting the backtest
 * harness measure how often candidates would be filtered.
 *
 * Phase 2 backtest will populate `byMint` with historical analyses captured
 * from a previous live run (or fixture replay); for now this enables wiring
 * judge() into simulator.ts without blocking on data plumbing.
 */
export class SimDecider implements Decider {
  constructor(
    private readonly byMint: Map<string, EnrichmentBundle> = new Map(),
  ) {}

  set(mint: string, bundle: EnrichmentBundle): void {
    this.byMint.set(mint, bundle);
  }

  async enrich(seed: BrainAgentSeed, _ctx: SkillContext): Promise<EnrichmentBundle> {
    return (
      this.byMint.get(seed.mint) ?? {
        analysis: null,
        signals: { signals: [], by_agent: {} },
      }
    );
  }
}
