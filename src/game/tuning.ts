/**
 * tuning.ts — every gameplay constant lives here, and only here.
 *
 * Rules:
 *  - No magic numbers inside game systems; import from this file.
 *  - Values marked TUNE are guesses awaiting playtesting; the monte-carlo
 *    harness (`npm run simulate`) is the tool for adjusting them.
 *  - Units in names: money is millions USD (`M`) unless `K`; probabilities
 *    and ratios are 0..1; meters (reputation, LP trust) are 0..100.
 */

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

export const CLOCK = {
  /** Meetings per quarter on the fund clock (cosmetic + capital-call cadence). */
  meetingsPerQuarter: 4,
} as const;

// ---------------------------------------------------------------------------
// Fund structure per career tier
// ---------------------------------------------------------------------------

/** Fund I: the 3-minute doomed tutorial. Simplified rules, stacked deck. */
export const FUND_I = {
  /** Fund size / meetings / starting LP trust come from FUND_I_TERMS below. */
  /** Hidden quality shifted down — the deck is quietly stacked. TUNE */
  qualityShift: -0.15,
  /** No card in Fund I exceeds this quality — no unicorn bait-outs. TUNE */
  qualityCap: 0.7,
  /** Aggressive partner veto base chance (bonuses in VETO still apply). TUNE */
  vetoBase: 0.3,
  /** Fund I sees earlier-stage, smaller-check deals. TUNE */
  stageWeights: { preSeed: 0.4, seed: 0.45, seriesA: 0.15, seriesB: 0 },
} as const;

/**
 * Fund I terms — the "pick your difficulty" reroll on the very first fund.
 * Each reroll draws ONE difficulty dial t in [0, 1) and lerps all three terms
 * from easy to hard together, so rerolling is choosing a difficulty, not
 * slot-machining for max-everything. DPI = returned / fund size and undeployed
 * capital returns nothing, so a bigger fund with fewer meetings is harder.
 * Fund II+ terms come from the career instead (unchanged).
 */
export const FUND_I_TERMS = {
  /** XORed into the run seed for a separate RNG, so rolling terms never
   *  shifts the main stream (firm name / thesis / deck stay seed-stable). */
  rngSalt: 0x7e57,
  sizeM: { easy: 8, hard: 10 },
  meetings: { easy: 20, hard: 10 }, // TUNE — Standard lands ~15, the sweet spot
  /** Added to the career's starting LP trust (METERS.startLpTrust). TUNE */
  lpTrustOffset: { easy: 10, hard: -10 },
  /** Dial cutoffs for the 3 labelled bands: soft < 1/3 <= standard < 2/3 <= brutal. */
  bandCutoffs: [1 / 3, 2 / 3],
} as const;

/**
 * Meetings per fund after Fund I. Growth should FEEL like growth: a repeat
 * Associate (missed 1x) gets a short fund; earning Partner opens the full
 * calendar. 50 felt like a punishment — 40 is the cap. TUNE
 */
export const MEETINGS_BY_TIER = {
  associate: 25,
  partner: 40,
  gp: 40,
} as const;

/**
 * Your FIRST fund at a new tier is shorter, so the calendar grows as you do:
 * Fund I ~15 → first Partner fund 30 → 40 thereafter. Tiers not listed use
 * MEETINGS_BY_TIER from their first fund. TUNE
 */
export const FIRST_FUND_AT_TIER_MEETINGS = {
  partner: 30,
} as const;

// ---------------------------------------------------------------------------
// Deck building
// ---------------------------------------------------------------------------

export const DECK = {
  /** ~60/40 on/off thesis composition. */
  onThesisRatio: 0.6,
  /** Stage mix for Fund II+ decks. TUNE */
  stageWeights: { preSeed: 0.3, seed: 0.4, seriesA: 0.2, seriesB: 0.1 },
  /** Relative weights for team/traction stats 1..5 (center-weighted). TUNE */
  statWeights: [1, 2, 3, 2.5, 1.5],
  /** Deal heat 1..5 skews warm — everything is "competitive". TUNE */
  heatWeights: [1.5, 2, 2.5, 2, 2],
} as const;

/** Per-stage deal shapes: check the founder asks, pre-money range, ARR base. */
export const STAGES = {
  preSeed: { askMinM: 0.6, askMaxM: 1.2, valMinM: 4, valMaxM: 8, arrBaseK: 0 },
  seed: { askMinM: 1, askMaxM: 2.5, valMinM: 8, valMaxM: 18, arrBaseK: 150 },
  seriesA: { askMinM: 3, askMaxM: 6, valMinM: 20, valMaxM: 45, arrBaseK: 1200 },
  seriesB: { askMinM: 7, askMaxM: 12, valMinM: 50, valMaxM: 120, arrBaseK: 6000 },
} as const;

export const DEAL_SHAPE = {
  /** Heat inflates the asked valuation per point away from neutral. TUNE */
  heatValFactorPerPoint: 0.12,
  heatNeutral: 3,
  /** ARR jitter around the stage/traction base. TUNE */
  arrJitterMin: 0.6,
  arrJitterMax: 1.6,
  /** ARR scales with traction: base * (factor ^ (traction - 3)). TUNE */
  arrTractionFactor: 1.7,
} as const;

/** Hidden quality = base + team + traction + noise, clamped 0..1. TUNE */
export const QUALITY = {
  base: 0.1,
  teamWeight: 0.3, // full weight at team 5
  tractionWeight: 0.35, // full weight at traction 5
  noiseAmp: 0.12, // uniform ±noise
} as const;

// ---------------------------------------------------------------------------
// Meters (0..100)
// ---------------------------------------------------------------------------

export const METERS = {
  min: 0,
  max: 100,
  startReputation: 30,
  startLpTrust: 70,
} as const;

export const REPUTATION = {
  /** Stage lower bounds: index 0..4 -> the 5 ladder stages (labels live in content). */
  stageThresholds: [0, 25, 50, 75, 90],
  signDelta: 1,
  hotDealHeatMin: 4,
  hotDealDelta: 4, // extra on top of signDelta. TUNE
  /** Passing more than this many in a row starts zombie-fund decay. */
  passStreakThreshold: 5,
  passDecayDelta: -2, // per pass beyond the streak threshold. TUNE
  markupDelta: 2,
  shutdownDelta: -2,
  vetoDelta: -1, // getting overruled stings. TUNE
  harvestWinDelta: 6,
  harvestUnicornDelta: 15,
  harvestBustDelta: -1,
  /** Off-thesis deal exits big -> "visionary". TUNE */
  visionaryDelta: 12,
} as const;

export const TRUST = {
  offThesisSignDelta: -8,
  onThesisSignDelta: 2,
  /** Next-fund size multiplier = clamp(base + trust/100 * slope). TUNE */
  sizeMultBase: 0.5,
  sizeMultSlope: 0.8,
  sizeMultMin: 0.5,
  sizeMultMax: 1.3,
} as const;

// ---------------------------------------------------------------------------
// Partner veto (Associate tiers; Fund I uses FUND_I.vetoBase as the base)
// ---------------------------------------------------------------------------

export const VETO = {
  /**
   * When a veto fires, chance the partner instead settles it on a coin flip
   * ("leadership challenge"): call it right and the deal goes through. TUNE
   */
  challengeChance: 1 / 3,
  /** The coin: chance your call is right. A fair one, despite everything. */
  coinWinChance: 0.5,
  associateBase: 0.15,
  offThesisBonus: 0.2,
  /** Traction at or below this counts as "low". */
  lowTractionMax: 2,
  lowTractionBonus: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Negotiation (Fund II+)
// ---------------------------------------------------------------------------

/**
 * Founder acceptance p = clamp(base
 *   + valWeight  * (offeredVal / askedVal - 1)      // generosity on price
 *   + checkWeight * (offeredCheck / askedCheck - 1) // check fit vs ask
 *   - heatPenaltyPerPoint * (heat - heatNeutral)    // hot deals demand more
 *   - boardSeatPenalty (if a seat is demanded)
 *   + counterBonus (round 1 only), min..max).
 * Monotonic: raising valuation or check never lowers p (weights positive).
 */
export const ACCEPTANCE = {
  base: 0.92,
  valWeight: 1.3,
  checkWeight: 0.35,
  heatPenaltyPerPoint: 0.06,
  heatNeutral: 3,
  counterBonus: 0.15,
  min: 0.03,
  max: 0.98,
} as const;

export const NEGOTIATION = {
  /** Exactly one counter round. */
  counterRounds: 1,
  /** Counter lands this fraction of the way back toward the ask. TUNE */
  counterFirmness: 0.65,
  /** Heat pushes counters closer to the ask, per point from neutral. TUNE */
  counterHeatFirmnessPerPoint: 0.05,
  counterFirmnessMin: 0.4,
  counterFirmnessMax: 0.9,
  /** Offers below this valuation ratio risk an immediate walk. TUNE */
  lowballValRatio: 0.6,
  lowballWalkChance: 0.3,
  /** Entry-price exit bonus = (askedVal / dealVal)^0.5, capped to this band. */
  entryBonusExponent: 0.5,
  entryBonusMax: 1.5,
  entryBonusMin: 0.8,
  /** Slider bounds relative to the founder's ask. */
  offerBounds: {
    checkMinRatio: 0.5,
    checkMaxRatio: 1.25,
    valMinRatio: 0.55,
    valMaxRatio: 1.15,
  },
} as const;

// ---------------------------------------------------------------------------
// Board seats (Partner+)
// ---------------------------------------------------------------------------

export const BOARD_SEATS = {
  /** Demanding a seat lowers negotiation acceptance by this much. TUNE */
  acceptancePenalty: 0.15,
  /** Even sign-at-ask can spook the founder when a seat is demanded. TUNE */
  signAtAskWalkChance: 0.08,
  /** Harvest exit-timing: push improves the exit or zeroes it. TUNE */
  pushImproveChance: 0.55,
  pushMultiplier: 1.8,
} as const;

// ---------------------------------------------------------------------------
// Follow-on interrupts (Fund II+)
// ---------------------------------------------------------------------------

export const FOLLOW_ONS = {
  /** A company can raise again this many meetings after signing. */
  minMeetingsHeld: 6,
  /** Per active company per ADVANCE. TUNE */
  perMeetingChance: 0.02,
  /** Max raise events (taken or declined) per company per run. */
  maxPerCompany: 2,
  /** New round size = original check * factor. TUNE */
  raiseFactorMin: 2,
  raiseFactorMax: 3.5,
  /** Round direction odds from quality: pUp = upBase + upQualitySlope*q. TUNE */
  upBase: 0.25,
  upQualitySlope: 0.5,
  downBase: 0.35,
  downQualitySlope: -0.25,
  /** New pre-money = old post-money * direction factor. TUNE */
  upFactorMin: 1.5,
  upFactorMax: 2.4,
  flatFactor: 1,
  downFactor: 0.6,
} as const;

// ---------------------------------------------------------------------------
// Bridge rounds (Partner+)
// ---------------------------------------------------------------------------

export const BRIDGE = {
  /** Only struggling companies come asking. */
  qualityThreshold: 0.35,
  minMeetingsHeld: 8,
  perMeetingChance: 0.015,
  /** Bridge cost as a fraction of the original check. TUNE */
  costFactorOfCheck: 0.5,
  /** A bridge buys a little life. TUNE */
  qualityBoost: 0.05,
} as const;

// ---------------------------------------------------------------------------
// Capital calls (GP)
// ---------------------------------------------------------------------------

export const CAPITAL_CALLS = {
  /** Rolled once per quarter boundary. TUNE */
  perQuarterChance: 0.12,
  /** Fraction of remaining capital an LP tries to slow-walk. TUNE */
  amountRatio: 0.1,
  /** Pressing the LP keeps the capital but costs trust. TUNE */
  pressTrustDelta: -6,
} as const;

// ---------------------------------------------------------------------------
// Exits & harvest
// ---------------------------------------------------------------------------

/**
 * Outcome weights as functions of hidden quality q (normalized before use):
 * zero/acquihire/base/win are base + slope*q; unicorn is base + quad*q^2.
 * Multiples apply to TOTAL invested capital and are scaled by the negotiated
 * entry bonus. Rough shape target: Fund I median DPI 0.3–0.8 under a naive
 * strategy (asserted by the monte-carlo suite). TUNE
 */
export const EXITS = {
  harvestYears: 5,
  weights: {
    zero: { base: 0.62, slope: -0.42 },
    acquihire: { base: 0.22, slope: -0.06 },
    base: { base: 0.12, slope: 0.1 },
    win: { base: 0.035, slope: 0.19 },
    unicorn: { base: 0.005, quad: 0.1 },
  },
  /** Payout multiple ranges (uniform within band) per bucket. TUNE */
  multiples: {
    zero: { min: 0, max: 0 },
    acquihire: { min: 0.25, max: 0.55 },
    base: { min: 1.2, max: 2.0 },
    win: { min: 3, max: 5.5 },
    unicorn: { min: 15, max: 30 },
  },
  /** Mid-run toast events, rolled per active company per ADVANCE. TUNE */
  midRun: {
    perMeetingChance: 0.008,
    markupQualityMin: 0.55,
    shutdownQualityMax: 0.3,
  },
} as const;

// ---------------------------------------------------------------------------
// Career ladder & fund sizing
// ---------------------------------------------------------------------------

export const CAREER = {
  /** DPI thresholds (returned / fund size). */
  associatePromotionDpi: 1.0,
  partnerPromotionDpi: 2.0,
  /** Enlightenment: 3x+ on a $200M+ fund at max reputation stage. */
  enlightenmentDpi: 3.0,
  enlightenmentMinFundM: 200, // scaled with gpBaseM (was 250 at 50 meetings)
  /** "Maxed reputation" = top stage lower bound (REPUTATION.stageThresholds[4]). */
  enlightenmentMinRep: 90,
  gpOfferCount: 3,
} as const;

/** Scorecard verdict bands: DPI upper bounds per bucket (content owns copy). */
export const VERDICT_DPI = {
  wipeoutMax: 0.3,
  underwaterMax: 1,
  respectableMax: 2,
  heaterMax: 3, // legend at 3x+
} as const;

export const FUND_SIZING = {
  /** Base next-fund size per tier, before DPI and trust multipliers. TUNE */
  associateBaseM: 30,
  partnerBaseM: 70, // scaled down with the 30-meeting first Partner fund so it's deployable
  gpBaseM: 145, // scaled ×40/50 with GP meetings so a GP fund is still deployable
  /** DPI factor = clamp(dpiFactorBase + dpi * dpiFactorSlope). TUNE */
  dpiFactorBase: 0.6,
  dpiFactorSlope: 0.4,
  dpiFactorMin: 0.7,
  dpiFactorMax: 1.6,
  /** GP offer packages spread around the computed next size. TUNE */
  gpOfferSizeFactors: [0.8, 1.0, 1.3],
  gpOfferSizeJitter: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Simulation harness (naive-strategy policy used by tests + npm run simulate)
// ---------------------------------------------------------------------------

export const SIM = {
  /** Naive policy: sign at ask when team+traction >= this... */
  signStatSumMin: 6,
  /** ...or when heat is at least this (FOMO is the point). */
  signHeatMin: 4,
  /** Safety cap on reducer steps per simulated run. */
  maxSteps: 5000,
} as const;

// ---------------------------------------------------------------------------
// Swipe feel (mechanical thresholds only — visuals live in CSS)
// ---------------------------------------------------------------------------

export const SWIPE = {
  /** Movement below this is a tap, not a swipe (buttons still fire). */
  slopPx: 12,
  /** Distance commit: |dx| >= this fraction of the game column width. TUNE */
  commitDistanceRatio: 0.3,
  /** Flick commit: |velocity| >= px/ms with at least the min travel. TUNE */
  flickVelocity: 0.5,
  flickMinDistancePx: 40,
  /** Sub-threshold release springs the card back over this many ms. */
  springBackMs: 180,
} as const;
