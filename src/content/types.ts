/**
 * Content schema types. All content ships as static JSON (validated by
 * src/content/validate.ts at load time and by `npm run validate-content`).
 *
 * Standing rule: ALL player-facing comedy copy lives in content JSON and is
 * typed here — none of it is hardcoded in game logic or UI.
 */

export const SECTORS = [
  'AI',
  'SaaS',
  'Fintech',
  'Consumer',
  'Climate',
  'Health',
  'Crypto',
  'Gaming',
  'Space',
  'Food',
] as const;
export type Sector = (typeof SECTORS)[number];

/**
 * One swipeable pitch card's editorial content. Numeric stats (team, traction,
 * heat, ask, valuation, hidden quality) are NOT content — they get rolled at
 * runtime by game logic from the seeded RNG.
 */
export interface Pitch {
  /** Globally unique, `<sector-slug>-<name-slug>`, e.g. "ai-synergly". */
  id: string;
  /** Company name as it appears on the card and in the ledger. */
  name: string;
  /** The one-liner joke. Deadpan, specific, one twist, under 20 words. */
  idea: string;
  sector: Sector;
}

/** Shape of every file in src/content/pitches/ — one batch per file. */
export interface PitchBatchFile {
  pitches: Pitch[];
}

/** A comedy thesis pinning exactly two distinct sectors. */
export interface Thesis {
  id: string;
  sectors: [Sector, Sector];
  /** The firm's mandate one-liner shown at fund open and on the scorecard. */
  line: string;
}

/** Prefix + suffix pools for the firm name generator. */
export interface FirmNameParts {
  prefixes: string[];
  suffixes: string[];
}

/**
 * Scorecard verdict bands. Game logic maps DPI -> bucket using thresholds in
 * tuning.ts; content only supplies the copy per bucket.
 */
export const VERDICT_BUCKETS = [
  'wipeout', // lost most of the fund
  'underwater', // below 1x
  'respectable', // around break-even to decent
  'heater', // strong fund
  'legend', // career-defining
] as const;
export type VerdictBucket = (typeof VERDICT_BUCKETS)[number];

/** Exit outcome buckets; keys match EXITS.outcomeMultiples in tuning.ts. */
export const EXIT_BUCKETS = ['zero', 'acquihire', 'base', 'win', 'unicorn'] as const;
export type ExitBucket = (typeof EXIT_BUCKETS)[number];

/**
 * Every pool of flavor/toast copy the game draws from (via injected RNG).
 * Adding a pool here (plus lines.json content) is how new copy surfaces exist.
 */
export interface FlavorLines {
  /** End-of-Fund-I rehire card. */
  rehireCard: string[];
  /** Reputation-decay jabs when the player passes too much. */
  zombieFundJabs: string[];
  /** Partner kills an agreed deal (Associate tier). */
  vetoLines: string[];
  /** Founder walks after a too-aggressive negotiation. */
  founderWalkLines: string[];
  /** Harvest heartbreak when a vetoed company went unicorn; {company} interpolated. */
  vetoHeartbreak: string[];
  /** Promotion card copy (the flip side of rehireCard). */
  poachLines: string[];
  /** Quirk line attached to each GP-tier LP offer package. */
  lpOfferQuirks: string[];
  /**
   * The 5 reputation ladder stage labels, index-aligned with the engine's
   * REPUTATION.stageThresholds (canonical: DOG WATER -> ENLIGHTENED).
   */
  reputationStages: string[];
  /** Negotiation mood hints, ordered coldest -> warmest. */
  founderMoods: string[];
  /** Shown on the disabled board-seat control at Associate. */
  boardSeatLocked: string[];
  /** The endgame card: a young associate pitching their fund to you. */
  finalCardPitches: string[];
  /** Enlightenment notice copy. */
  enlightenmentLines: string[];
  /** Credits screen copy. */
  creditsLines: string[];
  /** Ledger stamp per scorecard verdict band. */
  verdictStamps: Record<VerdictBucket, string>;
  /**
   * Share copy per verdict band ({dpi}/{fund}/{returned}/{firm} tokens);
   * failure buckets carry the extra-funny variants.
   */
  shareLines: Record<VerdictBucket, string[]>;
  /** Career-level share flex ({returned}/{funds} tokens). */
  shareCareerLines: string[];
  /** Shown when the LP Register (leaderboard) can't be reached. */
  registerUnreachable: string[];
  /** Scorecard verdict copy per DPI band. */
  verdicts: Record<VerdictBucket, string[]>;
  /** Stamped label per exit outcome on the harvest screen. */
  harvestOutcomeLabels: Record<ExitBucket, string>;
}

/**
 * The carry price ladder: what the money means. `{carry}` in a line is
 * replaced with the formatted figure. The picker takes the highest
 * thresholdM <= carry and rotates among entries sharing that threshold;
 * zero/negative carry draws from the failure pool instead.
 */
export interface CarryEquivalences {
  failure: string[];
  ladder: Array<{ thresholdM: number; line: string }>;
}

/** Everything the content layer provides, fully validated. */
export interface Content {
  pitches: Pitch[];
  theses: Thesis[];
  firmNames: FirmNameParts;
  lines: FlavorLines;
  carryEquivalences: CarryEquivalences;
}
